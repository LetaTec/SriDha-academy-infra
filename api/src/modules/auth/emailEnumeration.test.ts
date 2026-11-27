import assert from 'node:assert/strict';
import { after, afterEach, describe, it } from 'node:test';

import { setErrorSink } from '../../logging/logger.js';
import type { Mailer } from '../../mail/mailer.js';
import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
} from '../../test/testServer.js';

// Asking for a reset code or a staff sign-in link must answer the same way,
// as quickly, whether or not the address has an account (or is staff), and
// whether or not the email provider accepts the message.

const STUDENT = 'kiran.enumeration@example.com';
const UNKNOWN = 'nobody.here@example.com';

type Server = Awaited<ReturnType<typeof startTestServer>>;

const mailerWhere = (send: () => Promise<void>): Mailer => ({
  sendPasswordResetCode: send,
  sendSignUpCode: send,
  sendAccountExistsNotice: send,
  sendAdminSignInLink: send,
  sendPaymentConfirmation: send,
});

// A provider that never answers, and one that refuses everything
const hanging = () => mailerWhere(() => new Promise<void>(() => {}));
const refusing = () =>
  mailerWhere(async () => {
    throw new Error('Resend refused the email (status 500)');
  });
// A mailer written as a plain function that throws before returning
const throwingAtOnce = () =>
  mailerWhere(() => {
    throw new Error('mailer misconfigured');
  });

// Without the fix a hanging provider holds the request forever; fail fast
const NO_WAIT = { timeout: 10_000 };

const servers: Server[] = [];
const start = async (mailer: Mailer) => {
  const server = await startTestServer({ mailer });
  servers.push(server);
  // The account is made directly: sign-up itself emails a code, and these
  // mailers never deliver one
  await server.db.query(
    `INSERT INTO users (id, email, password_hash, role, full_name, created_at, updated_at)
     VALUES ('usr_enumeration', $1, 'scrypt$placeholder', 'STUDENT', 'Kiran Rao', $2, $2)`,
    [STUDENT, new Date().toISOString()],
  );
  return server;
};

const ask = (server: Server, path: string, email: string) =>
  server.createClient().request('POST', path, { email });

const sameAnswer = (
  a: { status: number; body: unknown },
  b: { status: number; body: unknown },
) => {
  assert.equal(a.status, b.status);
  assert.deepEqual(a.body, b.body);
};

afterEach(() => setErrorSink(null));

after(async () => {
  await Promise.all(servers.map(server => server.close()));
});

describe('no account enumeration through emailed codes and links', () => {
  it(
    'answers a reset request without waiting for the provider',
    NO_WAIT,
    async () => {
      const server = await start(hanging());
      // Before the fix this request waited for the provider forever
      const known = await ask(server, '/api/auth/password-reset', STUDENT);
      const unknown = await ask(server, '/api/auth/password-reset', UNKNOWN);
      assert.equal(known.status, 202);
      sameAnswer(known, unknown);
    },
  );

  it('answers a reset request the same way when the provider refuses the email', async () => {
    const errors: Array<{ event: string; fields: Record<string, unknown> }> =
      [];
    setErrorSink((event, fields) => errors.push({ event, fields }));
    const server = await start(refusing());

    const known = await ask(server, '/api/auth/password-reset', STUDENT);
    const unknown = await ask(server, '/api/auth/password-reset', UNKNOWN);
    assert.equal(known.status, 202);
    sameAnswer(known, unknown);

    // The failure is recorded for staff, once, and names no address
    await new Promise(resolve => setImmediate(resolve));
    const failures = errors.filter(
      entry => entry.event === 'auth.password_reset_code_failed',
    );
    assert.equal(failures.length, 1);
    // JSON.stringify drops an Error's message, so read it directly
    const logged =
      JSON.stringify(failures) +
      String((failures[0].fields.error as Error | undefined)?.message);
    assert.ok(!logged.includes(STUDENT));
    assert.ok(
      !errors.some(entry => entry.event === 'http.unhandled_error'),
      'a provider failure must not become a server error',
    );
  });

  it('answers the same way when the mailer throws before returning', async () => {
    const server = await start(throwingAtOnce());
    const known = await ask(server, '/api/auth/password-reset', STUDENT);
    const unknown = await ask(server, '/api/auth/password-reset', UNKNOWN);
    assert.equal(known.status, 202);
    sameAnswer(known, unknown);
    const staff = await ask(
      server,
      '/api/auth/admin-sign-in',
      TEST_SUPER_ADMIN_EMAIL,
    );
    sameAnswer(staff, await ask(server, '/api/auth/admin-sign-in', UNKNOWN));
  });

  it('still issues a working code when the provider accepts it', async () => {
    const server = await startTestServer();
    servers.push(server);
    await server.signUpStudent({
      fullName: 'Kiran Rao',
      email: STUDENT,
      password: 'correct-horse-1',
    });
    const response = await ask(server, '/api/auth/password-reset', STUDENT);
    assert.equal(response.status, 202);
    const sent = server.sentEmails.at(-1);
    assert.equal(sent?.email, STUDENT);
    const confirmed = await server
      .createClient()
      .request('POST', '/api/auth/password-reset/confirm', {
        email: STUDENT,
        code: sent?.code,
        password: 'brand-new-pass-3',
      });
    assert.equal(confirmed.status, 200);
  });

  it(
    'answers a staff sign-in request the same way for staff and others, whatever the provider does',
    NO_WAIT,
    async () => {
      for (const mailer of [hanging(), refusing()]) {
        const server = await start(mailer);
        const staff = await ask(
          server,
          '/api/auth/admin-sign-in',
          TEST_SUPER_ADMIN_EMAIL,
        );
        const student = await ask(server, '/api/auth/admin-sign-in', STUDENT);
        const unknown = await ask(server, '/api/auth/admin-sign-in', UNKNOWN);
        assert.ok(staff.status >= 200 && staff.status < 300);
        sameAnswer(staff, student);
        sameAnswer(staff, unknown);
      }
    },
  );
});
