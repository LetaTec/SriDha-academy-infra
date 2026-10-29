import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
  validRegistration,
  type TestClient,
} from '../../test/testServer.js';
import {
  createRazorpayGateway,
  type PaymentGateway,
} from '../payments/gateway.js';

const KEY_SECRET = 'rzp_test_secret';
const WEBHOOK_SECRET = 'whsec_test';
const BATCH = 'batch_gst_class_11_december';
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

const signPayment = (orderId: string, paymentId: string) =>
  createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

describe('payment confirmations, pre-registrations and team orders', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let student: TestClient;
  let admin: TestClient;

  before(async () => {
    server = await startTestServer({
      paymentGateway: createFakeRazorpay(),
      razorpayWebhookSecret: WEBHOOK_SECRET,
    });
    student = server.createClient();
    await student.request('POST', '/api/auth/register', validRegistration());

    // Super admins sign in with an emailed one-time link
    admin = server.createClient();
    await admin.request('POST', '/api/auth/admin-sign-in', {
      email: TEST_SUPER_ADMIN_EMAIL,
    });
    const link = server.sentSignInLinks.at(-1);
    const token = new URL(link?.signInUrl ?? 'http://x').searchParams.get(
      'token',
    );
    const signedIn = await admin.request(
      'POST',
      '/api/auth/admin-sign-in/confirm',
      { token },
    );
    assert.equal(signedIn.status, 200);
  });

  after(async () => {
    await server.close();
  });

  it('emails the student once when a payment is confirmed', async () => {
    const checkout = await student.request('POST', '/api/payments/checkout', {
      kind: 'ENROLMENT',
      batchId: BATCH,
      ...BILLING,
    });
    const { paymentId, provider } = checkout.body.checkout;

    const verified = await student.request('POST', '/api/payments/verify', {
      paymentId,
      providerOrderId: provider.orderId,
      providerPaymentId: 'pay_email_1',
      signature: signPayment(provider.orderId, 'pay_email_1'),
    });
    assert.equal(verified.status, 200);

    // Razorpay's webhook for the same payment must not send a second email
    const event = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_email_1',
            order_id: provider.orderId,
            amount: 12900,
          },
        },
      },
    };
    await server
      .createClient()
      .request('POST', '/api/payments/webhook', event, {
        'X-Razorpay-Signature': createHmac('sha256', WEBHOOK_SECRET)
          .update(JSON.stringify(event))
          .digest('hex'),
      });

    assert.equal(server.sentPaymentConfirmations.length, 1);
    const [email] = server.sentPaymentConfirmations;
    assert.equal(email.email, BILLING.email);
    assert.equal(email.topic, 'Learn GST for Class 11');
    assert.equal(email.batch, 'December batch');
  });

  it("lists the student's own pre-registrations", async () => {
    await student.request('POST', '/api/payments/checkout', {
      kind: 'PRE_REGISTRATION',
      topicId: PRE_REGISTER_TOPIC,
      ...BILLING,
    });

    const response = await student.request('GET', '/api/pre-registrations');
    assert.equal(response.status, 200);
    assert.equal(response.body.preRegistrations.length, 1);
    const [preRegistration] = response.body.preRegistrations;
    assert.equal(preRegistration.status, 'PENDING_PAYMENT');
    assert.equal(preRegistration.topic.id, PRE_REGISTER_TOPIC);
    assert.equal(preRegistration.topic.price.amountPaise, 12900);
  });

  it('keeps team orders from students and signed-out visitors', async () => {
    const asStudent = await student.request('GET', '/api/admin/orders');
    assert.equal(asStudent.status, 403);
    assert.equal(asStudent.body.code, 'FORBIDDEN');

    const signedOut = await server
      .createClient()
      .request('GET', '/api/admin/orders');
    assert.equal(signedOut.status, 401);
  });

  it('shows super admins every order, newest first', async () => {
    const response = await admin.request('GET', '/api/admin/orders');
    assert.equal(response.status, 200);

    const [newest, older] = response.body.orders;
    assert.equal(newest.kind, 'PRE_REGISTRATION');
    assert.equal(newest.status, 'CREATED');
    assert.equal(newest.seatStatus, 'PENDING_PAYMENT');
    assert.equal(older.kind, 'ENROLMENT');
    assert.equal(older.status, 'PAID');
    assert.equal(older.batch, 'December batch');
    assert.equal(older.providerPaymentId, 'pay_email_1');
    assert.equal(older.student.accountEmail, 'asha@example.com');
  });
});
