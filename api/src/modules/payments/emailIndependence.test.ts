import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { Mailer } from '../../mail/mailer.js';
import {
  createScriptedRazorpay,
  FAKE_RAZORPAY_KEY_SECRET,
} from '../../test/fakeRazorpay.js';
import { startTestServer } from '../../test/testServer.js';

// Payment requests never wait for the email provider: a capture only
// queues its emails, and the outbox worker sends them (A6). Before, the
// webhook and verify ran a batch of up to 20 sends inline, so a slow or
// hanging provider held Razorpay's webhook until it timed out.

const WEBHOOK_SECRET = 'whsec_test';
const BATCH = 'batch_accountancy_rectification_of_errors_class_11_b2';
const NEVER_ANSWERS = () => new Promise<void>(() => {});

const hangingMailer: Mailer = {
  sendPasswordResetCode: NEVER_ANSWERS,
  sendSignUpCode: NEVER_ANSWERS,
  sendAccountExistsNotice: NEVER_ANSWERS,
  sendAdminSignInLink: NEVER_ANSWERS,
  sendPaymentConfirmation: NEVER_ANSWERS,
  sendPaymentFinanceCopy: NEVER_ANSWERS,
};

describe('payments and the email provider', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  const fake = createScriptedRazorpay();

  const checkout = async (email: string) => {
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: BATCH,
        fullName: 'Asha Verma',
        email,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(response.status, 201);
    return response.body.checkout as {
      paymentId: string;
      provider: { orderId: string };
      amount: { amountPaise: number };
    };
  };

  before(async () => {
    server = await startTestServer({
      paymentGateway: fake.gateway,
      razorpayWebhookSecret: WEBHOOK_SECRET,
      mailer: hangingMailer,
      financeNotificationEmails: ['finance@sridha.test'],
      now: () => new Date('2026-10-10T09:00:00Z'),
    });
  });

  after(async () => {
    await server.close();
  });

  it(
    'acknowledges a capture webhook at once even when the provider never answers',
    { timeout: 10_000 },
    async () => {
      const checkout = await server
        .createClient()
        .request('POST', '/api/payments/checkout', {
          kind: 'ENROLMENT',
          batchId: BATCH,
          fullName: 'Asha Verma',
          email: 'asha.hanging@example.com',
          mobile: '+91 98765 43210',
          state: 'Rajasthan',
          city: 'Jaipur',
          customerType: 'INDIVIDUAL',
          addressLine1: '12 Civil Lines',
          pinCode: '302006',
        });
      assert.equal(checkout.status, 201);
      const { paymentId, provider, amount } = checkout.body.checkout;
      const body = {
        event: 'payment.captured',
        created_at: 1_790_000_000,
        payload: {
          payment: {
            entity: {
              id: 'pay_hanging_1',
              order_id: provider.orderId,
              amount: amount.amountPaise,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      };
      const response = await server
        .createClient()
        .request('POST', '/api/payments/webhook', body, {
          'X-Razorpay-Signature': createHmac('sha256', WEBHOOK_SECRET)
            .update(JSON.stringify(body))
            .digest('hex'),
          'X-Razorpay-Event-Id': 'evt_hanging_1',
        });
      assert.equal(response.status, 200);

      // The seat is confirmed and both emails wait in the outbox
      const queued = await server.db.all<{ template: string; status: string }>(
        `SELECT o.template, o.status FROM email_outbox o
         WHERE o.idempotency_key LIKE $1 ORDER BY o.template`,
        [`payment_confirmation:${paymentId}:%`],
      );
      assert.deepEqual(
        queued.map(row => [row.template, row.status]),
        [
          ['payment_confirmation', 'PENDING'],
          ['payment_finance_copy', 'PENDING'],
        ],
      );
    },
  );

  it(
    'answers the payment check after Razorpay at once even when the provider never answers',
    { timeout: 10_000 },
    async () => {
      const order = await checkout('asha.verify.hanging@example.com');
      fake.payments.set('pay_hanging_verify', {
        id: 'pay_hanging_verify',
        orderId: order.provider.orderId,
        status: 'captured',
        amountPaise: order.amount.amountPaise,
        currency: 'INR',
      });
      const response = await server
        .createClient()
        .request('POST', '/api/payments/verify', {
          paymentId: order.paymentId,
          providerOrderId: order.provider.orderId,
          providerPaymentId: 'pay_hanging_verify',
          signature: createHmac('sha256', FAKE_RAZORPAY_KEY_SECRET)
            .update(`${order.provider.orderId}|pay_hanging_verify`)
            .digest('hex'),
        });
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.payment, {
        paymentId: order.paymentId,
        status: 'PAID',
        seatConfirmed: true,
      });
    },
  );
});
