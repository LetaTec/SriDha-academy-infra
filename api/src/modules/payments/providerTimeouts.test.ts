import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { startTestServer } from '../../test/testServer.js';
import { createRazorpayGateway } from './gateway.js';

// When Razorpay does not answer in time, the payment's outcome is unknown:
// nothing is confirmed or failed on a timeout. Razorpay's own evidence (the
// signed webhook) settles it later, exactly once.

const KEY_SECRET = 'rzp_timeout_secret';
const WEBHOOK_SECRET = 'whsec_test';
const BATCH = 'batch_accountancy_rectification_of_errors_class_11_b2';
const realFetch = globalThis.fetch;

describe('Razorpay timeouts during payment', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    // Orders are answered; every payment read hangs until its deadline
    let orders = 0;
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (!url.startsWith('https://api.razorpay.com/')) {
        return realFetch(input, init);
      }
      if (url.endsWith('/orders') && init?.method === 'POST') {
        orders += 1;
        return new Response(JSON.stringify({ id: `order_timeout_${orders}` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Promise<Response>((_, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => reject(signal.reason));
      });
    }) as typeof fetch;

    server = await startTestServer({
      paymentGateway: createRazorpayGateway('rzp_test_key', KEY_SECRET, {
        responseStartMs: 50,
        totalMs: 250,
      }),
      razorpayWebhookSecret: WEBHOOK_SECRET,
      now: () => new Date('2026-10-10T09:00:00Z'),
    });
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await server.close();
  });

  it('keeps a payment "being confirmed" when Razorpay times out, and confirms it once on the webhook', async () => {
    const checkout = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: BATCH,
        fullName: 'Asha Verma',
        email: 'asha.timeout@example.com',
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(checkout.status, 201);
    const { paymentId, provider, amount } = checkout.body.checkout;

    const verified = await server
      .createClient()
      .request('POST', '/api/payments/verify', {
        paymentId,
        providerOrderId: provider.orderId,
        providerPaymentId: 'pay_timeout_1',
        signature: createHmac('sha256', KEY_SECRET)
          .update(`${provider.orderId}|pay_timeout_1`)
          .digest('hex'),
      });
    // The signature is genuine, but Razorpay's confirmation did not arrive
    assert.equal(verified.status, 200);
    assert.deepEqual(verified.body.payment, {
      paymentId,
      status: 'AUTHORIZED',
      seatConfirmed: false,
    });

    // Razorpay's signed webhook settles it; a redelivery changes nothing
    const body = {
      event: 'payment.captured',
      created_at: 1_790_000_000,
      payload: {
        payment: {
          entity: {
            id: 'pay_timeout_1',
            order_id: provider.orderId,
            amount: amount.amountPaise,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    for (let delivery = 0; delivery < 2; delivery += 1) {
      const response = await server
        .createClient()
        .request('POST', '/api/payments/webhook', body, {
          'X-Razorpay-Signature': createHmac('sha256', WEBHOOK_SECRET)
            .update(JSON.stringify(body))
            .digest('hex'),
          'X-Razorpay-Event-Id': 'evt_timeout_1',
        });
      assert.equal(response.status, 200);
    }
    const row = await server.db.get<{ status: string; seat: string }>(
      `SELECT p.status, e.status AS seat FROM payments p
       JOIN enrolments e ON e.id = p.enrolment_id WHERE p.id = $1`,
      [paymentId],
    );
    assert.deepEqual({ ...row }, { status: 'PAID', seat: 'CONFIRMED' });
    const confirmations = await server.db.get<{ n: string | number }>(
      'SELECT COUNT(*) AS n FROM email_outbox WHERE idempotency_key = $1',
      [`payment_confirmation:${paymentId}:customer`],
    );
    assert.equal(Number(confirmations?.n), 1);
  });
});
