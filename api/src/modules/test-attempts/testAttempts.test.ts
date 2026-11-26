import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  createFakeRazorpay,
  FAKE_RAZORPAY_KEY_SECRET as KEY_SECRET,
} from '../../test/fakeRazorpay.js';
import {
  startTestServer,
  type TestClient,
  SIGN_UP_CONTACT,
} from '../../test/testServer.js';

const GST_TOPIC = 'topic_accounts_gst_class_11';
// A roster topic: live classes, no topic test
const CLASS_TOPIC = 'topic_accountancy_rectification_of_errors_class_11';
const MINUTE_MS = 60 * 1000;

const BILLING = {
  fullName: 'Meera Iyer',
  email: 'meera@example.com',
  mobile: '+91 98765 43210',
  state: 'Karnataka',
  city: 'Bengaluru',
  customerType: 'INDIVIDUAL',
  addressLine1: '4 MG Road',
  pinCode: '560001',
};

const sign = (orderId: string, paymentId: string) =>
  createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

type Topic = { id: string; testPrice: { amountPaise: number } | null };

describe('topic test attempts', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let student: TestClient;
  let paymentCount = 0;

  const signUp = async (email: string) => {
    const client = server.createClient();
    const response = await client.request('POST', '/api/auth/sign-up', {
      fullName: 'Meera Iyer',
      email,
      password: 'correct-horse-1',
      ...SIGN_UP_CONTACT,
    });
    assert.equal(response.status, 201);
    return client;
  };

  // Buys one attempt at the GST test and pays for it
  const buyAttempt = async (client: TestClient) => {
    const checkout = await client.request('POST', '/api/payments/checkout', {
      kind: 'TEST_ATTEMPT',
      topicId: GST_TOPIC,
      ...BILLING,
    });
    assert.equal(checkout.status, 201);
    const { paymentId, provider } = checkout.body.checkout;
    paymentCount += 1;
    const providerPaymentId = `pay_test_${paymentCount}`;
    const verified = await client.request('POST', '/api/payments/verify', {
      paymentId,
      providerOrderId: provider.orderId,
      providerPaymentId,
      signature: sign(provider.orderId, providerPaymentId),
    });
    assert.equal(verified.body.payment.status, 'PAID');
    return checkout.body.checkout;
  };

  const attemptsFor = async (client: TestClient) =>
    (
      await client.request(
        'GET',
        `/api/test-attempts?topicId=${encodeURIComponent(GST_TOPIC)}`,
      )
    ).body.attempts as {
      id: string;
      startedAt: string | null;
      endsAt: string | null;
    }[];

  before(async () => {
    server = await startTestServer({ paymentGateway: createFakeRazorpay() });
    student = await signUp('meera@example.com');
  });

  after(async () => {
    await server.close();
  });

  it('prices the topic tests at ₹5 and leaves class topics without one', async () => {
    const response = await student.request('GET', '/api/catalogue');
    const topics: Topic[] = response.body.subjects.flatMap(
      (subject: { chapters: { topics: Topic[] }[] }) =>
        subject.chapters.flatMap(chapter => chapter.topics),
    );
    const byId = new Map(topics.map(topic => [topic.id, topic]));

    assert.equal(byId.get(GST_TOPIC)?.testPrice?.amountPaise, 500);
    assert.equal(byId.get(CLASS_TOPIC)?.testPrice, null);
    assert.equal(topics.filter(topic => topic.testPrice !== null).length, 8);
  });

  it('needs a signed-in student to buy an attempt', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'TEST_ATTEMPT',
        topicId: GST_TOPIC,
        ...BILLING,
      });
    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHENTICATED');
  });

  it('refuses a topic without a test', async () => {
    const response = await student.request('POST', '/api/payments/checkout', {
      kind: 'TEST_ATTEMPT',
      topicId: CLASS_TOPIC,
      ...BILLING,
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'TEST_NOT_AVAILABLE');
  });

  it('sells one 45-minute attempt for ₹5, listed once it is paid', async () => {
    const checkout = await student.request('POST', '/api/payments/checkout', {
      kind: 'TEST_ATTEMPT',
      topicId: GST_TOPIC,
      ...BILLING,
    });
    assert.equal(checkout.status, 201);
    assert.equal(checkout.body.checkout.kind, 'TEST_ATTEMPT');
    assert.equal(checkout.body.checkout.amount.amountPaise, 500);
    assert.equal(checkout.body.checkout.batch, null);
    // Not paid yet: nothing to take
    assert.deepEqual(await attemptsFor(student), []);

    const { paymentId, provider } = checkout.body.checkout;
    const verified = await student.request('POST', '/api/payments/verify', {
      paymentId,
      providerOrderId: provider.orderId,
      providerPaymentId: 'pay_first_attempt',
      signature: sign(provider.orderId, 'pay_first_attempt'),
    });
    assert.equal(verified.body.payment.status, 'PAID');

    const attempts = await attemptsFor(student);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].startedAt, null);

    // An unused attempt must be taken before another is bought
    const again = await student.request('POST', '/api/payments/checkout', {
      kind: 'TEST_ATTEMPT',
      topicId: GST_TOPIC,
      ...BILLING,
    });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'TEST_ATTEMPT_AVAILABLE');
  });

  it('starts the clock on the server, resumes it, and ends it on submit', async () => {
    const [attempt] = await attemptsFor(student);

    // Another student cannot use it
    const stranger = await signUp('ravi@example.com');
    const stolen = await stranger.request(
      'POST',
      `/api/test-attempts/${attempt.id}/start`,
      {},
    );
    assert.equal(stolen.status, 404);

    const started = await student.request(
      'POST',
      `/api/test-attempts/${attempt.id}/start`,
      {},
    );
    assert.equal(started.status, 200);
    const { startedAt, endsAt } = started.body.attempt;
    assert.equal(
      new Date(endsAt).getTime() - new Date(startedAt).getTime(),
      45 * MINUTE_MS,
    );

    // Coming back carries on the same clock
    const resumed = await student.request(
      'POST',
      `/api/test-attempts/${attempt.id}/start`,
      {},
    );
    assert.equal(resumed.body.attempt.endsAt, endsAt);

    const finished = await student.request(
      'POST',
      `/api/test-attempts/${attempt.id}/finish`,
      {},
    );
    assert.equal(finished.status, 200);
    assert.ok(new Date(finished.body.attempt.endsAt) <= new Date());

    const reused = await student.request(
      'POST',
      `/api/test-attempts/${attempt.id}/start`,
      {},
    );
    assert.equal(reused.status, 409);
    assert.equal(reused.body.code, 'TEST_ATTEMPT_USED');

    // A used attempt does not block buying the next one
    const next = await buyAttempt(student);
    assert.equal(next.amount.amountPaise, 500);
    assert.equal((await attemptsFor(student)).length, 2);
  });

  it('accepts nothing in the start body', async () => {
    const [attempt] = await attemptsFor(student);
    const response = await student.request(
      'POST',
      `/api/test-attempts/${attempt.id}/start`,
      { endsAt: '2099-01-01T00:00:00.000Z' },
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'REQUEST_VALIDATION_FAILED');
  });

  it('keeps attempts private to their student', async () => {
    const response = await server
      .createClient()
      .request('GET', '/api/test-attempts');
    assert.equal(response.status, 401);
  });
});
