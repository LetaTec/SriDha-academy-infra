import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  validRegistration,
  type TestClient,
} from '../../test/testServer.js';
import { createRazorpayGateway, type PaymentGateway } from './gateway.js';

const KEY_ID = 'rzp_test_key';
const KEY_SECRET = 'rzp_test_secret';
const DECEMBER_BATCH = 'batch_gst_class_11_december';
const OPEN_TOPIC = 'topic_accounts_gst_class_11';
const PRE_REGISTER_TOPIC = 'topic_physics_wave_optics_class_12';

const BILLING = {
  fullName: 'Asha Verma',
  email: 'asha@example.com',
  mobile: '+91 98765 43210',
};

// Razorpay's real signature check, with orders made locally instead of
// through Razorpay's API
const createFakeRazorpay = (): PaymentGateway => {
  let orderNumber = 0;
  return {
    ...createRazorpayGateway(KEY_ID, KEY_SECRET),
    createOrder: async () => ({ orderId: `order_${(orderNumber += 1)}` }),
  };
};

const sign = (orderId: string, paymentId: string) =>
  createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

describe('payments', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let student: TestClient;
  let otherStudent: TestClient;

  before(async () => {
    server = await startTestServer({ paymentGateway: createFakeRazorpay() });
    student = server.createClient();
    await student.request('POST', '/api/auth/register', validRegistration());
    otherStudent = server.createClient();
    await otherStudent.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'ravi@example.com', fullName: 'Ravi Shah' }),
    );
  });

  after(async () => {
    await server.close();
  });

  it('prices every topic in the catalogue', async () => {
    const response = await student.request('GET', '/api/catalogue');
    const topics = response.body.subjects.flatMap(
      (subject: { chapters: { topics: { price: unknown }[] }[] }) =>
        subject.chapters.flatMap(chapter => chapter.topics),
    );

    assert.ok(topics.length >= 100);
    assert.ok(
      topics.every((topic: { price: unknown }) => topic.price !== null),
    );
  });

  it('requires a signed-in student', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: DECEMBER_BATCH,
        ...BILLING,
      });

    assert.equal(response.status, 401);
  });

  it('rejects a client-chosen amount or student', async () => {
    const response = await student.request('POST', '/api/payments/checkout', {
      kind: 'ENROLMENT',
      batchId: DECEMBER_BATCH,
      amountPaise: 100,
      ...BILLING,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'REQUEST_VALIDATION_FAILED');
  });

  it('enrols with the catalogue fee and confirms only a signed payment', async () => {
    const checkout = await student.request('POST', '/api/payments/checkout', {
      kind: 'ENROLMENT',
      batchId: DECEMBER_BATCH,
      ...BILLING,
    });

    assert.equal(checkout.status, 201);
    const { paymentId, amount, provider, batch, topic } =
      checkout.body.checkout;
    assert.equal(amount.amountPaise, 12900);
    assert.equal(provider.name, 'RAZORPAY');
    assert.equal(provider.keyId, KEY_ID);
    assert.equal(batch.id, DECEMBER_BATCH);
    assert.equal(topic.id, OPEN_TOPIC);

    const forged = await student.request('POST', '/api/payments/verify', {
      paymentId,
      providerOrderId: provider.orderId,
      providerPaymentId: 'pay_1',
      signature: 'not-a-signature',
    });
    assert.equal(forged.status, 400);
    assert.equal(forged.body.code, 'PAYMENT_VERIFICATION_FAILED');

    const someoneElse = await otherStudent.request(
      'POST',
      '/api/payments/verify',
      {
        paymentId,
        providerOrderId: provider.orderId,
        providerPaymentId: 'pay_1',
        signature: sign(provider.orderId, 'pay_1'),
      },
    );
    assert.equal(someoneElse.status, 404);

    const verified = await student.request('POST', '/api/payments/verify', {
      paymentId,
      providerOrderId: provider.orderId,
      providerPaymentId: 'pay_1',
      signature: sign(provider.orderId, 'pay_1'),
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.payment.status, 'PAID');

    const enrolments = await student.request('GET', '/api/enrolments');
    const enrolment = enrolments.body.enrolments.find(
      (item: { batch: { id: string } }) => item.batch.id === DECEMBER_BATCH,
    );
    assert.equal(enrolment.status, 'CONFIRMED');

    const again = await student.request('POST', '/api/payments/checkout', {
      kind: 'ENROLMENT',
      batchId: DECEMBER_BATCH,
      ...BILLING,
    });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'ALREADY_ENROLLED');
  });

  it('pre-registers for a topic without batches at the full fee', async () => {
    const checkout = await student.request('POST', '/api/payments/checkout', {
      kind: 'PRE_REGISTRATION',
      topicId: PRE_REGISTER_TOPIC,
      ...BILLING,
    });

    assert.equal(checkout.status, 201);
    assert.equal(checkout.body.checkout.amount.amountPaise, 12900);
    assert.equal(checkout.body.checkout.batch, null);

    // Retrying reuses the same pre-registration with a fresh order
    const retry = await student.request('POST', '/api/payments/checkout', {
      kind: 'PRE_REGISTRATION',
      topicId: PRE_REGISTER_TOPIC,
      ...BILLING,
    });
    assert.equal(retry.status, 201);
    assert.notEqual(
      retry.body.checkout.provider.orderId,
      checkout.body.checkout.provider.orderId,
    );
  });

  it('sends students with open batches to enrol instead of pre-registering', async () => {
    const response = await student.request('POST', '/api/payments/checkout', {
      kind: 'PRE_REGISTRATION',
      topicId: OPEN_TOPIC,
      ...BILLING,
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'PRE_REGISTRATION_CLOSED');
  });

  it('reports unknown topics', async () => {
    const response = await student.request('POST', '/api/payments/checkout', {
      kind: 'PRE_REGISTRATION',
      topicId: 'topic_missing',
      ...BILLING,
    });

    assert.equal(response.status, 404);
    assert.equal(response.body.code, 'TOPIC_NOT_FOUND');
  });
});

describe('payments without Razorpay keys', () => {
  it('saves the order as payment pending and never confirms it', async () => {
    const server = await startTestServer();
    try {
      const student = server.createClient();
      await student.request('POST', '/api/auth/register', validRegistration());
      const checkout = await student.request('POST', '/api/payments/checkout', {
        kind: 'PRE_REGISTRATION',
        topicId: PRE_REGISTER_TOPIC,
        ...BILLING,
      });

      assert.equal(checkout.status, 201);
      const { paymentId, provider } = checkout.body.checkout;
      assert.equal(provider.name, 'TEST');
      assert.equal(provider.keyId, null);

      const verify = await student.request('POST', '/api/payments/verify', {
        paymentId,
        providerOrderId: provider.orderId,
        providerPaymentId: 'pay_test',
        signature: 'anything',
      });
      assert.equal(verify.status, 400);
    } finally {
      await server.close();
    }
  });
});
