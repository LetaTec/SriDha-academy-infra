import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import { transaction } from '../../db/client.js';
import { loadConfig } from '../../config/env.js';
import { createMailer, type Mailer } from '../../mail/mailer.js';
import { createScriptedRazorpay } from '../../test/fakeRazorpay.js';
import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
} from '../../test/testServer.js';
import {
  claimOutboxEmails,
  findOutboxById,
  insertOutboxEmail,
  markOutboxSent,
  type OutboxRow,
} from './outbox.repository.js';
import {
  BACKOFF_DELAYS_MS,
  enqueuePaymentConfirmationEmails,
  MAX_OUTBOX_ATTEMPTS,
  processEmailOutbox,
} from './outbox.service.js';

const WEBHOOK_SECRET = 'whsec_outbox_test';
const FINANCE_EMAIL = 'finance.audit@sridha.test';

const signWebhook = (body: unknown) =>
  createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

describe('transactional email outbox', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let razorpay: ReturnType<typeof createScriptedRazorpay>;
  let buyerIndex = 0;
  let webhookIndex = 0;

  before(async () => {
    razorpay = createScriptedRazorpay();
    server = await startTestServer({
      paymentGateway: razorpay.gateway,
      razorpayWebhookSecret: WEBHOOK_SECRET,
      financeNotificationEmails: [FINANCE_EMAIL],
    });
  });

  after(async () => {
    await server.close();
  });

  beforeEach(async () => {
    await server.db.run('DELETE FROM email_outbox');
  });

  const deliverCaptureWebhook = async (
    orderId: string,
    amountPaise: number,
  ) => {
    webhookIndex += 1;
    const body = {
      event: 'payment.captured',
      created_at: 1_790_000_000,
      payload: {
        payment: {
          entity: {
            id: `pay_outbox_${webhookIndex}`,
            order_id: orderId,
            amount: amountPaise,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };

    return server
      .createClient()
      .request('POST', '/api/payments/webhook', body, {
        'X-Razorpay-Signature': signWebhook(body),
        'X-Razorpay-Event-Id': `evt_outbox_${webhookIndex}`,
      });
  };

  const createEnrolmentCheckout = async (email: string) => {
    buyerIndex += 1;
    const res = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: 'batch_gst_class_11_november',
        fullName: `Outbox Buyer ${buyerIndex}`,
        email,
        mobile: '+91 98765 11111',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(res.status, 201);
    return res.body.checkout;
  };

  it('enqueues customer and finance emails within the capture transaction and delivers successfully', async () => {
    const customerEmail = 'asha.outbox1@example.com';
    const initialSentCount = server.sentPaymentConfirmations.length;

    const checkout = await createEnrolmentCheckout(customerEmail);
    const webhookRes = await deliverCaptureWebhook(
      checkout.provider.orderId,
      checkout.amount.amountPaise,
    );
    assert.equal(webhookRes.status, 200);

    // Verify outbox rows in database
    const outboxRows = await server.db.all<OutboxRow>(
      `SELECT * FROM email_outbox WHERE payload->>'paymentReference' = $1 ORDER BY id`,
      [`pay_outbox_${webhookIndex}`],
    );

    // Two emails queued: 1 for customer, 1 for finance copy
    assert.equal(outboxRows.length, 2);
    const customerRow = outboxRows.find(r => r.recipient === customerEmail);
    const financeRow = outboxRows.find(r => r.recipient === FINANCE_EMAIL);

    assert.ok(customerRow);
    assert.ok(financeRow);
    assert.equal(customerRow.status, 'SENT');
    assert.equal(financeRow.status, 'SENT');
    assert.ok(customerRow.sent_at);
    assert.ok(financeRow.sent_at);
    assert.equal(customerRow.attempts, 1);
    assert.equal(financeRow.attempts, 1);

    // Verify delivery via mailer
    const newDeliveries =
      server.sentPaymentConfirmations.slice(initialSentCount);
    assert.equal(newDeliveries.length, 2);
    assert.ok(newDeliveries.some(d => d.email === customerEmail));
    assert.ok(newDeliveries.some(d => d.email === FINANCE_EMAIL));
  });

  it('prevents duplicate outbox entries and duplicate sends when webhooks repeat', async () => {
    const customerEmail = 'duplicate.test@example.com';
    const checkout = await createEnrolmentCheckout(customerEmail);

    // First delivery
    webhookIndex += 1;
    const body = {
      event: 'payment.captured',
      created_at: 1_790_000_000,
      payload: {
        payment: {
          entity: {
            id: `pay_outbox_dup_${webhookIndex}`,
            order_id: checkout.provider.orderId,
            amount: checkout.amount.amountPaise,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const signature = signWebhook(body);
    const eventId = `evt_dup_${webhookIndex}`;

    const res1 = await server
      .createClient()
      .request('POST', '/api/payments/webhook', body, {
        'X-Razorpay-Signature': signature,
        'X-Razorpay-Event-Id': eventId,
      });
    assert.equal(res1.status, 200);

    const countAfterFirst = (
      await server.db.all<{ count: string | number }>(
        `SELECT COUNT(*) AS count FROM email_outbox WHERE recipient = $1`,
        [customerEmail],
      )
    )[0].count;
    assert.equal(Number(countAfterFirst), 1);

    // Deliver exact same webhook event again
    const res2 = await server
      .createClient()
      .request('POST', '/api/payments/webhook', body, {
        'X-Razorpay-Signature': signature,
        'X-Razorpay-Event-Id': eventId,
      });
    assert.equal(res2.status, 200);

    const countAfterSecond = (
      await server.db.all<{ count: string | number }>(
        `SELECT COUNT(*) AS count FROM email_outbox WHERE recipient = $1`,
        [customerEmail],
      )
    )[0].count;
    assert.equal(Number(countAfterSecond), 1);
  });

  it('retries with exponential backoff on provider failure', async () => {
    let nowTime = new Date('2026-11-01T10:00:00Z');
    const failingMailer: Mailer = {
      sendPasswordResetCode: async () => {},
      sendAdminSignInLink: async () => {},
      sendPaymentConfirmation: async () => {
        throw new Error('Resend 503: Service Unavailable');
      },
    };

    const outboxId = `outbox_fail_${randomUUID()}`;
    await insertOutboxEmail(server.db, {
      id: outboxId,
      recipient: 'retry.student@example.com',
      subject: 'Payment received: Learn GST',
      template: 'payment_confirmation',
      payload: {
        fullName: 'Retry Student',
        topic: 'Learn GST',
        batch: 'November batch',
        amount: '₹129',
        paymentReference: 'pay_retry_1',
        topicsUrl: 'https://sridhaacademy.com/topics',
      },
      idempotencyKey: `retry_key_${randomUUID()}`,
      createdAt: nowTime,
      nextAttemptAt: nowTime,
    });

    const ctx = { db: server.db, mailer: failingMailer, now: () => nowTime };

    // Attempt 1: failure -> backoff 15s
    const res1 = await processEmailOutbox(ctx);
    assert.equal(res1.claimed, 1);
    assert.equal(res1.retried, 1);
    assert.equal(res1.sent, 0);

    const rowAfterAttempt1 = (await findOutboxById(server.db, outboxId))!;
    assert.equal(rowAfterAttempt1.status, 'PENDING');
    assert.equal(rowAfterAttempt1.attempts, 1);
    assert.ok(rowAfterAttempt1.last_error?.includes('Service Unavailable'));
    const expectedNext1 = new Date(nowTime.getTime() + BACKOFF_DELAYS_MS[0]);
    assert.equal(
      new Date(rowAfterAttempt1.next_attempt_at).toISOString(),
      expectedNext1.toISOString(),
    );

    // Advancing time past backoff delay allows attempt 2
    nowTime = new Date(expectedNext1.getTime() + 1000);
    const res2 = await processEmailOutbox(ctx);
    assert.equal(res2.claimed, 1);
    assert.equal(res2.retried, 1);

    const rowAfterAttempt2 = (await findOutboxById(server.db, outboxId))!;
    assert.equal(rowAfterAttempt2.attempts, 2);
    const expectedNext2 = new Date(nowTime.getTime() + BACKOFF_DELAYS_MS[1]);
    assert.equal(
      new Date(rowAfterAttempt2.next_attempt_at).toISOString(),
      expectedNext2.toISOString(),
    );
  });

  it('marks email as FAILED once maximum retry attempts are exhausted', async () => {
    let nowTime = new Date('2026-11-01T12:00:00Z');
    const failingMailer: Mailer = {
      sendPasswordResetCode: async () => {},
      sendAdminSignInLink: async () => {},
      sendPaymentConfirmation: async () => {
        throw new Error('Permanent mailbox failure: 550 User not found');
      },
    };

    const outboxId = `outbox_exhaust_${randomUUID()}`;
    await insertOutboxEmail(server.db, {
      id: outboxId,
      recipient: 'exhaust@example.com',
      subject: 'Payment received: Learn GST',
      template: 'payment_confirmation',
      payload: {
        fullName: 'Exhausted Student',
        topic: 'Learn GST',
        batch: null,
        amount: '₹129',
        paymentReference: 'pay_exhaust_1',
        topicsUrl: 'https://sridhaacademy.com/topics',
      },
      idempotencyKey: `exhaust_key_${randomUUID()}`,
      createdAt: nowTime,
      nextAttemptAt: nowTime,
    });

    const ctx = { db: server.db, mailer: failingMailer, now: () => nowTime };

    // Run through 5 attempts
    for (let attempt = 1; attempt <= MAX_OUTBOX_ATTEMPTS; attempt++) {
      const row = (await findOutboxById(server.db, outboxId))!;
      nowTime = new Date(new Date(row.next_attempt_at).getTime() + 1000);
      const res = await processEmailOutbox(ctx);
      assert.equal(res.claimed, 1);
      if (attempt < MAX_OUTBOX_ATTEMPTS) {
        assert.equal(res.retried, 1);
      } else {
        assert.equal(res.failed, 1);
      }
    }

    const finalRow = (await findOutboxById(server.db, outboxId))!;
    assert.equal(finalRow.status, 'FAILED');
    assert.equal(finalRow.attempts, MAX_OUTBOX_ATTEMPTS);
    assert.ok(finalRow.last_error?.includes('550 User not found'));

    // Further calls do not pick up FAILED emails
    nowTime = new Date(nowTime.getTime() + 100_000);
    const subsequentRes = await processEmailOutbox(ctx);
    assert.equal(subsequentRes.claimed, 0);
  });

  it('claims pending emails safely across concurrent workers without duplicate sends', async () => {
    const nowTime = new Date('2026-11-02T10:00:00Z');
    const sentIds: string[] = [];
    const trackingMailer: Mailer = {
      sendPasswordResetCode: async () => {},
      sendAdminSignInLink: async () => {},
      sendPaymentConfirmation: async (_email, confirmation) => {
        sentIds.push(confirmation.paymentReference);
      },
    };

    // Insert 6 pending emails
    for (let i = 1; i <= 6; i++) {
      await insertOutboxEmail(server.db, {
        id: `concurrent_${i}_${randomUUID()}`,
        recipient: `student_${i}@example.com`,
        subject: `Payment ${i}`,
        template: 'payment_confirmation',
        payload: {
          fullName: `Student ${i}`,
          topic: 'Learn GST',
          batch: null,
          amount: '₹129',
          paymentReference: `ref_${i}`,
          topicsUrl: 'https://sridhaacademy.com',
        },
        idempotencyKey: `concurrent_key_${i}`,
        createdAt: nowTime,
        nextAttemptAt: nowTime,
      });
    }

    const ctx = { db: server.db, mailer: trackingMailer, now: () => nowTime };

    // Run 2 workers simultaneously claiming up to 3 each
    const [workerA, workerB] = await Promise.all([
      processEmailOutbox(ctx, { limit: 3 }),
      processEmailOutbox(ctx, { limit: 3 }),
    ]);

    assert.equal(workerA.sent + workerB.sent, 6);
    // Every reference must be sent exactly once
    assert.equal(sentIds.length, 6);
    const uniqueSent = new Set(sentIds);
    assert.equal(uniqueSent.size, 6);
  });

  it('recovers PROCESSING messages abandoned by crashed workers', async () => {
    const nowTime = new Date('2026-11-02T14:00:00Z');
    const outboxId = `crash_recovery_${randomUUID()}`;

    // Simulate an email stuck in PROCESSING with last_attempt_at 15 minutes ago
    await insertOutboxEmail(server.db, {
      id: outboxId,
      recipient: 'crash.recovery@example.com',
      subject: 'Recovered email',
      template: 'payment_confirmation',
      payload: {
        fullName: 'Crash Recovery Student',
        topic: 'Learn GST',
        batch: null,
        amount: '₹129',
        paymentReference: 'pay_crash_1',
        topicsUrl: 'https://sridhaacademy.com',
      },
      idempotencyKey: `crash_key_${randomUUID()}`,
      createdAt: new Date('2026-11-02T13:40:00Z'),
      nextAttemptAt: new Date('2026-11-02T13:40:00Z'),
    });

    // Manually mark it as PROCESSING 15 minutes in the past
    await server.db.run(
      `UPDATE email_outbox
       SET status = 'PROCESSING',
           attempts = 1,
           last_attempt_at = $2
       WHERE id = $1`,
      [outboxId, new Date('2026-11-02T13:45:00Z').toISOString()],
    );

    const recoveredEmails: string[] = [];
    const recoveringMailer: Mailer = {
      sendPasswordResetCode: async () => {},
      sendAdminSignInLink: async () => {},
      sendPaymentConfirmation: async email => {
        recoveredEmails.push(email);
      },
    };

    const ctx = { db: server.db, mailer: recoveringMailer, now: () => nowTime };
    const res = await processEmailOutbox(ctx, {
      staleTimeoutMs: 5 * 60 * 1000,
    });

    assert.ok(res.claimed >= 1);
    assert.ok(recoveredEmails.includes('crash.recovery@example.com'));

    const row = (await findOutboxById(server.db, outboxId))!;
    assert.equal(row.status, 'SENT');
    assert.equal(row.attempts, 2); // 1 before crash + 1 on recovery
    assert.ok(row.sent_at);
  });

  it('prevents orphaned outbox emails when a payment transaction rolls back', async () => {
    const paymentId = 'pay_rollback_test';
    const now = new Date('2026-11-02T15:00:00Z');

    // Simulate failed transaction: enqueue outbox within transaction, but then transaction rolls back
    try {
      await transaction(server.db, async tx => {
        await enqueuePaymentConfirmationEmails(tx, {
          paymentId,
          webOrigin: 'https://sridhaacademy.com',
          timestamp: now.toISOString(),
        });
        throw new Error('Database transaction abort test');
      });
    } catch {
      // Expected rollback
    }

    const rows = await server.db.all<OutboxRow>(
      `SELECT * FROM email_outbox WHERE idempotency_key LIKE $1`,
      [`%${paymentId}%`],
    );
    assert.equal(rows.length, 0);
  });

  it('preserves existing password reset and admin sign-in emails without outbox routing', async () => {
    // Password reset email
    const resetClient = server.createClient();
    const resetRes = await resetClient.request(
      'POST',
      '/api/auth/password-reset',
      { email: 'student@example.com' },
    );
    assert.equal(resetRes.status, 202);

    // Admin sign-in email
    const adminClient = server.createClient();
    const adminRes = await adminClient.request(
      'POST',
      '/api/auth/admin-sign-in',
      { email: TEST_SUPER_ADMIN_EMAIL },
    );
    assert.equal(adminRes.status, 202);

    // Verify outbox has no rows for these
    const outboxResetRows = await server.db.all<OutboxRow>(
      `SELECT * FROM email_outbox WHERE template IN ('password_reset', 'admin_sign_in')`,
    );
    assert.equal(outboxResetRows.length, 0);
  });

  describe('duplicate delivery and claim safety', () => {
    const STALE_MS = 5 * 60 * 1000;
    const T0 = new Date('2026-11-03T10:00:00Z');
    const after = (ms: number) => new Date(T0.getTime() + ms);

    const queueEmail = async (key: string) => {
      const id = `dup_${randomUUID()}`;
      await insertOutboxEmail(server.db, {
        id,
        recipient: 'dup.check@example.com',
        subject: 'Payment received',
        template: 'payment_confirmation',
        payload: {
          fullName: 'Duplicate Check',
          topic: 'Learn GST',
          batch: null,
          amount: '₹129',
          paymentReference: 'pay_dup_1',
          topicsUrl: 'https://sridhaacademy.com',
        },
        idempotencyKey: key,
        createdAt: T0,
        nextAttemptAt: T0,
      });
      return id;
    };

    // Behaves like Resend: a repeated idempotency key within 24 hours is
    // accepted again but delivers nothing new
    const providerLikeResend = () => {
      const delivered: string[] = [];
      const keys: Array<string | undefined> = [];
      const seen = new Set<string>();
      const mailer: Mailer = {
        sendPasswordResetCode: async () => {},
        sendAdminSignInLink: async () => {},
        sendPaymentConfirmation: async (email, _confirmation, options) => {
          keys.push(options?.idempotencyKey);
          if (options?.idempotencyKey && seen.has(options.idempotencyKey))
            return;
          if (options?.idempotencyKey) seen.add(options.idempotencyKey);
          delivered.push(email);
        },
      };
      return { mailer, delivered, keys };
    };

    it('sends each email with its own stable idempotency key', async () => {
      const key = `payment_confirmation:${randomUUID()}:customer`;
      await queueEmail(key);
      const provider = providerLikeResend();
      await processEmailOutbox({
        db: server.db,
        mailer: provider.mailer,
        now: () => T0,
      });
      assert.deepEqual(provider.keys, [key]);
    });

    it('delivers once when the send worked but recording it failed', async () => {
      // The audit's reproduction: the provider accepted the email, then
      // marking it sent failed once
      const id = await queueEmail(
        `payment_confirmation:${randomUUID()}:customer`,
      );
      await server.db.exec(`
        CREATE SEQUENCE fail_mark_sent_once;
        CREATE FUNCTION fail_mark_sent_once() RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.status = 'SENT' AND nextval('fail_mark_sent_once') = 1 THEN
            RAISE EXCEPTION 'injected failure recording the send';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER inject_mark_sent_failure BEFORE UPDATE ON email_outbox
        FOR EACH ROW EXECUTE FUNCTION fail_mark_sent_once();
      `);
      try {
        const provider = providerLikeResend();
        const first = await processEmailOutbox({
          db: server.db,
          mailer: provider.mailer,
          now: () => T0,
        });
        assert.equal(first.sent, 0);
        // Not treated as a failed send: no retry is scheduled with an error
        assert.equal(first.retried, 0);
        assert.equal(
          (await findOutboxById(server.db, id))?.status,
          'PROCESSING',
        );

        // Reclaimed after the stale timeout and sent again with the same key
        await processEmailOutbox(
          {
            db: server.db,
            mailer: provider.mailer,
            now: () => after(STALE_MS + 60_000),
          },
          { staleTimeoutMs: STALE_MS },
        );
        assert.equal((await findOutboxById(server.db, id))?.status, 'SENT');
        assert.equal(provider.keys.length, 2);
        assert.equal(provider.keys[0], provider.keys[1]);
        assert.deepEqual(provider.delivered, ['dup.check@example.com']);
      } finally {
        await server.db.exec(`
          DROP TRIGGER inject_mark_sent_failure ON email_outbox;
          DROP FUNCTION fail_mark_sent_once();
          DROP SEQUENCE fail_mark_sent_once;
        `);
      }
    });

    it('lets only the worker holding the current claim record the result', async () => {
      const id = await queueEmail(
        `payment_confirmation:${randomUUID()}:customer`,
      );
      const [slow] = await claimOutboxEmails(server.db, T0, 10, STALE_MS);
      const [reclaimed] = await claimOutboxEmails(
        server.db,
        after(STALE_MS + 60_000),
        10,
        STALE_MS,
      );
      assert.equal(slow.id, id);
      assert.equal(reclaimed.id, id);
      assert.notEqual(slow.claim_token, reclaimed.claim_token);

      assert.equal(
        await markOutboxSent(
          server.db,
          id,
          String(slow.claim_token),
          after(STALE_MS + 90_000),
        ),
        false,
      );
      assert.equal((await findOutboxById(server.db, id))?.status, 'PROCESSING');
      assert.equal(
        await markOutboxSent(
          server.db,
          id,
          String(reclaimed.claim_token),
          after(STALE_MS + 90_000),
        ),
        true,
      );
      assert.equal((await findOutboxById(server.db, id))?.status, 'SENT');
    });

    it('gives up on an email abandoned at its last attempt instead of sending it again', async () => {
      const id = await queueEmail(
        `payment_confirmation:${randomUUID()}:customer`,
      );
      await server.db.run(
        `UPDATE email_outbox SET status = 'PROCESSING', attempts = $2, last_attempt_at = $3
         WHERE id = $1`,
        [id, MAX_OUTBOX_ATTEMPTS, T0.toISOString()],
      );
      const provider = providerLikeResend();
      await processEmailOutbox(
        {
          db: server.db,
          mailer: provider.mailer,
          now: () => after(STALE_MS + 60_000),
        },
        { staleTimeoutMs: STALE_MS },
      );
      assert.deepEqual(provider.delivered, []);
      const row = await findOutboxById(server.db, id);
      // It may have been delivered: never resent, never claimed as failed
      assert.equal(row?.status, 'UNCONFIRMED');
      assert.match(String(row?.last_error), /abandoned/i);
      assert.match(String(row?.last_error), /may have accepted/i);
    });
  });

  describe('the real Resend mailer (O1)', () => {
    const realFetch = globalThis.fetch;
    after(() => {
      globalThis.fetch = realFetch;
    });

    it('sends the outbox key as Resend Idempotency-Key, the same on every attempt', async () => {
      const requests: Array<{ url: string; headers: Headers; body: unknown }> =
        [];
      let answer = 500;
      globalThis.fetch = (async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url = String(input);
        if (!url.startsWith('https://api.resend.com/')) {
          return realFetch(input, init);
        }
        requests.push({
          url,
          headers: new Headers(init?.headers),
          body: JSON.parse(String(init?.body)),
        });
        return new Response(JSON.stringify({ id: 'email_1' }), {
          status: answer,
        });
      }) as typeof fetch;

      const mailer = createMailer(
        loadConfig({
          NODE_ENV: 'test',
          MAIL_TRANSPORT: 'resend',
          RESEND_API_KEY: 're_test_not_a_real_key',
        }),
      )!;
      const key = `payment_confirmation:${randomUUID()}:customer`;
      const id = `resend_${randomUUID()}`;
      const T0 = new Date('2026-11-04T10:00:00Z');
      await insertOutboxEmail(server.db, {
        id,
        recipient: 'resend.check@example.com',
        subject: 'Payment received',
        template: 'payment_confirmation',
        payload: {
          fullName: 'Resend Check',
          topic: 'Learn GST',
          batch: null,
          amount: '₹129',
          paymentReference: 'pay_resend_1',
          topicsUrl: 'https://sridhaacademy.com',
        },
        idempotencyKey: key,
        createdAt: T0,
        nextAttemptAt: T0,
      });

      // First attempt: Resend answers 500, so it is retried later
      await processEmailOutbox({ db: server.db, mailer, now: () => T0 });
      answer = 200;
      await processEmailOutbox({
        db: server.db,
        mailer,
        now: () => new Date(T0.getTime() + BACKOFF_DELAYS_MS[0] + 1000),
      });

      assert.equal(requests.length, 2);
      for (const request of requests) {
        assert.equal(request.url, 'https://api.resend.com/emails');
        assert.equal(request.headers.get('Idempotency-Key'), key);
        assert.deepEqual((request.body as { to: string[] }).to, [
          'resend.check@example.com',
        ]);
      }
      assert.equal((await findOutboxById(server.db, id))?.status, 'SENT');
    });
  });
});
