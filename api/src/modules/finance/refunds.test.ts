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
import { expireStalePayments } from '../payments/payments.expiry.js';

const WEBHOOK_SECRET = 'whsec_test';
const FINANCE_EMAIL = 'finance@sridha.test';
const OPERATIONS_EMAIL = 'operations@sridha.test';
const PRE_REGISTER_TOPIC = 'topic_physics_wave_optics_class_12';

const signWebhook = (body: unknown) =>
  createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

describe('refunds and disputes', () => {
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

  beforeEach(() => {
    razorpay.refundRequests.length = 0;
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
        'X-Razorpay-Event-Id': `evt_refunds_${eventNumber}`,
      });
  };

  // A pre-registration paid and captured, as Razorpay would report it
  const paidPayment = async () => {
    buyer += 1;
    const checkout = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'PRE_REGISTRATION',
        topicId: PRE_REGISTER_TOPIC,
        fullName: 'Refund Buyer',
        email: `refund.buyer${buyer}@example.com`,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(checkout.status, 201);
    const { paymentId, provider, amount } = checkout.body.checkout;
    const providerPaymentId = `pay_refund_${buyer}`;
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

  const refundRows = (paymentId: string) =>
    server.db.all<Record<string, unknown>>(
      `SELECT amount_paise, status, source, provider_refund_id, reason
       FROM payment_refunds WHERE payment_id = $1 ORDER BY created_at, id`,
      [paymentId],
    );

  const refundEvent = (
    event: string,
    entity: Record<string, unknown>,
  ): Record<string, unknown> => ({
    event,
    payload: {
      refund: {
        entity: {
          currency: 'INR',
          // Razorpay always sends the refund's status with the event
          status: {
            'refund.created': 'pending',
            'refund.processed': 'processed',
            'refund.failed': 'failed',
          }[event],
          ...entity,
        },
      },
    },
  });

  it('refunds a payment in full, then records Razorpay processing it', async () => {
    const paid = await paidPayment();

    const requested = await refund(finance, paid.paymentId, {
      reason: 'Student asked to cancel before the batch started',
    });
    assert.equal(requested.status, 201);
    assert.equal(requested.body.refund.status, 'PENDING');
    assert.equal(requested.body.refund.amountPaise, paid.amountPaise);

    assert.equal(razorpay.refundRequests.length, 1);
    const [sent] = razorpay.refundRequests;
    assert.equal(sent.providerPaymentId, paid.providerPaymentId);
    assert.equal(sent.amountPaise, paid.amountPaise);
    assert.match(sent.receipt, /^[0-9a-f]{32}$/);

    const providerRefundId = requested.body.refund.providerRefundId;
    await deliver(
      refundEvent('refund.processed', {
        id: providerRefundId,
        payment_id: paid.providerPaymentId,
        amount: paid.amountPaise,
        status: 'processed',
        receipt: sent.receipt,
      }),
    );
    assert.deepEqual(
      (await refundRows(paid.paymentId)).map(row => row.status),
      ['PROCESSED'],
    );

    const audit = await server.db.all<Record<string, unknown>>(
      `SELECT actor_role, details FROM finance_audit_log
       WHERE action = 'REFUND_REQUESTED' AND entity_id = $1`,
      [requested.body.refund.id],
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_role, 'FINANCE_ADMIN');
  });

  it('takes several partial refunds, never more than was captured', async () => {
    const paid = await paidPayment();
    const part = Math.floor(paid.amountPaise / 4);

    for (const amountPaise of [part, part]) {
      const response = await refund(finance, paid.paymentId, {
        amountPaise,
        reason: 'Partial refund',
      });
      assert.equal(response.status, 201);
    }

    const tooMuch = await refund(finance, paid.paymentId, {
      amountPaise: paid.amountPaise,
      reason: 'More than is left',
    });
    assert.equal(tooMuch.status, 409);
    assert.equal(tooMuch.body.code, 'REFUND_EXCEEDS_REMAINING');

    for (const amountPaise of [0, -5, 1.5]) {
      const invalid = await refund(finance, paid.paymentId, {
        amountPaise,
        reason: 'Invalid amount',
      });
      assert.equal(invalid.status, 400, String(amountPaise));
    }

    // With no amount, the rest is refunded
    const rest = await refund(superAdmin, paid.paymentId, {
      reason: 'Refund the remainder',
    });
    assert.equal(rest.status, 201);
    assert.equal(rest.body.refund.amountPaise, paid.amountPaise - 2 * part);

    const rows = await refundRows(paid.paymentId);
    assert.equal(
      rows.reduce((sum, row) => sum + Number(row.amount_paise), 0),
      paid.amountPaise,
    );
    const nothingLeft = await refund(finance, paid.paymentId, {
      reason: 'Nothing left',
    });
    assert.equal(nothingLeft.status, 409);
  });

  it('treats a repeated request with the same request key as one refund', async () => {
    const paid = await paidPayment();
    const body = {
      amountPaise: 1000,
      reason: 'Double click',
      requestKey: '3f8b7c2e-1d4a-4b6e-9a0f-5c2d8e7b1a90',
    };
    const first = await refund(finance, paid.paymentId, body);
    const second = await refund(finance, paid.paymentId, body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.refund.id, first.body.refund.id);
    assert.equal(razorpay.refundRequests.length, 1);
    assert.equal((await refundRows(paid.paymentId)).length, 1);
  });

  it('records a refund Razorpay refuses as failed, and frees its amount', async () => {
    const paid = await paidPayment();
    razorpay.state.refundResult = () => ({
      outcome: 'rejected',
      reason: 'The refund amount is invalid',
    });

    const refused = await refund(finance, paid.paymentId, {
      reason: 'Provider will refuse',
    });
    assert.equal(refused.status, 201);
    assert.equal(refused.body.refund.status, 'FAILED');
    const [row] = await refundRows(paid.paymentId);
    assert.equal(row.status, 'FAILED');

    // The failed amount does not count against the payment
    razorpay.state.refundResult = request => ({
      outcome: 'created',
      refund: {
        id: 'rfnd_after_failure',
        status: 'pending',
        amountPaise: request.amountPaise,
      },
    });
    const retried = await refund(finance, paid.paymentId, {
      reason: 'Second attempt',
    });
    assert.equal(retried.status, 201);
    assert.equal(retried.body.refund.amountPaise, paid.amountPaise);
  });

  it('keeps a refund pending when Razorpay cannot be reached, and links it from the webhook', async () => {
    const paid = await paidPayment();
    razorpay.state.refundResult = () => ({ outcome: 'unknown' });

    const pending = await refund(finance, paid.paymentId, {
      amountPaise: 2000,
      reason: 'Network trouble',
    });
    assert.equal(pending.status, 201);
    assert.equal(pending.body.refund.status, 'PENDING');
    assert.equal(pending.body.refund.providerRefundId, null);
    const receipt = razorpay.refundRequests[0].receipt;

    await deliver(
      refundEvent('refund.created', {
        id: 'rfnd_linked_later',
        payment_id: paid.providerPaymentId,
        amount: 2000,
        status: 'pending',
        receipt,
      }),
    );
    const [row] = await refundRows(paid.paymentId);
    assert.equal(row.provider_refund_id, 'rfnd_linked_later');
    assert.equal(row.source, 'FINANCE_ADMIN');
  });

  it('records a refund made in the Razorpay dashboard, once, and keeps the final state', async () => {
    const paid = await paidPayment();
    const processed = refundEvent('refund.processed', {
      id: 'rfnd_dashboard_1',
      payment_id: paid.providerPaymentId,
      amount: 500,
      status: 'processed',
      receipt: null,
    });
    await deliver(processed);
    // A late "created" event never moves it back to pending
    await deliver(
      refundEvent('refund.created', {
        id: 'rfnd_dashboard_1',
        payment_id: paid.providerPaymentId,
        amount: 500,
        status: 'pending',
        receipt: null,
      }),
    );

    assert.deepEqual(await refundRows(paid.paymentId), [
      {
        amount_paise: 500,
        status: 'PROCESSED',
        source: 'PROVIDER_DASHBOARD',
        provider_refund_id: 'rfnd_dashboard_1',
        reason: null,
      },
    ]);
    const recorded = await server.db.all(
      `SELECT id FROM finance_audit_log
       WHERE action = 'REFUND_RECORDED' AND details->>'providerRefundId' = 'rfnd_dashboard_1'`,
    );
    assert.equal(recorded.length, 1);
  });

  it('refuses refunds to anyone but finance and super admins, and for unpaid payments', async () => {
    const paid = await paidPayment();
    assert.equal(
      (await refund(operations, paid.paymentId, { reason: 'No access' }))
        .status,
      403,
    );
    const student = server.createClient();
    await student.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'refund.student@example.com' }),
    );
    assert.equal(
      (await refund(student, paid.paymentId, { reason: 'No access' })).status,
      403,
    );
    assert.equal(
      (await refund(server.createClient(), paid.paymentId, { reason: 'x' }))
        .status,
      401,
    );
    assert.equal(
      (await refund(finance, 'payment_missing', { reason: 'Unknown payment' }))
        .status,
      404,
    );

    buyer += 1;
    const unpaid = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'PRE_REGISTRATION',
        topicId: PRE_REGISTER_TOPIC,
        fullName: 'Unpaid Buyer',
        email: `refund.unpaid${buyer}@example.com`,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    const notRefundable = await refund(
      finance,
      unpaid.body.checkout.paymentId,
      { reason: 'Nothing was paid' },
    );
    assert.equal(notRefundable.status, 409);
    assert.equal(notRefundable.body.code, 'PAYMENT_NOT_REFUNDABLE');
  });

  it('refuses, at the database, refunds that would exceed the captured amount', async () => {
    const paid = await paidPayment();
    await assert.rejects(
      () =>
        server.db.query(
          `INSERT INTO payment_refunds (id, payment_id, provider, amount_paise,
             currency, status, source, created_at, updated_at)
           VALUES ('direct-refund', $1, 'RAZORPAY', $2, 'INR', 'PROCESSED',
             'PROVIDER_DASHBOARD', NOW(), NOW())`,
          [paid.paymentId, paid.amountPaise + 1],
        ),
      (error: { code?: string }) => error.code === '23514',
    );
  });

  it('records disputes and their outcome', async () => {
    const paid = await paidPayment();
    const dispute = (event: string, entity: Record<string, unknown>) =>
      deliver({
        event,
        payload: {
          dispute: {
            entity: {
              id: 'disp_1',
              payment_id: paid.providerPaymentId,
              amount: paid.amountPaise,
              currency: 'INR',
              phase: 'chargeback',
              amount_deducted: 0,
              ...entity,
            },
          },
        },
      });

    await dispute('payment.dispute.created', { status: 'open' });
    await dispute('payment.dispute.lost', {
      status: 'lost',
      amount_deducted: paid.amountPaise,
    });

    const rows = await server.db.all<Record<string, unknown>>(
      `SELECT status, phase, amount_paise, amount_deducted_paise
       FROM payment_disputes WHERE payment_id = $1`,
      [paid.paymentId],
    );
    assert.deepEqual(rows, [
      {
        status: 'lost',
        phase: 'chargeback',
        amount_paise: paid.amountPaise,
        amount_deducted_paise: paid.amountPaise,
      },
    ]);

    await deliver({
      event: 'payment.dispute.created',
      payload: {
        dispute: {
          entity: {
            id: 'disp_unknown',
            payment_id: 'pay_not_ours',
            amount: 100,
            currency: 'INR',
            status: 'open',
            phase: 'chargeback',
          },
        },
      },
    });
    const unknown = await server.db.get<{ outcome: string }>(
      `SELECT outcome FROM payment_events
       WHERE provider_payment_id = 'pay_not_ours'`,
    );
    assert.equal(unknown?.outcome, 'UNKNOWN_PAYMENT');
  });
});

describe('payment expiry', () => {
  const HOUR_MS = 60 * 60 * 1000;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let razorpay: ReturnType<typeof createScriptedRazorpay>;
  let buyer = 0;

  before(async () => {
    razorpay = createScriptedRazorpay();
    server = await startTestServer({ paymentGateway: razorpay.gateway });
  });

  after(async () => {
    await server.close();
  });

  const checkout = async () => {
    buyer += 1;
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'PRE_REGISTRATION',
        topicId: PRE_REGISTER_TOPIC,
        fullName: 'Expiry Buyer',
        email: `expiry.buyer${buyer}@example.com`,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(response.status, 201);
    return {
      paymentId: String(response.body.checkout.paymentId),
      orderId: String(response.body.checkout.provider.orderId),
      amountPaise: Number(response.body.checkout.amount.amountPaise),
    };
  };

  const status = async (paymentId: string) =>
    (
      await server.db.get<{ status: string }>(
        'SELECT status FROM payments WHERE id = $1',
        [paymentId],
      )
    )?.status;

  it('expires an abandoned payment only after Razorpay confirms nothing was captured', async () => {
    const abandoned = await checkout();
    const capturedLate = await checkout();
    const unreachable = await checkout();
    razorpay.orderPayments.set(abandoned.orderId, [
      {
        id: 'pay_failed_attempt',
        orderId: abandoned.orderId,
        status: 'failed',
        amountPaise: abandoned.amountPaise,
        currency: 'INR',
      },
    ]);
    razorpay.orderPayments.set(capturedLate.orderId, [
      {
        id: 'pay_captured_late',
        orderId: capturedLate.orderId,
        status: 'captured',
        amountPaise: capturedLate.amountPaise,
        currency: 'INR',
      },
    ]);
    razorpay.orderPayments.set(unreachable.orderId, 'unreachable');

    // Too soon: nothing changes
    const started = server.clock.now();
    await expireStalePayments(
      { db: server.db, now: () => new Date(started.getTime() + HOUR_MS) },
      razorpay.gateway,
    );
    assert.equal(await status(abandoned.paymentId), 'CREATED');

    // After Razorpay's capture and late-authorisation window
    const later = () => new Date(started.getTime() + 5 * 24 * HOUR_MS);
    const result = await expireStalePayments(
      { db: server.db, now: later },
      razorpay.gateway,
    );

    assert.equal(await status(abandoned.paymentId), 'EXPIRED');
    assert.equal(await status(capturedLate.paymentId), 'PAID');
    assert.equal(await status(unreachable.paymentId), 'CREATED');
    assert.deepEqual(result, { expired: 1, captured: 1, skipped: 1 });

    const audit = await server.db.all(
      `SELECT id FROM finance_audit_log
       WHERE action = 'PAYMENT_EXPIRED' AND entity_id = $1`,
      [abandoned.paymentId],
    );
    assert.equal(audit.length, 1);

    // Running again changes nothing more
    const again = await expireStalePayments(
      { db: server.db, now: later },
      razorpay.gateway,
    );
    assert.deepEqual(again, { expired: 0, captured: 0, skipped: 1 });
  });
});
