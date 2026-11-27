import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { loadConfig } from '../config/env.js';
import { setErrorSink } from '../logging/logger.js';
import { createMailer, type Mailer } from './mailer.js';

// Nothing here reaches Resend: fetch is replaced for each test
const realFetch = globalThis.fetch;

const RECIPIENT = 'student.private@example.com';
const RESET_CODE = '493817';

type SentRequest = { url: string; init: RequestInit };

const resendMailer = (
  respond: () => Response,
): { mailer: Mailer; sent: SentRequest[] } => {
  const sent: SentRequest[] = [];
  globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
    sent.push({ url: String(url), init });
    return respond();
  }) as typeof fetch;
  const mailer = createMailer(
    loadConfig({
      NODE_ENV: 'test',
      MAIL_TRANSPORT: 'resend',
      RESEND_API_KEY: 're_test_key_not_real',
    }),
  );
  assert.ok(mailer);
  return { mailer, sent };
};

const captureErrors = () => {
  const events: Array<{ event: string; fields: Record<string, unknown> }> = [];
  setErrorSink((event, fields) => events.push({ event, fields }));
  return events;
};

const resendRefusal = () =>
  new Response(
    JSON.stringify({
      statusCode: 422,
      name: 'validation_error',
      message: `Invalid \`to\` field: ${RECIPIENT}`,
    }),
    { status: 422, headers: { 'Content-Type': 'application/json' } },
  );

afterEach(() => {
  globalThis.fetch = realFetch;
  setErrorSink(null);
});

describe('Resend mailer', () => {
  it('sends from the configured sender to the one recipient, with the idempotency key', async () => {
    const { mailer, sent } = resendMailer(
      () => new Response('{"id":"email_1"}', { status: 200 }),
    );
    await mailer.sendPaymentConfirmation(
      RECIPIENT,
      {
        fullName: 'Student',
        topic: 'Ray Optics',
        batch: 'Morning batch',
        amount: '₹2,499',
        paymentReference: 'pay_test_1',
        topicsUrl: 'https://sridhaacademy.com/topics',
      },
      { idempotencyKey: 'payment_confirmation:p1:customer' },
    );

    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, 'https://api.resend.com/emails');
    const headers = sent[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer re_test_key_not_real');
    assert.equal(
      headers['Idempotency-Key'],
      'payment_confirmation:p1:customer',
    );
    const body = JSON.parse(String(sent[0].init.body));
    assert.equal(body.from, 'SriDha Academy <noreply@sridhaacademy.com>');
    assert.deepEqual(body.to, [RECIPIENT]);
  });

  it('never puts the reset code, the subject or the recipient in a failure', async () => {
    const errors = captureErrors();
    const { mailer } = resendMailer(resendRefusal);

    const failure = await mailer
      .sendPasswordResetCode(RECIPIENT, RESET_CODE)
      .then(
        () => null,
        (error: unknown) => error as Error,
      );

    assert.ok(failure, 'a refused email must throw');
    assert.equal(
      failure.message,
      'Resend refused the password_reset_code email (status 422, validation_error)',
    );
    assert.deepEqual(errors, [
      {
        event: 'mail.delivery_failed',
        fields: {
          provider: 'resend',
          template: 'password_reset_code',
          status: 422,
          providerError: 'validation_error',
        },
      },
    ]);
    const everything = failure.message + JSON.stringify(errors);
    assert.ok(!everything.includes(RESET_CODE));
    assert.ok(!everything.includes(RECIPIENT));
    assert.ok(!everything.includes('re_test_key_not_real'));
  });

  it('keeps no provider text that is not a short error type', async () => {
    const errors = captureErrors();
    const { mailer } = resendMailer(
      () =>
        new Response(`<html>${RECIPIENT} upstream error</html>`, {
          status: 502,
        }),
    );

    await assert.rejects(
      mailer.sendAdminSignInLink(RECIPIENT, 'https://x.test/?token=secret'),
      /^Error: Resend refused the admin_sign_in_link email \(status 502\)$/,
    );
    assert.equal(errors[0].fields.providerError, null);
    assert.ok(!JSON.stringify(errors).includes(RECIPIENT));
    assert.ok(!JSON.stringify(errors).includes('token=secret'));
  });
});

describe('payment emails through Resend', () => {
  const confirmation = {
    fullName: 'Asha Verma',
    topic: 'Rectification of errors',
    batch: 'Batch 2',
    amount: '₹129',
    paymentReference: 'pay_abc123',
  };

  it("sends the finance copy with its own subject and none of the student's links", async () => {
    const { mailer, sent } = resendMailer(() => new Response('{}'));
    await mailer.sendPaymentFinanceCopy('finance@sridha.test', confirmation, {
      idempotencyKey: 'payment_confirmation:p1:finance:finance@sridha.test',
    });
    const body = JSON.parse(String(sent[0].init.body)) as {
      to: string[];
      subject: string;
      html: string;
    };
    assert.deepEqual(body.to, ['finance@sridha.test']);
    assert.equal(
      body.subject,
      '[Finance] Payment received: Rectification of errors (₹129)',
    );
    assert.match(body.html, /Asha Verma paid ₹129 for Rectification of errors/);
    assert.match(body.html, /pay_abc123/);
    assert.doesNotMatch(body.html, /href=|See more topics|is confirmed/);
  });

  it('puts a buyer-typed name into the finance email as text, never as HTML', async () => {
    const { mailer, sent } = resendMailer(() => new Response('{}'));
    await mailer.sendPaymentFinanceCopy('finance@sridha.test', {
      ...confirmation,
      fullName: 'Asha <a href="https://evil.example/refund">Approve refund</a>',
    });
    const { html } = JSON.parse(String(sent[0].init.body)) as { html: string };
    assert.doesNotMatch(html, /<a href="https:\/\/evil/);
    assert.match(
      html,
      /Asha &lt;a href=&quot;https:\/\/evil\.example\/refund&quot;&gt;Approve refund&lt;\/a&gt;/,
    );
  });

  it('gives up on a provider that does not answer instead of waiting forever', async () => {
    const { mailer, sent } = resendMailer(() => new Response('{}'));
    await mailer.sendPaymentConfirmation(
      RECIPIENT,
      { ...confirmation, topicsUrl: 'https://sridhaacademy.com/topics' },
      { idempotencyKey: 'payment_confirmation:p1:customer' },
    );
    const { signal } = sent[0].init;
    assert.ok(signal instanceof AbortSignal, 'every request has a deadline');
    assert.equal(signal.aborted, false);
  });
});
