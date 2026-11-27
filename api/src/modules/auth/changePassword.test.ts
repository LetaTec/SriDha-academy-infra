import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { startTestServer } from '../../test/testServer.js';

const EMAIL = 'leela@example.com';
const PASSWORD = 'correct-horse-1';

describe('change password', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer();
    await server.signUpStudent({
      fullName: 'Leela Das',
      email: EMAIL,
      password: PASSWORD,
    });
  });

  after(async () => {
    await server.close();
  });

  const signIn = async (password = PASSWORD) => {
    const client = server.createClient();
    const response = await client.request('POST', '/api/auth/login', {
      email: EMAIL,
      password,
      rememberMe: true,
    });
    return { client, status: response.status };
  };

  it('needs a signed-in account', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/change-password', {
        currentPassword: PASSWORD,
        newPassword: 'new-password-2',
      });
    assert.equal(response.status, 401);
  });

  it('refuses a wrong current password and changes nothing', async () => {
    const { client } = await signIn();
    const response = await client.request('POST', '/api/auth/change-password', {
      currentPassword: 'not-my-password',
      newPassword: 'new-password-2',
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'CURRENT_PASSWORD_INCORRECT');
    assert.equal((await signIn()).status, 200);
  });

  it('changes the password, keeps this device signed in and signs out the others', async () => {
    const { client: here } = await signIn();
    const { client: elsewhere } = await signIn();

    const response = await here.request('POST', '/api/auth/change-password', {
      currentPassword: PASSWORD,
      newPassword: 'new-password-2',
    });
    assert.equal(response.status, 204);

    assert.equal((await here.request('GET', '/api/auth/session')).status, 200);
    assert.equal(
      (await elsewhere.request('GET', '/api/auth/session')).status,
      401,
    );
    assert.equal((await signIn(PASSWORD)).status, 401);
    assert.equal((await signIn('new-password-2')).status, 200);
  });

  it('checks the new password and accepts nothing else', async () => {
    const { client } = await signIn('new-password-2');
    const short = await client.request('POST', '/api/auth/change-password', {
      currentPassword: 'new-password-2',
      newPassword: 'short',
    });
    assert.equal(short.status, 400);
    assert.equal(short.body.code, 'REQUEST_VALIDATION_FAILED');

    const extra = await client.request('POST', '/api/auth/change-password', {
      currentPassword: 'new-password-2',
      newPassword: 'another-pass-3',
      userId: 'someone-else',
    });
    assert.equal(extra.status, 400);
  });
});
