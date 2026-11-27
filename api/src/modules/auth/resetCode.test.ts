import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
} from '../../test/testServer.js';

const PASSWORD = 'correct-horse-1';

describe('forgot password codes', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  const signUp = (email: string) =>
    server.signUpStudent({ fullName: 'Kiran Rao', email, password: PASSWORD });

  const askForCode = async (email: string) => {
    const before = server.sentEmails.length;
    const response = await server
      .createClient()
      .request('POST', '/api/auth/password-reset', { email });
    assert.equal(response.status, 202);
    return server.sentEmails.length > before
      ? server.sentEmails.at(-1)!.code
      : null;
  };

  const confirm = (email: string, code: string, password = 'new-password-2') =>
    server.createClient().request('POST', '/api/auth/password-reset/confirm', {
      email,
      code,
      password,
    });

  // Any code other than the right one
  const wrongCode = (code: string) =>
    String((Number(code) + 1) % 1_000_000).padStart(6, '0');

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
  });

  it('stops accepting a code after five wrong tries', async () => {
    await signUp('kiran@example.com');
    const code = (await askForCode('kiran@example.com'))!;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await confirm('kiran@example.com', wrongCode(code));
      assert.equal(response.status, 400);
      assert.equal(response.body.code, 'INVALID_RESET_TOKEN');
    }

    // Even the right code is refused now; a new code is needed
    const locked = await confirm('kiran@example.com', code);
    assert.equal(locked.status, 400);

    const login = await server
      .createClient()
      .request('POST', '/api/auth/login', {
        email: 'kiran@example.com',
        password: PASSWORD,
        rememberMe: false,
      });
    assert.equal(login.status, 200);
  });

  it('only accepts the newest code', async () => {
    const first = (await askForCode('kiran@example.com'))!;
    const second = (await askForCode('kiran@example.com'))!;

    if (first !== second) {
      const old = await confirm('kiran@example.com', first);
      assert.equal(old.status, 400);
    }
    const fresh = await confirm('kiran@example.com', second);
    assert.equal(fresh.status, 200);
  });

  it('never sends a code to a team account, so staff never get a password', async () => {
    const code = await askForCode(TEST_SUPER_ADMIN_EMAIL);
    assert.equal(code, null);

    const guess = await confirm(TEST_SUPER_ADMIN_EMAIL, '123456');
    assert.equal(guess.status, 400);
    const admin = await server.db.get<{ password_hash: string | null }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [TEST_SUPER_ADMIN_EMAIL],
    );
    assert.equal(admin?.password_hash, null);
  });

  it('lets a checkout buyer set a password through the emailed code', async () => {
    await server.db.query(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ('usr_buyer_reset', 'paid@example.com', NULL, 'STUDENT', $1, $1)`,
      [new Date().toISOString()],
    );
    const code = (await askForCode('paid@example.com'))!;

    const response = await confirm('paid@example.com', code, PASSWORD);
    assert.equal(response.status, 200);
    assert.equal(response.body.user.id, 'usr_buyer_reset');
  });

  it('checks the email, the 6-digit code and the new password', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/password-reset/confirm', {
        email: 'not-an-email',
        code: '12ab',
        password: 'short',
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'REQUEST_VALIDATION_FAILED');
    assert.deepEqual(
      response.body.details.body
        .map((issue: { path: string[] }) => issue.path.join('.'))
        .sort(),
      ['code', 'email', 'password'],
    );
  });
});
