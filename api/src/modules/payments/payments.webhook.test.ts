import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  validRegistration,
  type TestClient,
} from '../../test/testServer.js';
import { createRazorpayGateway, type PaymentGateway } from './gateway.js';

const KEY_SECRET = 'rzp_test_secret';
const WEBHOOK_SECRET = 'whsec_test';
const PRE_REGISTER_TOPIC = 'topic_physics_wave_optics_class_12';
const BILLING = {
  fullName: 'Asha Verma',
  email: 'asha@example.com',
  mobile: '+91 98765 43210',
};

const createFakeRazorpay = (): PaymentGateway => {
  let orderNumber = 0;
  return {
    ...createRazorpayGateway('rzp_test_key', KEY_SECRET),
    createOrder: async () => ({ orderId: `order_${(orderNumber += 1)}` }),
  };
};

// The body Razorpay posts when a payment is captured
const capturedEvent = (orderId: string, amount: number) => ({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_webhook_1',
        order_id: orderId,
        amount,
        status: 'captured',
      },
    },
  },
});

// The test client sends JSON.stringify(body), so this signs the same bytes
const signWebhook = (body: unknown, secret = WEBHOOK_SECRET) =>
  createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

describe('Razorpay webhook', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let student: TestClient;
  let razorpay: TestClient;

  before(async () => {
    server = await startTestServer({
      paymentGateway: createFakeRazorpay(),
      razorpayWebhookSecret: WEBHOOK_SECRET,
    });
    student = server.createClient();
    await student.request('POST', '/api/auth/register', validRegistration());
    // Razorpay calls the API server to server, with no session
    razorpay = server.createClient();
  });

  after(async () => {
    await server.close();
  });

  const startCheckout = async () => {
    const response = await student.request('POST', '/api/payments/checkout', {
      kind: 'PRE_REGISTRATION',
      topicId: PRE_REGISTER_TOPIC,
      ...BILLING,
    });
    assert.equal(response.status, 201);
    return response.body.checkout;
  };

  const preRegistrationStatus = async () => {
    const row = await server.db.get<{ status: string }>(
      'SELECT status FROM pre_registrations WHERE topic_id = $1',
      [PRE_REGISTER_TOPIC],
    );
    return row?.status;
  };

  it('rejects a body without a valid signature', async () => {
    const checkout = await startCheckout();
    const body = capturedEvent(checkout.provider.orderId, 12900);

    const unsigned = await razorpay.request(
      'POST',
      '/api/payments/webhook',
      body,
    );
    assert.equal(unsigned.status, 400);
    assert.equal(unsigned.body.code, 'WEBHOOK_SIGNATURE_INVALID');

    const forged = await razorpay.request(
      'POST',
      '/api/payments/webhook',
      body,
      {
        'X-Razorpay-Signature': signWebhook(body, 'not-the-secret'),
      },
    );
    assert.equal(forged.status, 400);
    assert.equal(await preRegistrationStatus(), 'PENDING_PAYMENT');
  });

  it('ignores a captured amount that does not match the order', async () => {
    const checkout = await startCheckout();
    const body = capturedEvent(checkout.provider.orderId, 100);

    const response = await razorpay.request(
      'POST',
      '/api/payments/webhook',
      body,
      {
        'X-Razorpay-Signature': signWebhook(body),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(await preRegistrationStatus(), 'PENDING_PAYMENT');
  });

  it('confirms the seat when Razorpay reports the payment captured', async () => {
    const checkout = await startCheckout();
    const body = capturedEvent(checkout.provider.orderId, 12900);
    const headers = { 'X-Razorpay-Signature': signWebhook(body) };

    const response = await razorpay.request(
      'POST',
      '/api/payments/webhook',
      body,
      headers,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { received: true });
    assert.equal(await preRegistrationStatus(), 'CONFIRMED');

    const payment = await server.db.get<{
      status: string;
      provider_payment_id: string;
    }>('SELECT status, provider_payment_id FROM payments WHERE id = $1', [
      checkout.paymentId,
    ]);
    assert.equal(payment?.status, 'PAID');
    assert.equal(payment?.provider_payment_id, 'pay_webhook_1');

    // Razorpay retries deliveries; a repeat changes nothing
    const repeat = await razorpay.request(
      'POST',
      '/api/payments/webhook',
      body,
      headers,
    );
    assert.equal(repeat.status, 200);
  });

  it('acknowledges events for unknown orders and other event types', async () => {
    const unknown = capturedEvent('order_unknown', 12900);
    const unknownResponse = await razorpay.request(
      'POST',
      '/api/payments/webhook',
      unknown,
      { 'X-Razorpay-Signature': signWebhook(unknown) },
    );
    assert.equal(unknownResponse.status, 200);

    const failed = { event: 'payment.failed', payload: {} };
    const failedResponse = await razorpay.request(
      'POST',
      '/api/payments/webhook',
      failed,
      { 'X-Razorpay-Signature': signWebhook(failed) },
    );
    assert.equal(failedResponse.status, 200);
  });
});

describe('Razorpay webhook without a secret', () => {
  it('reports that webhooks are not configured', async () => {
    const server = await startTestServer();
    try {
      const response = await server
        .createClient()
        .request('POST', '/api/payments/webhook', {
          event: 'payment.captured',
        });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, 'WEBHOOK_UNAVAILABLE');
    } finally {
      await server.close();
    }
  });
});
