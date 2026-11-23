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
import { reconcilePendingRefunds } from '../payments/payments.refunds.reconciliation.js';

const WEBHOOK_SECRET = 'whsec_test';
const FINANCE_EMAIL = 'finance@sridha.test';
const OPERATIONS_EMAIL = 'operations@sridha.test';
const PRE_REGISTER_TOPIC = 'topic_physics_wave_optics_class_12';

const signWebhook = (body: unknown) =>
  createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

describe('refund reconciliation polling', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let razorpay: ReturnType<typeof createScriptedRazorpay>;
  let finance: TestClient;
  let superAdmin: TestClient;
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
    superAdmin = await server.signInStaff(TEST_SUPER_ADMIN_EMAIL);
    operations = await server.signInStaff(OPERATIONS_EMAIL);
  });

  after(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Refund history cannot be deleted (migration 020); retire earlier
    // tests' unresolved refunds so each test reconciles only its own
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

  const deliver = (body: Record<string, unknown>) => {
    eventNumber += 1;
    return server
      .createClient()
      .request('POST', '/api/payments/webhook', body, {
        'X-Razorpay-Signature': signWebhook(body),
        'X-Razorpay-Event-Id': `evt_recon_${eventNumber}`,
      });
  };

  const paidPayment = async () => {
    buyer += 1;
    const checkout = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'PRE_REGISTRATION',
        topicId: PRE_REGISTER_TOPIC,
        fullName: 'Refund Recon Buyer',
        email: `recon.buyer${buyer}@example.com`,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(checkout.status, 201);
    const { paymentId, provider, amount } = checkout.body.checkout;
    const providerPaymentId = `pay_recon_${buyer}`;
    await deliver({
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
    return {
      paymentId: String(paymentId),
      providerPaymentId,
      amountPaise: Number(amount.amountPaise),
    };
  };

  const refund = (client: TestClient, paymentId: string, body: object) =>
    client.request('POST', `/api/finance/payments/${paymentId}/refunds`, body);

  const getRefund = async (refundId: string) =>
    server.db.get<Record<string, unknown>>(
      'SELECT * FROM payment_refunds WHERE id = $1',
      [refundId],
    );

  it('reconciles a pending refund that transitioned to processed on Razorpay', async () => {
    const paid = await paidPayment();
    const requested = await refund(finance, paid.paymentId, {
      reason: 'Course cancelled before start',
    });
    assert.equal(requested.status, 201);
    const refundId = requested.body.refund.id;
    const providerRefundId = requested.body.refund.providerRefundId;
    assert.equal(requested.body.refund.status, 'PENDING');

    // Razorpay now reports processed
    razorpay.refunds.set(providerRefundId, {
      id: providerRefundId,
      status: 'processed',
      amountPaise: paid.amountPaise,
      currency: 'INR',
      paymentId: paid.providerPaymentId,
      receipt: razorpay.refundRequests[0].receipt,
    });

    const result = await reconcilePendingRefunds(
      { db: server.db, now: server.clock.now },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );

    assert.equal(result.processed, 1);
    assert.equal(result.failed, 0);

    const row = await getRefund(refundId);
    assert.equal(row?.status, 'PROCESSED');
    assert.notEqual(row?.processed_at, null);

    const audit = await server.db.all<{
      action: string;
      details: Record<string, unknown>;
    }>(
      `SELECT action, details FROM finance_audit_log
       WHERE action = 'REFUND_RECORDED' AND entity_id = $1`,
      [refundId],
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].details.reconciled, true);
    assert.equal(audit[0].details.status, 'PROCESSED');
  });

  it('reconciles a pending refund that failed on Razorpay and restores refundable balance', async () => {
    const paid = await paidPayment();
    const requested = await refund(finance, paid.paymentId, {
      amountPaise: 2000,
      reason: 'Partial refund attempt',
    });
    assert.equal(requested.status, 201);
    const refundId = requested.body.refund.id;
    const providerRefundId = requested.body.refund.providerRefundId;

    // Razorpay reports the refund failed at the bank
    razorpay.refunds.set(providerRefundId, {
      id: providerRefundId,
      status: 'failed',
      amountPaise: 2000,
      currency: 'INR',
      paymentId: paid.providerPaymentId,
      receipt: razorpay.refundRequests[0].receipt,
    });

    const result = await reconcilePendingRefunds(
      { db: server.db, now: server.clock.now },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );

    assert.equal(result.failed, 1);

    const row = await getRefund(refundId);
    assert.equal(row?.status, 'FAILED');
    assert.notEqual(row?.failed_at, null);
    assert.equal(
      row?.failure_reason,
      'Payment provider reported refund failed',
    );

    // Full payment amount can be refunded again now that the failed refund was freed
    const retried = await refund(finance, paid.paymentId, {
      amountPaise: paid.amountPaise,
      reason: 'Retry full refund',
    });
    assert.equal(retried.status, 201);
  });

  it('leaves a refund pending when Razorpay still reports it as pending', async () => {
    const paid = await paidPayment();
    const requested = await refund(finance, paid.paymentId, {
      reason: 'Wait for bank',
    });
    const refundId = requested.body.refund.id;

    const result = await reconcilePendingRefunds(
      { db: server.db, now: server.clock.now },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );

    assert.equal(result.pending, 1);
    assert.equal(result.processed, 0);
    assert.equal(result.failed, 0);

    const row = await getRefund(refundId);
    assert.equal(row?.status, 'PENDING');
  });

  it('respects threshold and only polls refunds older than specified cutoff', async () => {
    const paid = await paidPayment();
    const requested = await refund(finance, paid.paymentId, {
      reason: 'Threshold test',
    });
    const providerRefundId = requested.body.refund.providerRefundId;
    razorpay.refunds.set(providerRefundId, {
      id: providerRefundId,
      status: 'processed',
      amountPaise: paid.amountPaise,
      currency: 'INR',
      paymentId: paid.providerPaymentId,
      receipt: razorpay.refundRequests[0].receipt,
    });

    const startTime = server.clock.now();

    // Default threshold is 30 mins; at start time + 10 mins, it should NOT poll
    const tooEarly = await reconcilePendingRefunds(
      {
        db: server.db,
        now: () => new Date(startTime.getTime() + 10 * 60 * 1000),
      },
      razorpay.gateway,
      { olderThanMinutes: 30 },
    );
    assert.equal(tooEarly.processed, 0);

    // At start time + 35 mins, it should poll and process
    const mature = await reconcilePendingRefunds(
      {
        db: server.db,
        now: () => new Date(startTime.getTime() + 35 * 60 * 1000),
      },
      razorpay.gateway,
      { olderThanMinutes: 30 },
    );
    assert.equal(mature.processed, 1);
  });

  it('matches unknown refund by receipt when creation timed out', async () => {
    const paid = await paidPayment();
    // Simulate gateway createRefund timeout
    razorpay.state.refundResult = () => ({ outcome: 'unknown' });

    const requested = await refund(finance, paid.paymentId, {
      amountPaise: 1500,
      reason: 'Timeout on creation',
    });
    assert.equal(requested.status, 201);
    const refundId = requested.body.refund.id;
    assert.equal(requested.body.refund.providerRefundId, null);

    const receipt = razorpay.refundRequests[0].receipt;

    // Refund was actually created on Razorpay with our receipt
    razorpay.paymentRefunds.set(paid.providerPaymentId, [
      {
        id: 'rfnd_created_on_gateway',
        status: 'processed',
        amountPaise: 1500,
        currency: 'INR',
        paymentId: paid.providerPaymentId,
        receipt,
      },
    ]);

    const result = await reconcilePendingRefunds(
      { db: server.db, now: server.clock.now },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );

    assert.equal(result.processed, 1);
    const row = await getRefund(refundId);
    assert.equal(row?.status, 'PROCESSED');
    assert.equal(row?.provider_refund_id, 'rfnd_created_on_gateway');
  });

  it('never fails a refund just because Razorpay has not listed it yet', async () => {
    // The audit's reproduction: a refund request times out, reconciliation
    // runs before Razorpay lists it, then Razorpay processes it
    const paid = await paidPayment();
    razorpay.state.refundResult = () => ({ outcome: 'unknown' });
    const requested = await refund(finance, paid.paymentId, {
      amountPaise: 2500,
      reason: 'Lost request',
    });
    const refundId = requested.body.refund.id;
    const receipt = razorpay.refundRequests[0].receipt;
    razorpay.paymentRefunds.set(paid.providerPaymentId, []);
    const start = server.clock.now();
    const at = (hours: number) => () =>
      new Date(start.getTime() + hours * 60 * 60 * 1000);

    const early = await reconcilePendingRefunds(
      { db: server.db, now: at(1) },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );
    assert.equal(early.failed, 0);
    assert.equal(early.pending, 1);
    assert.equal((await getRefund(refundId))?.status, 'PENDING');

    // Still absent a day later: a person must look, and the amount stays
    // reserved so nobody can refund it twice meanwhile
    const late = await reconcilePendingRefunds(
      { db: server.db, now: at(25) },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );
    assert.equal(late.failed, 0);
    assert.equal(late.needsReview, 1);
    const flagged = await getRefund(refundId);
    assert.equal(flagged?.status, 'REQUIRES_REVIEW');
    assert.match(String(flagged?.review_reason), /not found at Razorpay/i);
    const second = await refund(finance, paid.paymentId, {
      amountPaise: paid.amountPaise,
      reason: 'Second full refund',
    });
    assert.equal(second.status, 409);

    const review = await server.db.all<{ details: Record<string, unknown> }>(
      `SELECT details FROM finance_audit_log
       WHERE action = 'REFUND_RECORDED' AND entity_id = $1`,
      [refundId],
    );
    assert.equal(review.at(-1)?.details.status, 'REQUIRES_REVIEW');

    // Razorpay lists it after all: the ledger follows Razorpay
    razorpay.paymentRefunds.set(paid.providerPaymentId, [
      {
        id: 'rfnd_late_listing',
        status: 'processed',
        amountPaise: 2500,
        currency: 'INR',
        paymentId: paid.providerPaymentId,
        receipt,
      },
    ]);
    const settled = await reconcilePendingRefunds(
      { db: server.db, now: at(26) },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );
    assert.equal(settled.processed, 1);
    const row = await getRefund(refundId);
    assert.equal(row?.status, 'PROCESSED');
    assert.equal(row?.provider_refund_id, 'rfnd_late_listing');
  });

  it('lets Razorpay confirming a refund correct a refund recorded as failed here', async () => {
    const paid = await paidPayment();
    razorpay.state.refundResult = () => ({
      outcome: 'rejected',
      reason: 'Misreported refusal',
    });
    const requested = await refund(finance, paid.paymentId, {
      amountPaise: 5000,
      reason: 'Partial refund',
    });
    const refundId = requested.body.refund.id;
    assert.equal(requested.body.refund.status, 'FAILED');
    const receipt = razorpay.refundRequests[0].receipt;

    const processed = await deliver({
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_confirmed_later',
            payment_id: paid.providerPaymentId,
            amount: 5000,
            currency: 'INR',
            receipt,
            status: 'processed',
          },
        },
      },
    });
    assert.equal(processed.status, 200);

    const row = await getRefund(refundId);
    assert.equal(row?.status, 'PROCESSED');
    assert.equal(row?.provider_refund_id, 'rfnd_confirmed_later');
    assert.notEqual(row?.processed_at, null);

    // The refunded 5,000 is no longer refundable
    const tooMuch = await refund(finance, paid.paymentId, {
      amountPaise: paid.amountPaise,
      reason: 'Full refund on top',
    });
    assert.equal(tooMuch.status, 409);
  });

  it('never lets a late "failed" undo a processed refund', async () => {
    const paid = await paidPayment();
    const requested = await refund(finance, paid.paymentId, {
      amountPaise: 1000,
      reason: 'Partial',
    });
    const { id: refundId, providerRefundId } = requested.body.refund;
    const entity = {
      id: providerRefundId,
      payment_id: paid.providerPaymentId,
      amount: 1000,
      currency: 'INR',
    };
    await deliver({
      event: 'refund.processed',
      payload: { refund: { entity: { ...entity, status: 'processed' } } },
    });
    await deliver({
      event: 'refund.failed',
      payload: { refund: { entity: { ...entity, status: 'failed' } } },
    });
    assert.equal((await getRefund(refundId))?.status, 'PROCESSED');
  });

  it('skips gracefully when gateway is unreachable', async () => {
    const paid = await paidPayment();
    const requested = await refund(finance, paid.paymentId, {
      reason: 'Unreachable test',
    });
    const refundId = requested.body.refund.id;

    // Gateway fetch returns null (unreachable)
    const unreachableGateway = {
      ...razorpay.gateway,
      fetchRefund: async () => null,
      fetchPaymentRefunds: async () => null,
    };

    const result = await reconcilePendingRefunds(
      { db: server.db, now: server.clock.now },
      unreachableGateway,
      { olderThanMinutes: 0 },
    );

    assert.equal(result.skipped, 1);
    assert.equal(result.processed, 0);

    const row = await getRefund(refundId);
    assert.equal(row?.status, 'PENDING');
  });

  it('handles concurrent webhook update safely (idempotency)', async () => {
    const paid = await paidPayment();
    const requested = await refund(finance, paid.paymentId, {
      reason: 'Race test',
    });
    const refundId = requested.body.refund.id;
    const providerRefundId = requested.body.refund.providerRefundId;

    // Webhook delivers before polling finishes
    await deliver({
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: providerRefundId,
            payment_id: paid.providerPaymentId,
            amount: paid.amountPaise,
            currency: 'INR',
            status: 'processed',
          },
        },
      },
    });

    const afterWebhook = await getRefund(refundId);
    assert.equal(afterWebhook?.status, 'PROCESSED');

    // Polling runs next
    razorpay.refunds.set(providerRefundId, {
      id: providerRefundId,
      status: 'processed',
      amountPaise: paid.amountPaise,
      currency: 'INR',
      paymentId: paid.providerPaymentId,
      receipt: razorpay.refundRequests[0].receipt,
    });
    const result = await reconcilePendingRefunds(
      { db: server.db, now: server.clock.now },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );

    // It was already processed, so no rows were pending
    assert.equal(result.processed, 0);
  });

  it('allows finance staff to trigger reconciliation via POST /api/finance/refunds/reconcile and checks permissions', async () => {
    // Unauthenticated -> 401
    const unauth = await server
      .createClient()
      .request('POST', '/api/finance/refunds/reconcile', {});
    assert.equal(unauth.status, 401);

    // Student -> 403
    const student = server.createClient();
    await student.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'recon.student@example.com' }),
    );
    const studentRes = await student.request(
      'POST',
      '/api/finance/refunds/reconcile',
      {},
    );
    assert.equal(studentRes.status, 403);

    // Operations admin -> 403
    const opsRes = await operations.request(
      'POST',
      '/api/finance/refunds/reconcile',
      {},
    );
    assert.equal(opsRes.status, 403);

    // Finance admin -> 200
    const financeRes = await finance.request(
      'POST',
      '/api/finance/refunds/reconcile',
      { olderThanMinutes: 0 },
    );
    assert.equal(financeRes.status, 200);
    assert.equal(typeof financeRes.body.processed, 'number');
    assert.equal(typeof financeRes.body.failed, 'number');

    // Super admin -> 200
    const superRes = await superAdmin.request(
      'POST',
      '/api/finance/refunds/reconcile',
      {},
    );
    assert.equal(superRes.status, 200);
  });

  describe('refund reports that do not match the refund on record (N7)', () => {
    const lastEvent = async () =>
      (await server.db.get<{ outcome: string }>(
        'SELECT outcome FROM payment_events ORDER BY id DESC LIMIT 1',
      ))!.outcome;
    const exceptions = async (refundId: string | null) =>
      server.db.all<{ details: { field: string } }>(
        `SELECT details FROM finance_audit_log
         WHERE action = 'REFUND_EXCEPTION_RECORDED'
           AND entity_id IS NOT DISTINCT FROM $1 ORDER BY id`,
        [refundId],
      );
    // Razorpay always sends the refund's status with the event
    const STATUS_OF_EVENT: Record<string, string> = {
      'refund.created': 'pending',
      'refund.processed': 'processed',
      'refund.failed': 'failed',
    };
    const refundEvent = (eventType: string, entity: Record<string, unknown>) =>
      deliver({
        event: eventType,
        payload: {
          refund: { entity: { status: STATUS_OF_EVENT[eventType], ...entity } },
        },
      });

    // A 1,000 paise refund Razorpay accepted (id known, still pending)
    const pendingRefund = async () => {
      const paid = await paidPayment();
      const requested = await refund(finance, paid.paymentId, {
        amountPaise: 1000,
        reason: 'Partial',
      });
      return {
        paid,
        refundId: String(requested.body.refund.id),
        providerRefundId: String(requested.body.refund.providerRefundId),
        entity: {
          id: String(requested.body.refund.providerRefundId),
          payment_id: paid.providerPaymentId,
          amount: 1000,
          currency: 'INR',
        },
      };
    };

    it('applies a report that matches exactly', async () => {
      const { refundId, entity } = await pendingRefund();
      await refundEvent('refund.processed', entity);
      assert.equal(await lastEvent(), 'APPLIED');
      assert.equal((await getRefund(refundId))?.status, 'PROCESSED');
      assert.deepEqual(await exceptions(refundId), []);
    });

    it('rejects and records a different amount, lower or higher, and changes nothing', async () => {
      // The audit's case: 9,000 reported for a 1,000 refund
      for (const amount of [500, 9000]) {
        const { refundId, entity } = await pendingRefund();
        await refundEvent('refund.processed', { ...entity, amount });
        assert.equal(await lastEvent(), 'REJECTED_MISMATCH');
        const row = await getRefund(refundId);
        assert.equal(row?.status, 'PENDING');
        assert.equal(Number(row?.amount_paise), 1000);
        const recorded = await exceptions(refundId);
        assert.equal(recorded.length, 1);
        assert.equal(recorded[0].details.field, 'amount');
      }
    });

    it('rejects and records a report for another payment, another refund id or currency', async () => {
      const { refundId, entity } = await pendingRefund();
      const other = await paidPayment();

      await refundEvent('refund.processed', {
        ...entity,
        payment_id: other.providerPaymentId,
      });
      assert.equal(await lastEvent(), 'REJECTED_MISMATCH');

      const receipt = String((await getRefund(refundId))?.receipt);
      await refundEvent('refund.processed', {
        ...entity,
        id: 'rfnd_someone_else',
        receipt,
      });
      assert.equal(await lastEvent(), 'REJECTED_MISMATCH');

      await refundEvent('refund.processed', { ...entity, currency: 'USD' });
      assert.equal(await lastEvent(), 'REJECTED_MISMATCH');

      assert.equal((await getRefund(refundId))?.status, 'PENDING');
      assert.deepEqual(
        (await exceptions(refundId)).map(entry => entry.details.field),
        ['payment', 'provider_refund_id'],
      );
      assert.ok(
        (await exceptions(null)).some(
          entry => entry.details.field === 'currency',
        ),
      );
    });

    it('ignores a repeated webhook and an out-of-order one, and still takes a late confirmation', async () => {
      const { refundId, entity } = await pendingRefund();
      const body = {
        event: 'refund.processed',
        payload: { refund: { entity: { ...entity, status: 'processed' } } },
      };
      const first = await server
        .createClient()
        .request('POST', '/api/payments/webhook', body, {
          'X-Razorpay-Signature': signWebhook(body),
          'X-Razorpay-Event-Id': `evt_dup_${refundId}`,
        });
      const repeated = await server
        .createClient()
        .request('POST', '/api/payments/webhook', body, {
          'X-Razorpay-Signature': signWebhook(body),
          'X-Razorpay-Event-Id': `evt_dup_${refundId}`,
        });
      assert.equal(first.status, 200);
      assert.equal(repeated.status, 200);
      assert.equal(
        (
          await server.db.all(
            'SELECT id FROM payment_events WHERE event_id = $1',
            [`evt_dup_${refundId}`],
          )
        ).length,
        1,
      );

      // An older "created" arriving after "processed" is ignored
      await refundEvent('refund.created', entity);
      assert.equal(await lastEvent(), 'IGNORED_STALE');
      assert.equal((await getRefund(refundId))?.status, 'PROCESSED');
    });

    it('sends a listed refund with a different amount to review, never to processed', async () => {
      const paid = await paidPayment();
      razorpay.state.refundResult = () => ({ outcome: 'unknown' });
      const requested = await refund(finance, paid.paymentId, {
        amountPaise: 1200,
        reason: 'Timeout',
      });
      const refundId = String(requested.body.refund.id);
      razorpay.paymentRefunds.set(paid.providerPaymentId, [
        {
          id: 'rfnd_wrong_amount',
          status: 'processed',
          amountPaise: 9000,
          currency: 'INR',
          paymentId: paid.providerPaymentId,
          receipt: razorpay.refundRequests.at(-1)!.receipt,
        },
      ]);
      const result = await reconcilePendingRefunds(
        { db: server.db, now: server.clock.now },
        razorpay.gateway,
        { olderThanMinutes: 0 },
      );
      assert.equal(result.processed, 0);
      assert.equal(result.needsReview, 1);
      const row = await getRefund(refundId);
      assert.equal(row?.status, 'REQUIRES_REVIEW');
      assert.match(String(row?.review_reason), /9000 paise/);
      assert.equal((await exceptions(refundId)).length, 1);

      const listed = await finance.request(
        'GET',
        '/api/finance/refund-exceptions',
      );
      assert.ok(
        listed.body.open.some(
          (item: { refundId: string }) => item.refundId === refundId,
        ),
      );
      assert.ok(listed.body.mismatches.length >= 1);
      const asOperations = await operations.request(
        'GET',
        '/api/finance/refund-exceptions',
      );
      assert.equal(asOperations.status, 403);
    });
  });
});
