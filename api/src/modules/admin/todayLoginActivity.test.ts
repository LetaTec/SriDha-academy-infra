import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
  type TestClient,
  validRegistration,
} from '../../test/testServer.js';

describe('today login activity', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let student: TestClient;
  let finance: TestClient;
  let owner: TestClient;
  let studentId: string;

  before(async () => {
    const now = new Date('2026-10-10T09:00:00Z');
    server = await startTestServer({
      now: () => now,
      financeAdminEmails: ['finance@example.com'],
    });

    student = server.createClient();
    const registered = await student.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'student@example.com' }),
    );
    studentId = String(registered.body.user.id);

    owner = await server.signInStaff(TEST_SUPER_ADMIN_EMAIL);
    finance = await server.signInStaff('finance@example.com');

    await server.db.query(
      `INSERT INTO auth_session_history
        (session_id, user_id, started_at)
       VALUES ($1, $2, $3)`,
      ['yesterday-session', studentId, '2026-10-09T18:29:59.999Z'],
    );
  });

  after(async () => {
    await server.close();
  });

  it('lists successful sign-ins for today in India time, including signed-out users', async () => {
    await student.request('POST', '/api/auth/logout');
    const response = await owner.request('GET', '/api/admin/activity/today');

    assert.equal(response.status, 200);
    assert.equal(response.body.logins.length, 3);
    assert.deepEqual(
      response.body.logins
        .map((login: { email: string }) => login.email)
        .sort(),
      ['admin@sridha.test', 'finance@example.com', 'student@example.com'],
    );
    assert.ok(
      response.body.logins.every(
        (login: { startedAt: string }) =>
          new Date(login.startedAt).getTime() ===
          new Date('2026-10-10T09:00:00.000Z').getTime(),
      ),
    );
  });

  it('keeps login activity available to super admins only', async () => {
    const asFinance = await finance.request('GET', '/api/admin/activity/today');
    assert.equal(asFinance.status, 403);

    const signedInStudent = server.createClient();
    const login = await signedInStudent.request('POST', '/api/auth/login', {
      email: 'student@example.com',
      password: 'correct-horse-1',
      rememberMe: false,
    });
    assert.equal(login.status, 200);
    const asStudent = await signedInStudent.request(
      'GET',
      '/api/admin/activity/today',
    );
    assert.equal(asStudent.status, 403);

    const signedOut = await server
      .createClient()
      .request('GET', '/api/admin/activity/today');
    assert.equal(signedOut.status, 401);
  });
});
