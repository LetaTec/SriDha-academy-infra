import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
  TEST_WEB_ORIGIN,
  validRegistration,
} from '../../test/testServer.js';

const tokenFrom = (signInUrl: string) => {
  const url = new URL(signInUrl);
  assert.equal(url.origin, TEST_WEB_ORIGIN);
  assert.equal(url.pathname, '/admin-sign-in');
  return url.searchParams.get('token') ?? '';
};

describe('super admin sign-in', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
  });

  const requestLink = async (email: string) => {
    const before = server.sentSignInLinks.length;
    const response = await server
      .createClient()
      .request('POST', '/api/auth/admin-sign-in', { email });
    assert.equal(response.status, 202);
    return server.sentSignInLinks.slice(before);
  };

  it('creates a password-free super admin account from SUPER_ADMIN_EMAILS', async () => {
    const user = await server.db.get<{
      role: string;
      password_hash: string | null;
    }>('SELECT role, password_hash FROM users WHERE LOWER(email) = LOWER($1)', [
      TEST_SUPER_ADMIN_EMAIL,
    ]);

    assert.equal(user?.role, 'SUPER_ADMIN');
    assert.equal(user?.password_hash, null);
  });

  it('emails a sign-in link to a super admin and nobody else, with the same response', async () => {
    const student = server.createClient();
    await student.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'student@example.com' }),
    );

    assert.deepEqual(await requestLink('student@example.com'), []);
    assert.deepEqual(await requestLink('nobody@example.com'), []);

    const sent = await requestLink(TEST_SUPER_ADMIN_EMAIL.toUpperCase());
    assert.equal(sent.length, 1);
    assert.equal(sent[0].email, TEST_SUPER_ADMIN_EMAIL);
    assert.ok(tokenFrom(sent[0].signInUrl).length > 20);
  });

  it('signs a super admin in once per link and reports the role', async () => {
    const [link] = await requestLink(TEST_SUPER_ADMIN_EMAIL);
    const token = tokenFrom(link.signInUrl);
    const client = server.createClient();

    const response = await client.request(
      'POST',
      '/api/auth/admin-sign-in/confirm',
      { token },
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.user.role, 'SUPER_ADMIN');
    assert.equal(response.body.user.student, null);
    assert.match(response.setCookie ?? '', /leta_session=.+; .*HttpOnly/i);

    const session = await client.request('GET', '/api/auth/session');
    assert.equal(session.status, 200);
    assert.equal(session.body.user.email, TEST_SUPER_ADMIN_EMAIL);
    assert.equal(session.body.user.role, 'SUPER_ADMIN');

    const reused = await server
      .createClient()
      .request('POST', '/api/auth/admin-sign-in/confirm', { token });
    assert.equal(reused.status, 400);
    assert.equal(reused.body.code, 'INVALID_SIGN_IN_LINK');
  });

  it('only honours the newest link, and only for 15 minutes', async () => {
    const [older] = await requestLink(TEST_SUPER_ADMIN_EMAIL);
    const [newer] = await requestLink(TEST_SUPER_ADMIN_EMAIL);
    const client = server.createClient();

    const olderResponse = await client.request(
      'POST',
      '/api/auth/admin-sign-in/confirm',
      { token: tokenFrom(older.signInUrl) },
    );
    assert.equal(olderResponse.body.code, 'INVALID_SIGN_IN_LINK');

    const realNow = server.clock.now;
    server.clock.now = () => new Date(realNow().getTime() + 16 * 60 * 1000);
    try {
      const expired = await client.request(
        'POST',
        '/api/auth/admin-sign-in/confirm',
        { token: tokenFrom(newer.signInUrl) },
      );
      assert.equal(expired.status, 400);
      assert.equal(expired.body.code, 'INVALID_SIGN_IN_LINK');
    } finally {
      server.clock.now = realNow;
    }
  });

  it('never accepts a password for a password-free account', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/login', {
        email: TEST_SUPER_ADMIN_EMAIL,
        password: 'anything-at-all',
      });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'INVALID_CREDENTIALS');
  });

  it('gives students the student role', async () => {
    const client = server.createClient();
    const response = await client.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'learner@example.com' }),
    );

    assert.equal(response.body.user.role, 'STUDENT');
  });

  it('promotes and demotes existing accounts to match SUPER_ADMIN_EMAILS', async () => {
    const email = 'teacher@example.com';
    const client = server.createClient();
    await client.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email }),
    );

    await server.syncStaff({
      superAdminEmails: [TEST_SUPER_ADMIN_EMAIL, email],
    });
    const promoted = await client.request('GET', '/api/auth/session');
    assert.equal(promoted.body.user.role, 'SUPER_ADMIN');
    assert.equal(promoted.body.user.student.fullName, 'Asha Verma');

    const [link] = await requestLink(email);

    await server.syncStaff({ superAdminEmails: [TEST_SUPER_ADMIN_EMAIL] });
    const demoted = await client.request('GET', '/api/auth/session');
    assert.equal(demoted.body.user.role, 'STUDENT');

    // A link issued while they were an admin stops working once demoted.
    const response = await server
      .createClient()
      .request('POST', '/api/auth/admin-sign-in/confirm', {
        token: tokenFrom(link.signInUrl),
      });
    assert.equal(response.body.code, 'INVALID_SIGN_IN_LINK');
  });

  it('rejects unexpected fields on the sign-in requests', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/admin-sign-in', {
        email: TEST_SUPER_ADMIN_EMAIL,
        role: 'SUPER_ADMIN',
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'REQUEST_VALIDATION_FAILED');
  });
});

describe('super admin sign-in without a mail transport', () => {
  it('reports that email sign-in is unavailable', async () => {
    const server = await startTestServer({ withMailer: false });
    try {
      const response = await server
        .createClient()
        .request('POST', '/api/auth/admin-sign-in', {
          email: TEST_SUPER_ADMIN_EMAIL,
        });

      assert.equal(response.status, 503);
      assert.equal(response.body.code, 'SIGN_IN_LINK_UNAVAILABLE');
    } finally {
      await server.close();
    }
  });
});
