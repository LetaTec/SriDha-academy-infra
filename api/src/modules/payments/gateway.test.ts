import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { ApiError } from '../../http/errors.js';
import { setErrorSink } from '../../logging/logger.js';
import { createRazorpayGateway, RAZORPAY_TIMEOUTS } from './gateway.js';

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

describe('Razorpay deadlines', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
    setErrorSink(null);
  });

  // Short deadlines so the tests run fast; production uses RAZORPAY_TIMEOUTS
  const TIMEOUTS = { responseStartMs: 50, totalMs: 250 };
  const quick = () =>
    createRazorpayGateway('rzp_test_key', 'test_secret', TIMEOUTS);

  // Razorpay accepts the connection but never answers
  const neverAnswers = (call: Call) =>
    new Promise<Response>((_, reject) => {
      const signal = call.init?.signal;
      signal?.addEventListener('abort', () => reject(signal.reason));
    });

  // Razorpay starts answering, then the body stops arriving
  const bodyStalls = (call: Call) => {
    const signal = call.init?.signal;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"id":'));
        signal?.addEventListener('abort', () =>
          controller.error(signal.reason),
        );
      },
    });
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const timed = async <T>(work: () => Promise<T>) => {
    const started = Date.now();
    const result = await work();
    return { result, ms: Date.now() - started };
  };

  it('gives up on a request Razorpay never answers, as an unknown outcome', async () => {
    stubFetch(neverAnswers);
    const read = await timed(() => quick().fetchPayment('pay_1'));
    assert.equal(read.result, null, 'unknown, not failed');
    assert.ok(read.ms < 1000, `took ${read.ms} ms`);

    const refund = await timed(() => quick().createRefund(refundRequest));
    assert.deepEqual(refund.result, { outcome: 'unknown' });
    assert.ok(refund.ms < 1000);

    await assert.rejects(
      quick().createOrder({
        amountPaise: 12900,
        currency: 'INR',
        receipt: 'r1',
      }),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === 'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  });

  it('gives up when the answer starts but the body stops arriving', async () => {
    stubFetch(bodyStalls);
    const read = await timed(() => quick().fetchPayment('pay_1'));
    assert.equal(read.result, null);
    assert.ok(read.ms < 1000, `took ${read.ms} ms`);
    // Accepted but unreadable: the refund may exist, so it is unknown and
    // found later by its receipt, never "created" with invented fields
    assert.deepEqual(await quick().createRefund(refundRequest), {
      outcome: 'unknown',
    });
    await assert.rejects(
      quick().createOrder({
        amountPaise: 12900,
        currency: 'INR',
        receipt: 'r1',
      }),
      ApiError,
    );
  });

  it('treats a network failure as an unknown outcome', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));
    assert.equal(await quick().fetchPayment('pay_1'), null);
    assert.deepEqual(await quick().createRefund(refundRequest), {
      outcome: 'unknown',
    });
  });

  it('accepts an answer that arrives late but within the deadlines', async () => {
    stubFetch(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve(
                json(200, {
                  id: 'pay_1',
                  order_id: 'order_1',
                  status: 'captured',
                  amount: 12900,
                  currency: 'INR',
                }),
              ),
            25,
          ),
        ),
    );
    assert.deepEqual(await quick().fetchPayment('pay_1'), {
      id: 'pay_1',
      orderId: 'order_1',
      status: 'captured',
      amountPaise: 12900,
      currency: 'INR',
      // Razorpay sent no captured flag here; it is never invented
      captured: null,
    });
  });

  it('keeps the refund idempotency key on a retry after a timeout, and logs no credentials', async () => {
    const errors: Array<Record<string, unknown>> = [];
    setErrorSink((_event, fields) => errors.push(fields));
    const calls = stubFetch(neverAnswers);
    await quick().createRefund(refundRequest);
    await quick().createRefund(refundRequest);
    const keys = calls.map(
      call =>
        (call.init?.headers as Record<string, string>)['X-Refund-Idempotency'],
    );
    assert.deepEqual(keys, [refundRequest.receipt, refundRequest.receipt]);
    assert.ok(errors.length > 0);
    assert.ok(!JSON.stringify(errors).includes('Basic '));
    assert.ok(!JSON.stringify(errors).includes('test_secret'));
  });

  it('uses deadlines of 10 seconds to start answering and 20 seconds in all', () => {
    assert.deepEqual(RAZORPAY_TIMEOUTS, {
      responseStartMs: 10_000,
      totalMs: 20_000,
    });
  });
});
