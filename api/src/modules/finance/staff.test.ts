import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { loadConfig } from '../../config/env.js';
import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
  validRegistration,
  type TestClient,
} from '../../test/testServer.js';

const FINANCE_EMAIL = 'finance@sridha.test';
const OPERATIONS_EMAIL = 'operations@sridha.test';

describe('staff roles and the finance audit log', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let superAdmin: TestClient;
  let finance: TestClient;
  let operations: TestClient;
  let student: TestClient;

  before(async () => {
    server = await startTestServer({
      financeAdminEmails: [FINANCE_EMAIL],
      operationsAdminEmails: [OPERATIONS_EMAIL],
    });
    superAdmin = await server.signInStaff(TEST_SUPER_ADMIN_EMAIL);
    finance = await server.signInStaff(FINANCE_EMAIL);
    operations = await server.signInStaff(OPERATIONS_EMAIL);
    student = server.createClient();
    await student.request('POST', '/api/auth/register', validRegistration());
  });

  after(async () => {
    await server.close();
  });

  it('gives each listed email its staff role, with a sign-in link for every staff role', async () => {
    for (const [client, role] of [
      [superAdmin, 'SUPER_ADMIN'],
      [finance, 'FINANCE_ADMIN'],
      [operations, 'OPERATIONS_ADMIN'],
    ] as const) {
      const session = await client.request('GET', '/api/auth/session');
      assert.equal(session.status, 200);
      assert.equal(session.body.user.role, role);
      assert.equal(session.body.user.student, null);
    }

    // A student asking for a staff link gets the same answer and no email
    const before = server.sentSignInLinks.length;
    const asked = await server
      .createClient()
      .request('POST', '/api/auth/admin-sign-in', {
        email: 'asha@example.com',
      });
    assert.equal(asked.status, 202);
    assert.equal(server.sentSignInLinks.length, before);
  });

  it('lets finance and super admins see orders, and no one else', async () => {
    const statusFor = async (client: TestClient) =>
      (await client.request('GET', '/api/admin/orders')).status;

    assert.equal(await statusFor(superAdmin), 200);
    assert.equal(await statusFor(finance), 200);
    assert.equal(await statusFor(operations), 403);
    assert.equal(await statusFor(student), 403);
    assert.equal(await statusFor(server.createClient()), 401);
  });

  it('records every role change, and shows the audit log to super admins only', async () => {
    const log = await superAdmin.request('GET', '/api/finance/audit-log');
    assert.equal(log.status, 200);
    const granted = log.body.entries.filter(
      (entry: { action: string }) => entry.action === 'ROLE_GRANTED',
    );
    assert.deepEqual(
      granted
        .map((entry: { details: { role: string } }) => entry.details.role)
        .sort(),
      ['FINANCE_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN'],
    );
    assert.ok(
      granted.every(
        (entry: { actorUserId: string | null }) => entry.actorUserId === null,
      ),
      'role changes from configuration are made by the system',
    );

    assert.equal(
      (await finance.request('GET', '/api/finance/audit-log')).status,
      403,
    );
    assert.equal(
      (await operations.request('GET', '/api/finance/audit-log')).status,
      403,
    );
    assert.equal(
      (await server.createClient().request('GET', '/api/finance/audit-log'))
        .status,
      401,
    );
  });

  it('keeps the audit log append-only at the database', async () => {
    for (const change of [
      "UPDATE finance_audit_log SET action = 'EDITED'",
      'DELETE FROM finance_audit_log',
    ]) {
      await assert.rejects(
        () => server.db.query(change),
        (error: { code?: string }) => error.code === '42501',
        change,
      );
    }
  });

  it('returns a staff member to student and records it when they leave the list', async () => {
    const restarted = await startTestServer({
      financeAdminEmails: [FINANCE_EMAIL],
    });
    try {
      // The same database seen by a second sync with the finance email gone
      await restarted.syncStaff({ financeAdminEmails: [] });
      const row = await restarted.db.get<{ role: string }>(
        'SELECT role FROM users WHERE email = $1',
        [FINANCE_EMAIL],
      );
      assert.equal(row?.role, 'STUDENT');
      const revoked = await restarted.db.all<Record<string, unknown>>(
        "SELECT details FROM finance_audit_log WHERE action = 'ROLE_REVOKED'",
      );
      assert.deepEqual(
        revoked.map(entry => entry.details),
        [{ email: FINANCE_EMAIL, role: 'FINANCE_ADMIN' }],
      );
    } finally {
      await restarted.close();
    }
  });
});

describe('staff role configuration', () => {
  it('refuses an email listed under two staff roles, or one that is not an email', () => {
    assert.throws(
      () =>
        loadConfig({
          NODE_ENV: 'development',
          SUPER_ADMIN_EMAILS: 'owner@sridha.test',
          FINANCE_ADMIN_EMAILS: 'Owner@sridha.test',
        }),
      /more than one staff role.*owner@sridha\.test/,
    );
    assert.throws(
      () =>
        loadConfig({
          NODE_ENV: 'development',
          OPERATIONS_ADMIN_EMAILS: 'not-an-email',
        }),
      /OPERATIONS_ADMIN_EMAILS/,
    );
    assert.deepEqual(
      loadConfig({
        NODE_ENV: 'development',
        FINANCE_ADMIN_EMAILS: ' Finance@Sridha.test ,',
      }).financeAdminEmails,
      ['finance@sridha.test'],
    );
  });
});
