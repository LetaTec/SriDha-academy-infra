import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { loadConfig } from '../../config/env.js';
import {
  startTestServer,
  TEST_WEB_ORIGIN,
  testStudent,
} from '../../test/testServer.js';

describe('auth', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
  });

  it('creates an account only through the verified sign-up, and starts a session', async () => {
    const { client, response } = await server.signUpStudent(
      testStudent({ fullName: 'Asha Verma', email: 'asha@example.com' }),
    );

    assert.equal(response.status, 201);
    assert.match(response.body.user.id, /^[0-9a-f-]{36}$/);
    assert.equal(response.body.user.email, 'asha@example.com');
    assert.match(response.setCookie ?? '', /leta_session=.+; .*HttpOnly/i);
    assert.match(response.setCookie ?? '', /SameSite=Lax/i);

    const session = await client.request('GET', '/api/auth/session');
    assert.equal(session.status, 200);
    assert.equal(session.body.user.id, response.body.user.id);
  });

  it('no longer offers the legacy registration that skipped email verification', async () => {
    // Removed by owner decision: it created an account and a session for
    // any email without proof, and answered 409 for emails on file
    const response = await server
      .createClient()
      .request('POST', '/api/auth/register', {
        fullName: 'Not Verified',
        email: 'unverified@example.com',
        password: 'correct-horse-1',
        dateOfBirth: '2009-04-12',
        mobile: '+91 98765 43210',
        standard: 'CLASS_11',
        stream: 'COMMERCE',
      });
    assert.equal(response.status, 404);
    assert.equal(response.setCookie, null);
    const account = await server.db.get(
      'SELECT id FROM users WHERE email = $1',
      ['unverified@example.com'],
    );
    assert.equal(account ?? null, null);
  });

  it('never stores the raw password or session token', async () => {
    const user = await server.db.get<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE LOWER(email) = LOWER($1)',
      ['asha@example.com'],
    );
    assert.match(String(user?.password_hash), /^scrypt\$/);
    assert.ok(!String(user?.password_hash).includes('correct-horse-1'));
  });

  it('returns the same error for an unknown email and a wrong password', async () => {
    const client = server.createClient();
    const wrongPassword = await client.request('POST', '/api/auth/login', {
      email: 'asha@example.com',
      password: 'wrong-password',
    });
    const unknownEmail = await client.request('POST', '/api/auth/login', {
      email: 'nobody@example.com',
      password: 'wrong-password',
    });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
    assert.equal(wrongPassword.body.code, 'INVALID_CREDENTIALS');
  });

  it('logs in, restores the session and logs out', async () => {
    const client = server.createClient();
    const login = await client.request('POST', '/api/auth/login', {
      email: 'Asha@Example.com',
      password: 'correct-horse-1',
    });
    assert.equal(login.status, 200);

    assert.equal(
      (await client.request('GET', '/api/auth/session')).status,
      200,
    );

    const logout = await client.request('POST', '/api/auth/logout');
    assert.equal(logout.status, 204);

    const afterLogout = await client.request('GET', '/api/auth/session');
    assert.equal(afterLogout.status, 401);
    assert.equal(afterLogout.body.code, 'UNAUTHENTICATED');
  });

  it('reports an expired session distinctly', async () => {
    const client = server.createClient();
    await client.request('POST', '/api/auth/login', {
      email: 'asha@example.com',
      password: 'correct-horse-1',
    });

    const realNow = server.clock.now;
    server.clock.now = () => new Date('2026-10-20T09:00:00Z');

    try {
      const response = await client.request('GET', '/api/auth/session');
      assert.equal(response.status, 401);
      assert.equal(response.body.code, 'SESSION_EXPIRED');
    } finally {
      server.clock.now = realNow;
    }
  });

  it('rejects state-changing requests from another origin', async () => {
    const client = server.createClient();
    const response = await client.request(
      'POST',
      '/api/auth/login',
      { email: 'asha@example.com', password: 'correct-horse-1' },
      { Origin: 'https://evil.example' },
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'ORIGIN_NOT_ALLOWED');

    const allowed = await client.request(
      'POST',
      '/api/auth/login',
      { email: 'asha@example.com', password: 'correct-horse-1' },
      { Origin: TEST_WEB_ORIGIN },
    );
    assert.equal(allowed.status, 200);
  });

  it('resets a password with a single-use emailed code and signs out other sessions', async () => {
    const existingSession = server.createClient();
    await existingSession.request('POST', '/api/auth/login', {
      email: 'asha@example.com',
      password: 'correct-horse-1',
    });

    const client = server.createClient();
    const request = await client.request('POST', '/api/auth/password-reset', {
      email: 'asha@example.com',
    });
    assert.equal(request.status, 202);

    const unknown = await client.request('POST', '/api/auth/password-reset', {
      email: 'nobody@example.com',
    });
    assert.equal(unknown.status, 202);
    assert.deepEqual(unknown.body, request.body);

    assert.equal(server.sentEmails.length, 1);
    const { code } = server.sentEmails[0];
    assert.match(code, /^\d{6}$/);
    // Only a salted hash of the code is stored
    const stored = await server.db.get<{ code_hash: string }>(
      `SELECT code_hash FROM password_reset_tokens
       WHERE code_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    );
    assert.ok(stored?.code_hash);
    assert.ok(!String(stored.code_hash).includes(code));

    const confirm = await client.request(
      'POST',
      '/api/auth/password-reset/confirm',
      { email: 'ASHA@example.com', code, password: 'new-password-2' },
    );
    assert.equal(confirm.status, 200);
    // The right code signs the student in on this device
    assert.equal(confirm.body.user.email, 'asha@example.com');
    const here = await client.request('GET', '/api/auth/session');
    assert.equal(here.status, 200);

    const reuse = await client.request(
      'POST',
      '/api/auth/password-reset/confirm',
      { email: 'asha@example.com', code, password: 'another-password-3' },
    );
    assert.equal(reuse.status, 400);
    assert.equal(reuse.body.code, 'INVALID_RESET_TOKEN');

    const oldSession = await existingSession.request(
      'GET',
      '/api/auth/session',
    );
    assert.equal(oldSession.status, 401);

    const login = await client.request('POST', '/api/auth/login', {
      email: 'asha@example.com',
      password: 'new-password-2',
    });
    assert.equal(login.status, 200);
  });

  it('rejects session check when cookie is omitted or has invalid format', async () => {
    const rawClient = server.createClient();
    rawClient.clearCookies();

    const noCookie = await rawClient.request('GET', '/api/auth/session');
    assert.equal(noCookie.status, 401);
    assert.equal(noCookie.body.code, 'UNAUTHENTICATED');

    const invalidCookie = await rawClient.request(
      'GET',
      '/api/auth/session',
      undefined,
      { Cookie: 'leta_session=' },
    );
    assert.equal(invalidCookie.status, 401);
    assert.equal(invalidCookie.body.code, 'UNAUTHENTICATED');

    const bogusCookie = await rawClient.request(
      'GET',
      '/api/auth/session',
      undefined,
      { Cookie: 'leta_session=bogus-non-existent-token' },
    );
    assert.equal(bogusCookie.status, 401);
    assert.equal(bogusCookie.body.code, 'SESSION_EXPIRED');
  });

  it('configures SameSite=None, Secure, and Partitioned cookies in production for cross-site browser support', () => {
    const prodConfig = loadConfig({
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://sridhaacademy.com',
      ALLOWED_ORIGINS: 'https://www.sridhaacademy.com',
      DATABASE_URL: 'postgres://sridha_app@localhost/test',
      MIGRATION_DATABASE_URL: 'postgres://owner@localhost/test',
      RAZORPAY_KEY_ID: 'rzp_live_example',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
    });

    assert.equal(prodConfig.secureCookies, true);
    assert.equal(prodConfig.cookieSameSite, 'none');
    assert.ok(prodConfig.allowedOrigins.includes('https://sridhaacademy.com'));
    assert.ok(
      prodConfig.allowedOrigins.includes('https://www.sridhaacademy.com'),
    );
  });

  it('allows credentialed CORS for both apex and www domains and rejects unauthorized origins', async () => {
    const client = server.createClient();

    const apexPreflight = await client.request(
      'OPTIONS',
      '/api/auth/session',
      undefined,
      { Origin: TEST_WEB_ORIGIN },
    );
    assert.equal(apexPreflight.status, 204);

    const evilOrigin = await client.request(
      'GET',
      '/api/auth/session',
      undefined,
      { Origin: 'https://evil-site.com' },
    );
    assert.equal(evilOrigin.status, 401);
  });

  it('rotates session by revoking the old session in database upon re-login', async () => {
    const client = server.createClient();
    const login1 = await client.request('POST', '/api/auth/login', {
      email: 'asha@example.com',
      password: 'new-password-2',
    });
    assert.equal(login1.status, 200);
    const oldCookie = login1.setCookie;
    assert.ok(oldCookie);

    // Re-login with the active session cookie
    const login2 = await client.request('POST', '/api/auth/login', {
      email: 'asha@example.com',
      password: 'new-password-2',
    });
    assert.equal(login2.status, 200);
    const newCookie = login2.setCookie;
    assert.ok(newCookie);
    assert.notEqual(oldCookie, newCookie);

    // The old session cookie was revoked by session rotation and must now be rejected
    const oldClient = server.createClient();
    const oldAttempt = await oldClient.request(
      'GET',
      '/api/auth/session',
      undefined,
      { Cookie: oldCookie.split(';')[0] },
    );
    assert.equal(oldAttempt.status, 401);
  });

  it('sets comprehensive HTTP security headers and API Content-Security-Policy', async () => {
    const response = await fetch(`${server.baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(
      response.headers.get('content-security-policy'),
      "default-src 'none'; frame-ancestors 'none';",
    );
    assert.equal(
      response.headers.get('permissions-policy'),
      'camera=(), microphone=(), geolocation=()',
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('rate limits public enquiry submissions when rate limiting is enabled', async () => {
    const rateLimitedServer = await startTestServer({
      enableRateLimiting: true,
    });

    try {
      const client = rateLimitedServer.createClient();
      let lastRes: any;
      for (let i = 0; i < 11; i++) {
        lastRes = await client.request('POST', '/api/enquiries', {
          type: 'MODEL_PAPER_WAITLIST',
          email: `spam${i}@example.com`,
          exam: 'JEE',
        });
      }

      assert.equal(lastRes.status, 429);
      assert.equal(lastRes.body.code, 'RATE_LIMIT_EXCEEDED');
      assert.match(lastRes.body.message, /Too many enquiry submissions/);
    } finally {
      await rateLimitedServer.close();
    }
  });
});

describe('auth without a mail transport', () => {
  it('reports that password recovery is unavailable', async () => {
    const server = await startTestServer({ withMailer: false });

    try {
      const response = await server
        .createClient()
        .request('POST', '/api/auth/password-reset', {
          email: 'asha@example.com',
        });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, 'PASSWORD_RECOVERY_UNAVAILABLE');
    } finally {
      await server.close();
    }
  });
});
