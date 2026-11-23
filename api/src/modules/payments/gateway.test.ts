import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { createRazorpayGateway } from './gateway.js';

// The real Razorpay gateway against a stubbed fetch: nothing leaves the
// machine. Checks how refund answers are classified and that refund lists
// are read in full.

type Call = { url: string; init?: RequestInit };

const realFetch = globalThis.fetch;

const stubFetch = (
  respond: (call: Call, index: number) => Response | Promise<Response>,
) => {
  const calls: Call[] = [];
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call, calls.length - 1);
  }) as typeof fetch;
  return calls;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const gateway = () => createRazorpayGateway('rzp_test_key', 'test_secret');

const refundRequest = {
  providerPaymentId: 'pay_123',
  amountPaise: 5000,
  receipt: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  notes: { refund_id: 'r1' },
};

describe('Razorpay gateway refunds', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends the refund receipt as X-Refund-Idempotency', async () => {
    const calls = stubFetch(() =>
      json(200, { id: 'rfnd_1', status: 'pending', amount: 5000 }),
    );
    const result = await gateway().createRefund(refundRequest);

    assert.equal(result.outcome, 'created');
    const headers = new Headers(calls[0].init?.headers);
    assert.equal(headers.get('X-Refund-Idempotency'), refundRequest.receipt);
  });

  it('treats only a definite refusal as rejected', async () => {
    for (const status of [400, 401, 403, 404, 422]) {
      stubFetch(() =>
        json(status, { error: { description: 'Refund amount is invalid' } }),
      );
      const result = await gateway().createRefund(refundRequest);
      assert.equal(result.outcome, 'rejected', `HTTP ${status}`);
    }
  });

  it('treats rate limiting, conflicts, timeouts and server errors as unknown', async () => {
    for (const status of [408, 409, 429, 500, 502, 503]) {
      stubFetch(() => json(status, { error: { description: 'busy' } }));
      const result = await gateway().createRefund(refundRequest);
      assert.equal(result.outcome, 'unknown', `HTTP ${status}`);
    }
    stubFetch(() => Promise.reject(new Error('socket hang up')));
    assert.equal(
      (await gateway().createRefund(refundRequest)).outcome,
      'unknown',
    );
  });

  it('reads every page of a payment’s refunds', async () => {
    const page = (start: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `rfnd_${start + i}`,
        status: 'processed',
        amount: 100,
        receipt: `rcpt_${start + i}`,
      }));
    const calls = stubFetch((call, index) =>
      json(200, { items: index === 0 ? page(0, 100) : page(100, 5) }),
    );

    const refunds = await gateway().fetchPaymentRefunds('pay_123');

    assert.equal(refunds?.length, 105);
    assert.equal(refunds?.at(-1)?.receipt, 'rcpt_104');
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /count=100&skip=0$/);
    assert.match(calls[1].url, /count=100&skip=100$/);
  });

  it('preserves null currency and paymentId without fabricating defaults in fetchRefund and fetchPaymentRefunds', async () => {
    stubFetch(() =>
      json(200, {
        id: 'rfnd_no_curr',
        status: 'processed',
        amount: 2500,
        // currency omitted
        // payment_id omitted
      }),
    );

    const singleRefund = await gateway().fetchRefund('rfnd_no_curr');
    assert.equal(singleRefund?.currency, null);

    stubFetch(() =>
      json(200, {
        items: [
          {
            id: 'rfnd_item_1',
            status: 'processed',
            amount: 2500,
            // currency omitted
            // payment_id omitted
          },
        ],
      }),
    );

    const listRefunds = await gateway().fetchPaymentRefunds('pay_123');
    assert.equal(listRefunds?.[0]?.currency, null);
    assert.equal(listRefunds?.[0]?.paymentId, null);
  });

  it('answers null, not a partial list, when a later page cannot be read', async () => {
    stubFetch((_call, index) =>
      index === 0
        ? json(200, {
            items: Array.from({ length: 100 }, (_, i) => ({
              id: `rfnd_${i}`,
              status: 'processed',
              amount: 1,
            })),
          })
        : json(503, {}),
    );
    assert.equal(await gateway().fetchPaymentRefunds('pay_123'), null);
  });
  it('maps what Razorpay returns on creation without inventing any field, so the caller can check it', async () => {
    stubFetch(() =>
      json(200, {
        id: 'rfnd_created_1',
        status: 'pending',
        amount: 5000,
        currency: 'INR',
        payment_id: 'pay_123',
        receipt: refundRequest.receipt,
      }),
    );
    const complete = await gateway().createRefund(refundRequest);
    assert.equal(complete.outcome, 'created');
    if (complete.outcome === 'created') {
      assert.deepEqual(complete.refund, {
        id: 'rfnd_created_1',
        status: 'pending',
        amountPaise: 5000,
        currency: 'INR',
        paymentId: 'pay_123',
        receipt: refundRequest.receipt,
      });
    }

    // A success with an empty body is passed on as empty, never as a refund
    stubFetch(() => json(200, {}));
    const empty = await gateway().createRefund(refundRequest);
    assert.equal(empty.outcome, 'created');
    if (empty.outcome === 'created') {
      assert.equal(empty.refund.id, undefined);
      assert.equal(empty.refund.currency, null);
      assert.equal(empty.refund.paymentId, null);
    }
  });
});
