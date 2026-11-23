import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
} from '../../test/testServer.js';

const PASSWORD = 'correct-horse-1';

describe('student sign-up', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
  });

  it('signs a student up with a name, email and password, and keeps them signed in', async () => {
    const client = server.createClient();
    const response = await client.request('POST', '/api/auth/sign-up', {
      fullName: '  Meera Iyer ',
      email: 'Meera@Example.com',
      password: PASSWORD,
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.user.email, 'meera@example.com');
    assert.equal(response.body.user.name, 'Meera Iyer');
    assert.equal(response.body.user.role, 'STUDENT');
    assert.equal(response.body.user.student, null);
    // Stays signed in on this device (a lasting cookie, not a browser one)
    assert.match(response.setCookie ?? '', /leta_session=.+; .*HttpOnly/i);
    assert.match(response.setCookie ?? '', /Max-Age=|Expires=/i);

    const session = await client.request('GET', '/api/auth/session');
    assert.equal(session.status, 200);
    assert.equal(session.body.user.name, 'Meera Iyer');

    const stored = await server.db.get<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      ['meera@example.com'],
    );
    assert.match(String(stored?.password_hash), /^scrypt\$/);
  });

  it('signs the same student back in with their password', async () => {
    const client = server.createClient();
    const response = await client.request('POST', '/api/auth/login', {
      email: 'meera@example.com',
      password: PASSWORD,
      rememberMe: true,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.user.name, 'Meera Iyer');
  });

  it('asks an email that already has a password to sign in instead', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/sign-up', {
        fullName: 'Someone Else',
        email: 'MEERA@example.com',
        password: 'another-pass-2',
      });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'EMAIL_ALREADY_REGISTERED');
    assert.equal(response.setCookie, null);
  });

  it('lets a checkout buyer set a password on their billing email', async () => {
    await server.db.query(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ('usr_buyer_1', 'buyer@example.com', NULL, 'STUDENT', $1, $1)`,
      [new Date().toISOString()],
    );
    // A password-less buyer record cannot sign in before this
    const before = await server
      .createClient()
      .request('POST', '/api/auth/login', {
        email: 'buyer@example.com',
        password: PASSWORD,
        rememberMe: false,
      });
    assert.equal(before.status, 401);

    const response = await server
      .createClient()
      .request('POST', '/api/auth/sign-up', {
        fullName: 'Ravi Kumar',
        email: 'buyer@example.com',
        password: PASSWORD,
      });

    assert.equal(response.status, 201);
    // The same account, so seats bought with this email stay with it
    assert.equal(response.body.user.id, 'usr_buyer_1');
    assert.equal(response.body.user.name, 'Ravi Kumar');
  });

  it('never gives a password to a staff account', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/sign-up', {
        fullName: 'Not Staff',
        email: TEST_SUPER_ADMIN_EMAIL,
        password: PASSWORD,
      });

    assert.equal(response.status, 409);
    const admin = await server.db.get<{ password_hash: string | null }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [TEST_SUPER_ADMIN_EMAIL],
    );
    assert.equal(admin?.password_hash, null);
  });

  it('checks the name, email and password, and accepts nothing else', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/sign-up', {
        fullName: 'A',
        email: 'not-an-email',
        password: 'short',
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'REQUEST_VALIDATION_FAILED');
    assert.deepEqual(
      response.body.details.body
        .map((issue: { path: string[] }) => issue.path.join('.'))
        .sort(),
      ['email', 'fullName', 'password'],
    );

    const extra = await server
      .createClient()
      .request('POST', '/api/auth/sign-up', {
        fullName: 'Asha Verma',
        email: 'asha.extra@example.com',
        password: PASSWORD,
        role: 'SUPER_ADMIN',
      });
    assert.equal(extra.status, 400);
  });
});
