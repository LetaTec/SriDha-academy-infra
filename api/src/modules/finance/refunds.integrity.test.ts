import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import { createScriptedRazorpay } from '../../test/fakeRazorpay.js';
import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
  validRegistration,
  type TestClient,
} from '../../test/testServer.js';
import type { ProviderRefund } from '../payments/gateway.js';
import { reconcilePendingRefunds } from '../payments/payments.refunds.reconciliation.js';

// Phase 2.1-R3.2: refund evidence integrity (R31-01 to R31-04). Nothing a
// provider sends that is incomplete, malformed or for another refund may
// settle a refund or release its reserved amount, and everything that cannot
// be applied is recorded for finance.

const WEBHOOK_SECRET = 'whsec_test';
const FINANCE_EMAIL = 'finance.integrity@sridha.test';
const OPERATIONS_EMAIL = 'operations.integrity@sridha.test';
const PRE_REGISTER_TOPIC = 'topic_physics_ray_optics_class_12';

const signWebhook = (body: unknown) =>
  createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

type Paid = {
  paymentId: string;
  providerPaymentId: string;
  amountPaise: number;
};

describe('refund evidence integrity (R3.2)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let razorpay: ReturnType<typeof createScriptedRazorpay>;
  let finance: TestClient;
  let operations: TestClient;
  let buyer = 0;
  let eventNumber = 0;

  before(async () => {
    razorpay = createScriptedRazorpay();
    server = await startTestServer({
      paymentGateway: razorpay.gateway,
      razorpayWebhookSecret: WEBHOOK_SECRET,
      financeAdminEmails: [FINANCE_EMAIL],
      operationsAdminEmails: [OPERATIONS_EMAIL],
    });
    finance = await server.signInStaff(FINANCE_EMAIL);
    operations = await server.signInStaff(OPERATIONS_EMAIL);
    await server.signInStaff(TEST_SUPER_ADMIN_EMAIL);
  });

  after(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Refund history cannot be deleted (migration 020): retire earlier
    // tests' unresolved refunds so each test sees only its own
    await server.db.run(
      `UPDATE payment_refunds SET status = 'FAILED', failure_reason = 'Test isolation'
       WHERE status IN ('PENDING', 'REQUIRES_REVIEW')`,
    );
    razorpay.refundRequests.length = 0;
    razorpay.refunds.clear();
    razorpay.paymentRefunds.clear();
    razorpay.state.refundResult = request => ({
      outcome: 'created',
      refund: {
        id: `rfnd_${razorpay.refundRequests.length}_${request.receipt}`,
        status: 'pending',
        amountPaise: request.amountPaise,
        currency: 'INR',
        paymentId: request.providerPaymentId,
        receipt: request.receipt,
      },
    });
  });

  const deliverRaw = (
    body: Record<string, unknown>,
    options: { eventId?: string; signature?: string } = {},
  ) => {
    eventNumber += 1;
    return server
      .createClient()
      .request('POST', '/api/payments/webhook', body, {
        'X-Razorpay-Signature': options.signature ?? signWebhook(body),
        'X-Razorpay-Event-Id':
          options.eventId ?? `evt_integrity_${eventNumber}`,
      });
  };

  const paidPayment = async (): Promise<Paid> => {
    buyer += 1;
    const checkout = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'PRE_REGISTRATION',
        topicId: PRE_REGISTER_TOPIC,
        fullName: 'Integrity Buyer',
        email: `integrity.buyer${buyer}@example.com`,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(checkout.status, 201);
    const { paymentId, provider, amount } = checkout.body.checkout;
    const providerPaymentId = `pay_integrity_${buyer}`;
    const captured = await deliverRaw({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            order_id: provider.orderId,
            amount: amount.amountPaise,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    });
    assert.equal(captured.status, 200);
    return {
      paymentId: String(paymentId),
      providerPaymentId,
      amountPaise: Number(amount.amountPaise),
    };
  };

  const requestRefund = (paid: Paid, amountPaise?: number) =>
    finance.request('POST', `/api/finance/payments/${paid.paymentId}/refunds`, {
      reason: 'Integrity test',
      ...(amountPaise ? { amountPaise } : {}),
    });

  const getRefund = (refundId: string) =>
    server.db.get<Record<string, unknown>>(
      'SELECT * FROM payment_refunds WHERE id = $1',
      [refundId],
    );

  const reservedPaise = async (paymentId: string) =>
    Number(
      (
        await server.db.get<{ total: string | number }>(
          `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM payment_refunds
           WHERE payment_id = $1 AND status <> 'FAILED'`,
          [paymentId],
        )
      )?.total ?? 0,
    );

  const exceptionsFor = (refundId: string | null) =>
    server.db.all<{ details: Record<string, unknown> }>(
      `SELECT details FROM finance_audit_log
       WHERE action = 'REFUND_EXCEPTION_RECORDED'
         AND entity_id IS NOT DISTINCT FROM $1 ORDER BY id`,
      [refundId],
    );

  const blankIdsStored = async () =>
    Number(
      (
        await server.db.get<{ n: string | number }>(
          `SELECT COUNT(*) AS n FROM payment_refunds
           WHERE provider_refund_id IS NOT NULL
             AND provider_refund_id !~ '^\\S(.*\\S)?$'`,
        )
      )?.n ?? 0,
    );

  const reconcile = (olderThanMinutes = 0) =>
    reconcilePendingRefunds(
      { db: server.db, now: server.clock.now },
      razorpay.gateway,
      { olderThanMinutes },
    );

  // ---------------------------------------------------------------------
  // R31-01: reconciliation never settles a refund on unusable evidence
  // ---------------------------------------------------------------------
  describe('R31-01: reconciliation evidence', () => {
    type Overrides = Partial<Record<keyof ProviderRefund, unknown>>;

    // The refund as Razorpay should report it, with chosen defects. 'listed'
    // is the path for a refund whose id we never stored (a timed-out
    // request, found by receipt); 'direct' fetches the id we stored.
    const scenario = async (
      path: 'direct' | 'listed',
      overrides: Overrides,
    ) => {
      const paid = await paidPayment();
      if (path === 'listed') {
        razorpay.state.refundResult = () => ({ outcome: 'unknown' });
      }
      const requested = await requestRefund(paid, 3000);
      assert.equal(requested.status, 201);
      const refundId = String(requested.body.refund.id);
      const receipt = razorpay.refundRequests.at(-1)!.receipt;
      const providerRefundId =
        path === 'direct'
          ? String(requested.body.refund.providerRefundId)
          : `rfnd_listed_${refundId.slice(0, 12)}`;
      const report = {
        id: providerRefundId,
        status: 'failed',
        amountPaise: 3000,
        currency: 'INR',
        paymentId: paid.providerPaymentId,
        receipt,
        ...overrides,
      } as unknown as ProviderRefund;
      if (path === 'direct') {
        razorpay.refunds.set(providerRefundId, report);
      } else {
        razorpay.paymentRefunds.set(paid.providerPaymentId, [report]);
      }
      return { paid, refundId, providerRefundId };
    };

    const defects: Array<[string, Overrides]> = [
      ['an empty id', { id: '' }],
      ['a whitespace-only id', { id: '   ' }],
      ['a null id', { id: null }],
      ['a missing id', { id: undefined }],
      ['a numeric id', { id: 12345 }],
      ['an object id', { id: { id: 'rfnd_x' } }],
      ['a padded id', { id: ' rfnd_padded ' }],
      ['a missing payment id', { paymentId: undefined }],
      ['a null payment id', { paymentId: null }],
      ['a foreign payment id', { paymentId: 'pay_someone_else' }],
      ['a missing currency', { currency: undefined }],
      ['a null currency', { currency: null }],
      ['an incorrect currency', { currency: 'USD' }],
      ['a missing amount', { amountPaise: undefined }],
      ['a string amount', { amountPaise: '3000' }],
      ['an incorrect amount', { amountPaise: 9000 }],
      ['a missing status', { status: undefined }],
      ['an unsupported status', { status: 'cancelled' }],
      ['a numeric status', { status: 7 }],
    ];

    for (const path of ['direct', 'listed'] as const) {
      for (const [label, overrides] of defects) {
        it(`never fails a refund on ${label} (${path} lookup) and keeps its amount reserved`, async () => {
          const { paid, refundId } = await scenario(path, overrides);
          const before = await getRefund(refundId);

          const result = await reconcile();

          assert.equal(result.failed, 0);
          assert.equal(result.processed, 0);
          const row = await getRefund(refundId);
          assert.notEqual(row?.status, 'FAILED');
          assert.notEqual(row?.status, 'PROCESSED');
          assert.equal(row?.status, 'REQUIRES_REVIEW');
          assert.equal(await reservedPaise(paid.paymentId), 3000);
          assert.equal(await blankIdsStored(), 0);
          // No id is taken from evidence that was not accepted
          assert.equal(row?.provider_refund_id, before?.provider_refund_id);
          const recorded = await exceptionsFor(refundId);
          assert.equal(recorded.length, 1);
          assert.equal(recorded[0].details.source, 'reconciliation');

          // The next run neither settles it nor records it again
          const again = await reconcile();
          assert.equal(again.failed, 0);
          assert.equal((await getRefund(refundId))?.status, 'REQUIRES_REVIEW');
          assert.equal((await exceptionsFor(refundId)).length, 1);
        });
      }
    }

    it('never fails a refund when our receipt is missing from, or different in, the direct record', async () => {
      for (const receipt of [undefined, null, 'rcpt_someone_else']) {
        const { paid, refundId } = await scenario('direct', { receipt });
        const result = await reconcile();
        assert.equal(result.failed, 0, `receipt ${String(receipt)}`);
        assert.equal((await getRefund(refundId))?.status, 'REQUIRES_REVIEW');
        assert.equal(await reservedPaise(paid.paymentId), 3000);
      }
    });

    it('never picks between two Razorpay refunds that carry one receipt', async () => {
      const paid = await paidPayment();
      razorpay.state.refundResult = () => ({ outcome: 'unknown' });
      const requested = await requestRefund(paid, 3000);
      const refundId = String(requested.body.refund.id);
      const receipt = razorpay.refundRequests.at(-1)!.receipt;
      const base = {
        amountPaise: 3000,
        currency: 'INR',
        paymentId: paid.providerPaymentId,
        receipt,
      };
      razorpay.paymentRefunds.set(paid.providerPaymentId, [
        { id: 'rfnd_dup_failed', status: 'failed', ...base },
        { id: 'rfnd_dup_processed', status: 'processed', ...base },
      ]);

      const result = await reconcile();

      assert.equal(result.failed, 0);
      assert.equal(result.processed, 0);
      assert.equal((await getRefund(refundId))?.status, 'REQUIRES_REVIEW');
      assert.equal(await reservedPaise(paid.paymentId), 3000);
      assert.equal((await exceptionsFor(refundId)).length, 1);
    });

    it('leaves a refund already waiting for review alone when the evidence is still bad', async () => {
      const { paid, refundId } = await scenario('direct', { id: '   ' });
      await server.db.run(
        `UPDATE payment_refunds SET status = 'REQUIRES_REVIEW', review_reason = 'Checked by a person' WHERE id = $1`,
        [refundId],
      );
      const result = await reconcile();
      assert.equal(result.failed, 0);
      const row = await getRefund(refundId);
      assert.equal(row?.status, 'REQUIRES_REVIEW');
      assert.equal(row?.review_reason, 'Checked by a person');
      assert.equal(await reservedPaise(paid.paymentId), 3000);
    });

    for (const path of ['direct', 'listed'] as const) {
      it(`settles a refund as FAILED on complete, matching, authoritative evidence (${path} lookup)`, async () => {
        const { paid, refundId, providerRefundId } = await scenario(path, {});
        const result = await reconcile();
        assert.equal(result.failed, 1);
        const row = await getRefund(refundId);
        assert.equal(row?.status, 'FAILED');
        assert.equal(row?.provider_refund_id, providerRefundId);
        assert.equal(await reservedPaise(paid.paymentId), 0);
        assert.equal((await exceptionsFor(refundId)).length, 0);
      });

      it(`settles a refund as PROCESSED on complete, matching, authoritative evidence (${path} lookup)`, async () => {
        const { paid, refundId, providerRefundId } = await scenario(path, {
          status: 'processed',
        });
        const result = await reconcile();
        assert.equal(result.processed, 1);
        const row = await getRefund(refundId);
        assert.equal(row?.status, 'PROCESSED');
        assert.equal(row?.provider_refund_id, providerRefundId);
        assert.equal(await reservedPaise(paid.paymentId), 3000);
      });
    }

    it('does not treat a refund absent from the provider as failed, and keeps it reserved', async () => {
      const paid = await paidPayment();
      razorpay.state.refundResult = () => ({ outcome: 'unknown' });
      const requested = await requestRefund(paid, 3000);
      const refundId = String(requested.body.refund.id);
      razorpay.paymentRefunds.set(paid.providerPaymentId, []);
      const start = server.clock.now();
      const result = await reconcilePendingRefunds(
        {
          db: server.db,
          now: () => new Date(start.getTime() + 60 * 60 * 1000),
        },
        razorpay.gateway,
        { olderThanMinutes: 0 },
      );
      assert.equal(result.failed, 0);
      assert.equal((await getRefund(refundId))?.status, 'PENDING');
      assert.equal(await reservedPaise(paid.paymentId), 3000);
    });

    it('also protects the manual reconcile endpoint', async () => {
      const { paid, refundId } = await scenario('direct', { id: '' });
      const response = await finance.request(
        'POST',
        '/api/finance/refunds/reconcile',
        { olderThanMinutes: 0 },
      );
      assert.equal(response.status, 200);
      assert.equal(response.body.failed, 0);
      assert.equal((await getRefund(refundId))?.status, 'REQUIRES_REVIEW');
      assert.equal(await reservedPaise(paid.paymentId), 3000);
    });
  });

  // ---------------------------------------------------------------------
  // R31-03: signed webhooks and refund creation need the same evidence
  // ---------------------------------------------------------------------
  describe('R31-03: webhook and creation evidence', () => {
    const pending = async () => {
      const paid = await paidPayment();
      const requested = await requestRefund(paid, 3000);
      assert.equal(requested.status, 201);
      return {
        paid,
        refundId: String(requested.body.refund.id),
        providerRefundId: String(requested.body.refund.providerRefundId),
        receipt: razorpay.refundRequests.at(-1)!.receipt,
      };
    };

    const event = (
      eventType: string,
      entity: Record<string, unknown>,
    ): Record<string, unknown> => ({
      event: eventType,
      payload: { refund: { entity } },
    });

    const failedEntity = (
      paid: Paid,
      providerRefundId: string,
      overrides: Record<string, unknown> = {},
    ) => ({
      id: providerRefundId,
      payment_id: paid.providerPaymentId,
      amount: 3000,
      currency: 'INR',
      status: 'failed',
      ...overrides,
    });

    const lastOutcome = async () =>
      (await server.db.get<{ outcome: string }>(
        'SELECT outcome FROM payment_events ORDER BY id DESC LIMIT 1',
      ))!.outcome;

    const defects: Array<[string, Record<string, unknown>]> = [
      ['an empty id', { id: '' }],
      ['a whitespace-only id', { id: '   ' }],
      ['a null id', { id: null }],
      ['a missing id', { id: undefined }],
      ['a numeric id', { id: 99 }],
      ['a padded id', { id: ' rfnd_pad ' }],
      ['a missing payment id', { payment_id: undefined }],
      ['an incorrect amount', { amount: 9000 }],
      ['a missing amount', { amount: undefined }],
      ['a string amount', { amount: '3000' }],
      ['a fractional amount', { amount: 3000.5 }],
      ['a missing currency', { currency: undefined }],
      ['an incorrect currency', { currency: 'USD' }],
      ['a missing status', { status: undefined }],
      ['a status that contradicts the event', { status: 'processed' }],
      ['an unsupported status', { status: 'reversed' }],
    ];

    for (const [label, overrides] of defects) {
      it(`a signed refund.failed with ${label} releases nothing and is recorded`, async () => {
        const { paid, refundId, providerRefundId, receipt } = await pending();
        // The receipt lets the exception be tied to the refund
        const entity = failedEntity(paid, providerRefundId, {
          receipt,
          ...overrides,
        });
        const response = await deliverRaw(event('refund.failed', entity));

        assert.equal(response.status, 200);
        assert.equal(await lastOutcome(), 'REJECTED_MISMATCH');
        const row = await getRefund(refundId);
        assert.equal(row?.status, 'PENDING');
        assert.equal(await reservedPaise(paid.paymentId), 3000);
        assert.equal(await blankIdsStored(), 0);
        assert.equal(row?.provider_refund_id, providerRefundId);
        // Recorded once, with the event it came from, for finance to see
        const tied = await exceptionsFor(refundId);
        const untied = await exceptionsFor(null);
        const mine = [...tied, ...untied].filter(
          item => item.details.eventType === 'refund.failed',
        );
        assert.ok(mine.length >= 1, 'an exception was recorded');
        assert.ok(mine.every(item => typeof item.details.eventId === 'string'));
      });
    }

    it('records a report for another payment that exists, and releases nothing', async () => {
      const { paid, refundId, providerRefundId } = await pending();
      const other = await paidPayment();
      await deliverRaw(
        event(
          'refund.failed',
          failedEntity(paid, providerRefundId, {
            payment_id: other.providerPaymentId,
          }),
        ),
      );
      assert.equal(await lastOutcome(), 'REJECTED_MISMATCH');
      assert.equal((await getRefund(refundId))?.status, 'PENDING');
      assert.equal(await reservedPaise(paid.paymentId), 3000);
      const recorded = await exceptionsFor(refundId);
      assert.equal(recorded.length, 1);
      assert.equal(recorded[0].details.field, 'payment');
    });

    it('stores a report for a payment this system does not know, and touches no refund', async () => {
      const { paid, refundId, providerRefundId } = await pending();
      const response = await deliverRaw(
        event(
          'refund.failed',
          failedEntity(paid, providerRefundId, {
            payment_id: 'pay_never_heard_of',
          }),
        ),
      );
      assert.equal(response.status, 200);
      assert.equal(await lastOutcome(), 'UNKNOWN_PAYMENT');
      assert.equal((await getRefund(refundId))?.status, 'PENDING');
      assert.equal(await reservedPaise(paid.paymentId), 3000);
    });

    it('records a blank-id event against the refund its receipt names, and stores no id', async () => {
      const { paid, refundId, providerRefundId, receipt } = await pending();
      await deliverRaw(
        event('refund.failed', {
          ...failedEntity(paid, providerRefundId, { id: '   ' }),
          receipt,
        }),
      );
      const recorded = await exceptionsFor(refundId);
      assert.equal(recorded.length, 1);
      assert.deepEqual(recorded[0].details.problems, ['id_invalid']);
      assert.equal(await blankIdsStored(), 0);
    });

    it('applies a valid signed refund.failed and releases the amount', async () => {
      const { paid, refundId, providerRefundId } = await pending();
      const response = await deliverRaw(
        event('refund.failed', failedEntity(paid, providerRefundId)),
      );
      assert.equal(response.status, 200);
      assert.equal(await lastOutcome(), 'APPLIED');
      assert.equal((await getRefund(refundId))?.status, 'FAILED');
      assert.equal(await reservedPaise(paid.paymentId), 0);
      assert.equal((await exceptionsFor(refundId)).length, 0);
    });

    it('applies a valid signed refund.processed and keeps the amount reserved', async () => {
      const { paid, refundId, providerRefundId } = await pending();
      await deliverRaw(
        event(
          'refund.processed',
          failedEntity(paid, providerRefundId, { status: 'processed' }),
        ),
      );
      assert.equal(await lastOutcome(), 'APPLIED');
      assert.equal((await getRefund(refundId))?.status, 'PROCESSED');
      assert.equal(await reservedPaise(paid.paymentId), 3000);
    });

    it('applies a refund.created event with a pending status', async () => {
      const paid = await paidPayment();
      const response = await deliverRaw(
        event('refund.created', {
          id: 'rfnd_dashboard_created',
          payment_id: paid.providerPaymentId,
          amount: 4000,
          currency: 'INR',
          status: 'pending',
        }),
      );
      assert.equal(response.status, 200);
      assert.equal(await lastOutcome(), 'APPLIED');
      assert.equal(await reservedPaise(paid.paymentId), 4000);
    });

    it('is idempotent: a repeated delivery changes nothing and records nothing twice', async () => {
      const { paid, refundId, providerRefundId } = await pending();
      const bad = event(
        'refund.failed',
        failedEntity(paid, providerRefundId, { id: '' }),
      );
      await deliverRaw(bad, { eventId: `evt_dup_${refundId}` });
      await deliverRaw(bad, { eventId: `evt_dup_${refundId}` });
      assert.equal(
        (
          await server.db.all(
            'SELECT id FROM payment_events WHERE event_id = $1',
            [`evt_dup_${refundId}`],
          )
        ).length,
        1,
      );
      assert.equal(
        (await exceptionsFor(null)).filter(
          item => item.details.eventId === `evt_dup_${refundId}`,
        ).length,
        1,
      );
      assert.equal((await getRefund(refundId))?.status, 'PENDING');
    });

    it('refuses an unsigned or wrongly signed event before looking at it', async () => {
      const { paid, refundId, providerRefundId } = await pending();
      const body = event('refund.failed', failedEntity(paid, providerRefundId));
      const wrong = await deliverRaw(body, { signature: 'f'.repeat(64) });
      assert.equal(wrong.status, 400);
      const none = await server
        .createClient()
        .request('POST', '/api/payments/webhook', body);
      assert.equal(none.status, 400);
      assert.equal((await getRefund(refundId))?.status, 'PENDING');
    });

    it('takes a late refund.processed after a failure when the amount is free again', async () => {
      const { paid, refundId, providerRefundId } = await pending();
      await deliverRaw(
        event('refund.failed', failedEntity(paid, providerRefundId)),
      );
      assert.equal((await getRefund(refundId))?.status, 'FAILED');
      await deliverRaw(
        event(
          'refund.processed',
          failedEntity(paid, providerRefundId, { status: 'processed' }),
        ),
      );
      assert.equal(await lastOutcome(), 'APPLIED');
      assert.equal((await getRefund(refundId))?.status, 'PROCESSED');
      assert.equal(await reservedPaise(paid.paymentId), 3000);
    });

    it('ties an event to one refund only: the id on one refund and the receipt of another is an exception', async () => {
      const first = await pending();
      const second = await pending();
      // Same payment is needed for two refunds, so build both on one payment
      const paid = await paidPayment();
      const a = await requestRefund(paid, 1000);
      const b = await requestRefund(paid, 1000);
      const aId = String(a.body.refund.id);
      const bId = String(b.body.refund.id);
      const aProvider = String(a.body.refund.providerRefundId);
      const bReceipt = String((await getRefund(bId))?.receipt);
      await deliverRaw(
        event('refund.failed', {
          id: aProvider,
          payment_id: paid.providerPaymentId,
          amount: 1000,
          currency: 'INR',
          status: 'failed',
          receipt: bReceipt,
        }),
      );
      assert.equal(await lastOutcome(), 'REJECTED_MISMATCH');
      assert.equal((await getRefund(aId))?.status, 'PENDING');
      assert.equal((await getRefund(bId))?.status, 'PENDING');
      assert.equal(
        (await exceptionsFor(null)).filter(
          item => item.details.field === 'correlation',
        ).length,
        1,
      );
      assert.ok(first && second);
    });

    it('a created refund with no usable id stays pending, is recorded, and is found later by receipt', async () => {
      for (const id of ['', '   ', null, undefined]) {
        const paid = await paidPayment();
        razorpay.state.refundResult = request => ({
          outcome: 'created',
          refund: {
            id: id as never,
            status: 'failed',
            amountPaise: request.amountPaise,
            currency: 'INR',
            paymentId: request.providerPaymentId,
            receipt: request.receipt,
          },
        });
        const requested = await requestRefund(paid, 3000);
        assert.equal(requested.status, 201);
        const refundId = String(requested.body.refund.id);
        const row = await getRefund(refundId);
        assert.equal(row?.status, 'PENDING', `id ${String(id)}`);
        assert.equal(row?.provider_refund_id, null);
        assert.equal(await reservedPaise(paid.paymentId), 3000);
        const recorded = await exceptionsFor(refundId);
        assert.equal(recorded.length, 1);
        assert.equal(recorded[0].details.source, 'refund_creation');
      }
      assert.equal(await blankIdsStored(), 0);
    });

    it('a created refund for another payment or in another currency stays pending and is recorded', async () => {
      for (const defect of [
        { paymentId: 'pay_someone_else' },
        { currency: 'USD' },
        { currency: undefined },
      ]) {
        const paid = await paidPayment();
        razorpay.state.refundResult = request => ({
          outcome: 'created',
          refund: {
            id: 'rfnd_created_wrong',
            status: 'processed',
            amountPaise: request.amountPaise,
            currency: 'INR',
            paymentId: request.providerPaymentId,
            receipt: request.receipt,
            ...defect,
          },
        });
        const requested = await requestRefund(paid, 3000);
        const refundId = String(requested.body.refund.id);
        assert.equal((await getRefund(refundId))?.status, 'PENDING');
        assert.equal(await reservedPaise(paid.paymentId), 3000);
        assert.equal((await exceptionsFor(refundId)).length, 1);
      }
    });
  });

  // ---------------------------------------------------------------------
  // R31-04: what cannot be applied is never only logged
  // ---------------------------------------------------------------------
  describe('R31-04: financial exceptions', () => {
    const entityFor = (
      paid: Paid,
      id: string,
      amount: number,
      status: string,
    ) => ({
      id,
      payment_id: paid.providerPaymentId,
      amount,
      currency: 'INR',
      status,
    });
    const send = (
      eventType: string,
      entity: Record<string, unknown>,
      eventId?: string,
    ) =>
      deliverRaw(
        { event: eventType, payload: { refund: { entity } } },
        { eventId },
      );
    const lastOutcome = async () =>
      (await server.db.get<{ outcome: string }>(
        'SELECT outcome FROM payment_events ORDER BY id DESC LIMIT 1',
      ))!.outcome;

    // A refund that failed here, its amount reserved again by a second
    // refund, and then Razorpay reports the first one processed
    const lateProcessedAfterReuse = async () => {
      const paid = await paidPayment();
      const first = await requestRefund(paid);
      const firstId = String(first.body.refund.id);
      const firstProviderId = String(first.body.refund.providerRefundId);
      await send(
        'refund.failed',
        entityFor(paid, firstProviderId, paid.amountPaise, 'failed'),
      );
      assert.equal((await getRefund(firstId))?.status, 'FAILED');
      const second = await requestRefund(paid);
      assert.equal(second.status, 201);
      return {
        paid,
        firstId,
        firstProviderId,
        secondId: String(second.body.refund.id),
      };
    };

    it('records a late refund.processed that cannot be reinstated, and changes no refund', async () => {
      const { paid, firstId, firstProviderId, secondId } =
        await lateProcessedAfterReuse();

      const response = await send(
        'refund.processed',
        entityFor(paid, firstProviderId, paid.amountPaise, 'processed'),
        'evt_late_processed_1',
      );

      assert.equal(response.status, 200);
      assert.equal(await lastOutcome(), 'REJECTED_MISMATCH');
      assert.equal((await getRefund(firstId))?.status, 'FAILED');
      assert.equal((await getRefund(secondId))?.status, 'PENDING');
      assert.equal(await reservedPaise(paid.paymentId), paid.amountPaise);

      const recorded = await exceptionsFor(firstId);
      assert.equal(recorded.length, 1);
      const details = recorded[0].details as {
        field: string;
        reason: string;
        eventId: string;
        eventType: string;
        recorded: Record<string, unknown>;
        reported: Record<string, unknown>;
      };
      assert.equal(details.field, 'amount');
      assert.match(details.reason, /reinstating it would exceed/i);
      assert.equal(details.eventId, 'evt_late_processed_1');
      assert.equal(details.eventType, 'refund.processed');
      assert.equal(details.recorded.paymentId, paid.paymentId);
      assert.equal(details.recorded.refundStatus, 'FAILED');
      assert.equal(details.recorded.amountPaise, paid.amountPaise);
      assert.equal(details.recorded.capturedPaise, paid.amountPaise);
      assert.equal(details.recorded.activeRefundsPaise, paid.amountPaise);
      assert.equal(details.reported.providerRefundId, firstProviderId);
      assert.equal(details.reported.amountPaise, paid.amountPaise);
      assert.equal(details.reported.status, 'processed');
    });

    it('records one exception per provider event: a redelivery adds none, a new event adds one', async () => {
      const { paid, firstId, firstProviderId } =
        await lateProcessedAfterReuse();
      const entity = entityFor(
        paid,
        firstProviderId,
        paid.amountPaise,
        'processed',
      );
      await send('refund.processed', entity, 'evt_late_dup');
      await send('refund.processed', entity, 'evt_late_dup');
      assert.equal((await exceptionsFor(firstId)).length, 1);

      await send('refund.processed', entity, 'evt_late_dup_other');
      assert.equal((await exceptionsFor(firstId)).length, 2);
    });

    it('shows the exception in the finance workflow and on the refund page', async () => {
      const { paid, firstId, firstProviderId } =
        await lateProcessedAfterReuse();
      await send(
        'refund.processed',
        entityFor(paid, firstProviderId, paid.amountPaise, 'processed'),
        'evt_late_visible',
      );

      const listed = await finance.request(
        'GET',
        '/api/finance/refund-exceptions',
      );
      assert.equal(listed.status, 200);
      assert.ok(
        listed.body.mismatches.some(
          (item: { refundId: string | null; details: { eventId?: string } }) =>
            item.refundId === firstId &&
            item.details.eventId === 'evt_late_visible',
        ),
      );
      const detail = await finance.request(
        'GET',
        `/api/finance/refunds/${firstId}`,
      );
      assert.equal(detail.status, 200);
      assert.ok(
        detail.body.mismatches.some(
          (item: { details: { eventId?: string } }) =>
            item.details.eventId === 'evt_late_visible',
        ),
      );
      const asOperations = await operations.request(
        'GET',
        '/api/finance/refund-exceptions',
      );
      assert.equal(asOperations.status, 403);
    });

    it('records a refund made at Razorpay that would exceed the captured amount, and does not record the refund', async () => {
      const paid = await paidPayment();
      const full = await requestRefund(paid);
      await send(
        'refund.processed',
        entityFor(
          paid,
          String(full.body.refund.providerRefundId),
          paid.amountPaise,
          'processed',
        ),
      );
      const before = Number(
        (
          await server.db.get<{ n: string | number }>(
            'SELECT COUNT(*) AS n FROM payment_refunds WHERE payment_id = $1',
            [paid.paymentId],
          )
        )?.n,
      );

      await send(
        'refund.processed',
        entityFor(paid, 'rfnd_dashboard_over_cap', 500, 'processed'),
        'evt_over_cap',
      );

      assert.equal(await lastOutcome(), 'REJECTED_MISMATCH');
      assert.equal(
        Number(
          (
            await server.db.get<{ n: string | number }>(
              'SELECT COUNT(*) AS n FROM payment_refunds WHERE payment_id = $1',
              [paid.paymentId],
            )
          )?.n,
        ),
        before,
      );
      const recorded = (await exceptionsFor(null)).filter(
        item => item.details.eventId === 'evt_over_cap',
      );
      assert.equal(recorded.length, 1);
      assert.equal(recorded[0].details.field, 'amount');
      assert.equal(
        (recorded[0].details.reported as Record<string, unknown>)
          .providerRefundId,
        'rfnd_dashboard_over_cap',
      );
      assert.equal(
        (recorded[0].details.recorded as Record<string, unknown>).capturedPaise,
        paid.amountPaise,
      );

      const listed = await finance.request(
        'GET',
        '/api/finance/refund-exceptions',
      );
      assert.ok(
        listed.body.mismatches.some(
          (item: { details: { eventId?: string } }) =>
            item.details.eventId === 'evt_over_cap',
        ),
      );
      // The reserved total never moved past what was captured
      assert.equal(await reservedPaise(paid.paymentId), paid.amountPaise);
    });

    it('never bypasses the database cap, and exception history cannot be rewritten', async () => {
      const paid = await paidPayment();
      await assert.rejects(
        () =>
          server.db.query(
            `INSERT INTO payment_refunds (id, payment_id, provider, provider_refund_id, receipt, amount_paise, currency, status, source, created_at, updated_at)
             VALUES ('over-cap', $1, 'RAZORPAY', 'rfnd_over_cap_sql', 'rcpt_over_cap', $2, 'INR', 'PROCESSED', 'PROVIDER_DASHBOARD', now(), now())`,
            [paid.paymentId, paid.amountPaise + 1],
          ),
        (error: { code?: string }) => error.code === '23514',
      );
      await assert.rejects(
        () =>
          server.db.query(
            `UPDATE finance_audit_log SET details = '{}'::jsonb WHERE action = 'REFUND_EXCEPTION_RECORDED'`,
          ),
        /append-only/i,
      );
    });
  });

  // ---------------------------------------------------------------------
  // R33-02: a legacy blank or padded provider id is surfaced, never rewritten
  // ---------------------------------------------------------------------
  describe('R33-02: legacy invalid provider refund ids', () => {
    // What a database migrated before 023 can hold: the constraint is NOT
    // VALID (existing rows kept, new rows guarded). The test server enforces
    // it, so it is lifted for the test and put back as it was.
    const withLegacyRow = async (
      providerRefundId: string,
      status: 'PENDING' | 'REQUIRES_REVIEW',
      run: (refundId: string, paid: Paid, stored: string) => Promise<void>,
    ) => {
      const paid = await paidPayment();
      // Each legacy id is distinct: provider ids stay unique
      const stored = providerRefundId.trim()
        ? ` rfnd_legacy_${eventNumber} `
        : ' '.repeat(3 + eventNumber);
      const refundId = `legacy-${eventNumber}-${Math.abs(providerRefundId.length)}`;
      await server.db.exec(
        'ALTER TABLE payment_refunds DROP CONSTRAINT payment_refunds_provider_refund_id_clean',
      );
      try {
        await server.db.query(
          `INSERT INTO payment_refunds (id, payment_id, provider, provider_refund_id, receipt, amount_paise, currency, status, source, created_at, updated_at)
           VALUES ($1, $2, 'RAZORPAY', $3, $4, 2500, 'INR', $5, 'FINANCE_ADMIN', $6, $6)`,
          [
            refundId,
            paid.paymentId,
            stored,
            `rcpt_${refundId}`,
            status,
            // On the test clock, which the reconciliation cutoff uses
            server.clock.now().toISOString(),
          ],
        );
        await run(refundId, paid, stored);
      } finally {
        // Retire the legacy row while the constraint is off, so later tests'
        // isolation updates do not meet a row the constraint would refuse
        await server.db.query(
          `UPDATE payment_refunds SET status = 'FAILED', failure_reason = 'Test isolation' WHERE id = $1`,
          [refundId],
        );
        await server.db.exec(
          `ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_provider_refund_id_clean
           CHECK (provider_refund_id IS NULL OR provider_refund_id ~ '^\\S(.*\\S)?$') NOT VALID`,
        );
      }
    };

    for (const [label, value] of [
      ['blank', '   '],
      ['padded', ' rfnd_legacy_padded '],
    ] as const) {
      for (const status of ['PENDING', 'REQUIRES_REVIEW'] as const) {
        it(`records a ${label} legacy id on a ${status} refund once, keeps it reserved and rewrites nothing`, async () => {
          await withLegacyRow(value, status, async (refundId, paid, stored) => {
            // Reconciliation must not crash on the row, however often it runs
            const results = [
              await reconcile(),
              await reconcile(),
              await reconcile(),
            ];
            assert.ok(
              results.every(run => run.failed === 0 && run.processed === 0),
            );

            const row = await getRefund(refundId);
            assert.equal(row?.status, status);
            assert.equal(row?.provider_refund_id, stored, 'never rewritten');
            assert.equal(await reservedPaise(paid.paymentId), 2500);

            const recorded = await exceptionsFor(refundId);
            assert.equal(recorded.length, 1, 'recorded once, not every run');
            assert.equal(
              recorded[0].details.source,
              'legacy_invalid_provider_id',
            );
            assert.equal(recorded[0].details.field, 'provider_refund_id');

            // Durable and visible to finance
            const listed = await finance.request(
              'GET',
              '/api/finance/refund-exceptions',
            );
            assert.ok(
              listed.body.mismatches.some(
                (item: { refundId: string | null }) =>
                  item.refundId === refundId,
              ),
            );
            const detail = await finance.request(
              'GET',
              `/api/finance/refunds/${refundId}`,
            );
            assert.equal(detail.status, 200);
          });
        });
      }
    }

    it('does not let the hourly job or the endpoint touch the legacy row, and still settles clean refunds', async () => {
      await withLegacyRow('   ', 'PENDING', async refundId => {
        const clean = await paidPayment();
        const requested = await requestRefund(clean, 3000);
        const cleanId = String(requested.body.refund.id);
        razorpay.refunds.set(String(requested.body.refund.providerRefundId), {
          id: String(requested.body.refund.providerRefundId),
          status: 'failed',
          amountPaise: 3000,
          currency: 'INR',
          paymentId: clean.providerPaymentId,
          receipt: razorpay.refundRequests.at(-1)!.receipt,
        });
        const response = await finance.request(
          'POST',
          '/api/finance/refunds/reconcile',
          { olderThanMinutes: 0 },
        );
        assert.equal(response.status, 200);
        assert.equal((await getRefund(cleanId))?.status, 'FAILED');
        assert.equal((await getRefund(refundId))?.status, 'PENDING');
        assert.equal((await exceptionsFor(refundId)).length, 1);
      });
    });
  });

  // ---------------------------------------------------------------------
  // Authorization boundaries stay as they were
  // ---------------------------------------------------------------------
  describe('authorization', () => {
    it('keeps reconciliation and resolution to finance roles', async () => {
      const anonymous = server.createClient();
      const student = server.createClient();
      await student.request(
        'POST',
        '/api/auth/register',
        validRegistration({ email: 'integrity.student@example.com' }),
      );
      for (const [client, status] of [
        [anonymous, 401],
        [student, 403],
        [operations, 403],
      ] as const) {
        const reconcileResponse = await client.request(
          'POST',
          '/api/finance/refunds/reconcile',
          {},
        );
        assert.equal(reconcileResponse.status, status);
        const resolveResponse = await client.request(
          'POST',
          '/api/finance/refund-exceptions/any/resolve',
          {
            action: 'MARK_FAILED',
            evidenceReference: 'ref',
            notes: 'notes',
          },
        );
        assert.equal(resolveResponse.status, status);
      }
    });
  });
});
