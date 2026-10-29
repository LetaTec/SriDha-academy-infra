import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  validRegistration,
  type TestClient,
} from '../../test/testServer.js';
import { SEAT_HOLD_MINUTES } from '../catalogue/catalogue.repository.js';
import { createRazorpayGateway, type PaymentGateway } from './gateway.js';

const KEY_SECRET = 'rzp_test_secret';
const BATCH = 'batch_gst_class_11_december';
const START = new Date('2026-10-10T09:00:00Z');
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

const minutesLater = (minutes: number) =>
  new Date(START.getTime() + minutes * 60 * 1000);

describe('unpaid seat holds', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let asha: TestClient;
  let ravi: TestClient;

  const checkout = (client: TestClient) =>
    client.request('POST', '/api/payments/checkout', {
      kind: 'ENROLMENT',
      batchId: BATCH,
      ...BILLING,
    });

  const batchAvailability = async () => {
    const response = await asha.request('GET', '/api/catalogue');
    const batch = response.body.subjects
      .flatMap(
        (subject: { chapters: { topics: { batches: unknown[] }[] }[] }) =>
          subject.chapters.flatMap(chapter =>
            chapter.topics.flatMap(topic => topic.batches),
          ),
      )
      .find((item: { id: string }) => item.id === BATCH);
    return {
      availability: batch.availability,
      seatsRemaining: batch.seatsRemaining,
    };
  };

  before(async () => {
    server = await startTestServer({
      paymentGateway: createFakeRazorpay(),
      now: () => START,
    });
    // One seat makes holds easy to see
    await server.db.query('UPDATE batches SET capacity = 1 WHERE id = $1', [
      BATCH,
    ]);
    asha = server.createClient();
    await asha.request('POST', '/api/auth/register', validRegistration());
    ravi = server.createClient();
    await ravi.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'ravi@example.com', fullName: 'Ravi Shah' }),
    );
  });

  after(async () => {
    await server.close();
  });

  it('holds the seat while a student is paying', async () => {
    assert.equal((await checkout(asha)).status, 201);
    assert.deepEqual(await batchAvailability(), {
      availability: 'FULL',
      seatsRemaining: 0,
    });

    const blocked = await checkout(ravi);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'BATCH_FULL');
  });

  it('releases an abandoned seat once the hold ends', async () => {
    server.clock.now = () => minutesLater(SEAT_HOLD_MINUTES + 1);
    assert.deepEqual(await batchAvailability(), {
      availability: 'OPEN',
      seatsRemaining: 1,
    });
    assert.equal((await checkout(ravi)).status, 201);
  });

  it('does not let a returning student take a seat someone else now holds', async () => {
    const response = await checkout(asha);
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'BATCH_FULL');
  });

  it('keeps a paid seat for good', async () => {
    const paying = await checkout(ravi);
    assert.equal(paying.status, 201);
    const { paymentId, provider } = paying.body.checkout;
    const verified = await ravi.request('POST', '/api/payments/verify', {
      paymentId,
      providerOrderId: provider.orderId,
      providerPaymentId: 'pay_hold_1',
      signature: createHmac('sha256', KEY_SECRET)
        .update(`${provider.orderId}|pay_hold_1`)
        .digest('hex'),
    });
    assert.equal(verified.status, 200);

    server.clock.now = () => minutesLater(SEAT_HOLD_MINUTES * 10);
    assert.deepEqual(await batchAvailability(), {
      availability: 'FULL',
      seatsRemaining: 0,
    });
  });
});
