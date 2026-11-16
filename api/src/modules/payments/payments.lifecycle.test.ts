import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import { startTestServer, type TestClient } from '../../test/testServer.js';
import {
  createRazorpayGateway,
  type PaymentGateway,
  type ProviderPayment,
} from './gateway.js';

const KEY_SECRET = 'rzp_test_secret';
const WEBHOOK_SECRET = 'whsec_test';
const PRE_REGISTER_TOPIC = 'topic_physics_wave_optics_class_12';

// Razorpay's real signature checks, with orders made locally and payment
// lookups answered from what each test says Razorpay holds
const createFakeRazorpay = () => {
  let orderNumber = 0;
  const remote = new Map<string, ProviderPayment>();
  const gateway: PaymentGateway = {
    ...createRazorpayGateway('rzp_test_key', KEY_SECRET),
    createOrder: async () => ({ orderId: `order_${(orderNumber += 1)}` }),
    fetchPayment: async paymentId => remote.get(paymentId) ?? null,
  };
  return { gateway, remote };
};

const sign = (orderId: string, paymentId: string) =>
  createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

const signWebhook = (body: unknown) =>
  createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

const paymentEvent = (
  event: string,
  entity: Record<string, unknown>,
): Record<string, unknown> => ({
  event,
  created_at: 1_790_000_000,
  payload: { payment: { entity } },
});

describe('payment lifecycle', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let razorpay: TestClient;
  let fake: ReturnType<typeof createFakeRazorpay>;
  let buyer = 0;

  before(async () => {
    fake = createFakeRazorpay();
    server = await startTestServer({
      paymentGateway: fake.gateway,
      razorpayWebhookSecret: WEBHOOK_SECRET,
    });
    razorpay = server.createClient();
  });

  after(async () => {
    await server.close();
  });

  beforeEach(() => {
    fake.remote.clear();
  });

  // A fresh guest checkout for a pre-registration (each buyer has their own
  // email, so no test shares a seat with another)
  const checkout = async () => {
    buyer += 1;
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'PRE_REGISTRATION',
        topicId: PRE_REGISTER_TOPIC,
        fullName: 'Lifecycle Buyer',
        email: `lifecycle.buyer${buyer}@example.com`,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
      });
    assert.equal(response.status, 201);
    const { paymentId, provider, amount } = response.body.checkout;
    return {
      paymentId: String(paymentId),
      orderId: String(provider.orderId),
      amountPaise: Number(amount.amountPaise),
    };
  };

  const verify = (
    order: { paymentId: string; orderId: string },
    providerPaymentId: string,
  ) =>
    server.createClient().request('POST', '/api/payments/verify', {
      paymentId: order.paymentId,
      providerOrderId: order.orderId,
      providerPaymentId,
      signature: sign(order.orderId, providerPaymentId),
    });

  const deliver = (body: Record<string, unknown>, eventId: string) =>
    razorpay.request('POST', '/api/payments/webhook', body, {
      'X-Razorpay-Signature': signWebhook(body),
      'X-Razorpay-Event-Id': eventId,
    });

  const state = async (paymentId: string) => {
    const row = await server.db.get<Record<string, unknown>>(
      `SELECT p.status, p.provider_payment_id, p.paid_at, p.authorized_at,
              p.failed_at, p.failure_code, r.status AS seat_status
       FROM payments p
       JOIN pre_registrations r ON r.id = p.pre_registration_id
       WHERE p.id = $1`,
      [paymentId],
    );
    assert.ok(row, 'payment exists');
    return row;
  };

  const events = (paymentId: string) =>
    server.db.all<Record<string, unknown>>(
      `SELECT source, event_type, outcome FROM payment_events
       WHERE payment_id = $1 ORDER BY received_at, id`,
      [paymentId],
    );

  it('confirms a seat only once Razorpay reports the payment captured', async () => {
    const order = await checkout();

    // Signed by Razorpay but not yet captured: authorised, seat still held
    fake.remote.set('pay_auth_1', {
      id: 'pay_auth_1',
      orderId: order.orderId,
      status: 'authorized',
      amountPaise: order.amountPaise,
      currency: 'INR',
    });
    const authorised = await verify(order, 'pay_auth_1');
    assert.equal(authorised.status, 200);
    assert.equal(authorised.body.payment.status, 'AUTHORIZED');
    let row = await state(order.paymentId);
    assert.equal(row.status, 'AUTHORIZED');
    assert.equal(row.seat_status, 'PENDING_PAYMENT');
    assert.equal(row.paid_at, null);
    assert.notEqual(row.authorized_at, null);

    // Razorpay captures it: the webhook completes the sale
    const captured = await deliver(
      paymentEvent('payment.captured', {
        id: 'pay_auth_1',
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        status: 'captured',
      }),
      'evt_capture_1',
    );
    assert.equal(captured.status, 200);
    row = await state(order.paymentId);
    assert.equal(row.status, 'PAID');
    assert.equal(row.seat_status, 'CONFIRMED');
    assert.notEqual(row.paid_at, null);
  });

  it('confirms at once when the payment fetched from Razorpay is already captured', async () => {
    const order = await checkout();
    fake.remote.set('pay_fast_1', {
      id: 'pay_fast_1',
      orderId: order.orderId,
      status: 'captured',
      amountPaise: order.amountPaise,
      currency: 'INR',
    });

    const verified = await verify(order, 'pay_fast_1');
    assert.equal(verified.body.payment.status, 'PAID');
    assert.equal((await state(order.paymentId)).seat_status, 'CONFIRMED');
    assert.deepEqual(
      (await events(order.paymentId)).map(event => event.source),
      ['CHECKOUT_SIGNATURE', 'API_FETCH'],
    );
  });

  it('never confirms from a fetched payment whose order, amount or currency differ', async () => {
    for (const [index, mismatch] of [
      { orderId: 'order_someone_else' },
      { amountPaise: 1 },
      { currency: 'USD' },
    ].entries()) {
      const order = await checkout();
      const providerPaymentId = `pay_mismatch_${index}`;
      fake.remote.set(providerPaymentId, {
        id: providerPaymentId,
        orderId: order.orderId,
        status: 'captured',
        amountPaise: order.amountPaise,
        currency: 'INR',
        ...mismatch,
      });

      const verified = await verify(order, providerPaymentId);
      assert.equal(verified.body.payment.status, 'AUTHORIZED');
      const row = await state(order.paymentId);
      assert.equal(row.status, 'AUTHORIZED', JSON.stringify(mismatch));
      assert.equal(row.seat_status, 'PENDING_PAYMENT');
    }
  });

  it('stays authorised when Razorpay cannot be reached, and the webhook completes it', async () => {
    const order = await checkout();
    // No remote record: the lookup fails
    const verified = await verify(order, 'pay_offline_1');
    assert.equal(verified.body.payment.status, 'AUTHORIZED');

    await deliver(
      paymentEvent('order.paid', {
        id: 'pay_offline_1',
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        status: 'captured',
      }),
      'evt_order_paid_1',
    );
    assert.equal((await state(order.paymentId)).status, 'PAID');
  });

  it('applies a webhook delivered twice only once', async () => {
    const order = await checkout();
    const body = paymentEvent('payment.captured', {
      id: 'pay_dup_1',
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: 'INR',
      status: 'captured',
    });

    const first = await deliver(body, 'evt_dup_1');
    const second = await deliver(body, 'evt_dup_1');
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);

    const stored = await server.db.all(
      "SELECT id FROM payment_events WHERE event_id = 'evt_dup_1'",
    );
    assert.equal(stored.length, 1);
    assert.equal((await state(order.paymentId)).status, 'PAID');
  });

  it('keeps a captured payment captured when older events arrive late', async () => {
    const order = await checkout();
    await deliver(
      paymentEvent('payment.captured', {
        id: 'pay_late_1',
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        status: 'captured',
      }),
      'evt_late_capture',
    );

    for (const [event, eventId] of [
      ['payment.authorized', 'evt_late_authorized'],
      ['payment.failed', 'evt_late_failed'],
    ]) {
      const late = await deliver(
        paymentEvent(event, {
          id: 'pay_late_1',
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: 'INR',
          status: event === 'payment.failed' ? 'failed' : 'authorized',
        }),
        eventId,
      );
      assert.equal(late.status, 200);
    }

    const row = await state(order.paymentId);
    assert.equal(row.status, 'PAID');
    assert.equal(row.seat_status, 'CONFIRMED');
    assert.deepEqual(
      (await events(order.paymentId)).map(event => event.outcome),
      ['APPLIED', 'IGNORED_STALE', 'IGNORED_STALE'],
    );
  });

  it('records a failure, and still accepts a later capture of the same payment', async () => {
    const order = await checkout();
    await deliver(
      paymentEvent('payment.failed', {
        id: 'pay_retry_1',
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Payment was declined by the bank',
      }),
      'evt_failed_1',
    );
    let row = await state(order.paymentId);
    assert.equal(row.status, 'FAILED');
    assert.equal(row.failure_code, 'BAD_REQUEST_ERROR');
    assert.equal(row.seat_status, 'PENDING_PAYMENT');

    // Razorpay documents a captured payment after a failure (a UPI retry)
    await deliver(
      paymentEvent('payment.captured', {
        id: 'pay_retry_1',
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        status: 'captured',
      }),
      'evt_capture_after_failure',
    );
    row = await state(order.paymentId);
    assert.equal(row.status, 'PAID');
    assert.equal(row.seat_status, 'CONFIRMED');
  });

  it('rejects a captured event whose currency or amount differ, recording why', async () => {
    const order = await checkout();
    for (const [eventId, change] of [
      ['evt_wrong_currency', { currency: 'USD' }],
      ['evt_wrong_amount', { amount: order.amountPaise + 1 }],
    ] as const) {
      const entity: Record<string, unknown> = {
        id: 'pay_wrong_1',
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        status: 'captured',
      };
      const response = await deliver(
        paymentEvent('payment.captured', Object.assign(entity, change)),
        eventId,
      );
      assert.equal(response.status, 200);
    }

    assert.equal((await state(order.paymentId)).status, 'CREATED');
    assert.deepEqual(
      (await events(order.paymentId)).map(event => event.outcome),
      ['REJECTED_MISMATCH', 'REJECTED_MISMATCH'],
    );
  });

  it('stores events for unknown orders and refund or dispute events without acting on them yet', async () => {
    const unknown = await deliver(
      paymentEvent('payment.captured', {
        id: 'pay_unknown_1',
        order_id: 'order_not_ours',
        amount: 100,
        currency: 'INR',
        status: 'captured',
      }),
      'evt_unknown_order',
    );
    assert.equal(unknown.status, 200);

    const refund = await deliver(
      {
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: 'rfnd_1',
              payment_id: 'pay_unknown_1',
              amount: 100,
              currency: 'INR',
              status: 'processed',
            },
          },
        },
      },
      'evt_refund_1',
    );
    assert.equal(refund.status, 200);

    const stored = await server.db.all<Record<string, unknown>>(
      `SELECT event_id, outcome, payment_id FROM payment_events
       WHERE event_id IN ('evt_unknown_order', 'evt_refund_1') ORDER BY event_id`,
    );
    assert.deepEqual(stored, [
      { event_id: 'evt_refund_1', outcome: 'RECORDED', payment_id: null },
      {
        event_id: 'evt_unknown_order',
        outcome: 'UNKNOWN_ORDER',
        payment_id: null,
      },
    ]);
  });

  it('stores only the fields it needs, never card, UPI, email or phone details', async () => {
    const order = await checkout();
    await deliver(
      paymentEvent('payment.captured', {
        id: 'pay_private_1',
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
        email: 'private.person@example.com',
        contact: '+919999999999',
        vpa: 'private@upi',
        card: { last4: '4242', network: 'Visa' },
        bank: 'HDFC',
      }),
      'evt_private_1',
    );

    const row = await server.db.get<{ payload: unknown }>(
      "SELECT payload FROM payment_events WHERE event_id = 'evt_private_1'",
    );
    const stored = JSON.stringify(row?.payload);
    for (const secret of [
      'private.person@example.com',
      '+919999999999',
      'private@upi',
      '4242',
      'HDFC',
    ]) {
      assert.ok(!stored.includes(secret), `${secret} is not stored`);
    }
    assert.ok(stored.includes('pay_private_1'));
    assert.ok(stored.includes('upi'), 'the payment method is kept');
  });

  it('flags a second captured payment for a seat that is already confirmed', async () => {
    // Two orders for the same seat (a retry), both captured by Razorpay
    buyer += 1;
    const email = `lifecycle.double${buyer}@example.com`;
    const start = async () => {
      const response = await server
        .createClient()
        .request('POST', '/api/payments/checkout', {
          kind: 'PRE_REGISTRATION',
          topicId: PRE_REGISTER_TOPIC,
          fullName: 'Double Payer',
          email,
          mobile: '+91 98765 43210',
          state: 'Rajasthan',
          city: 'Jaipur',
        });
      assert.equal(response.status, 201);
      return response.body.checkout;
    };
    const first = await start();
    const second = await start();

    for (const [index, item] of [first, second].entries()) {
      await deliver(
        paymentEvent('payment.captured', {
          id: `pay_double_${index}`,
          order_id: item.provider.orderId,
          amount: item.amount.amountPaise,
          currency: 'INR',
          status: 'captured',
        }),
        `evt_double_${index}`,
      );
    }

    // The money was taken twice: both are recorded truthfully, and the
    // second is flagged so the team can refund it
    const outcomes = await server.db.all<Record<string, unknown>>(
      `SELECT p.status, e.outcome FROM payments p
       JOIN payment_events e ON e.payment_id = p.id AND e.source = 'WEBHOOK'
       WHERE p.id IN ($1, $2) ORDER BY e.received_at, e.id`,
      [first.paymentId, second.paymentId],
    );
    assert.deepEqual(outcomes, [
      { status: 'PAID', outcome: 'APPLIED' },
      { status: 'PAID', outcome: 'CAPTURED_FOR_CONFIRMED_SEAT' },
    ]);
  });
});
