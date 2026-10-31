import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { startTestServer, validRegistration } from '../test/testServer.js';
import { runCleanup } from './cleanup.js';

const HOUR_MS = 60 * 60 * 1000;

describe('clean-up job', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
  });

  it('deletes expired sessions and one-time tokens and keeps live ones', async () => {
    const client = server.createClient();
    const registered = await client.request(
      'POST',
      '/api/auth/register',
      validRegistration({ email: 'cleanup@example.com' }),
    );
    assert.equal(registered.status, 201);
    const userId = String(registered.body.user.id);

    const now = server.clock.now();
    const past = new Date(now.getTime() - HOUR_MS).toISOString();
    const future = new Date(now.getTime() + HOUR_MS).toISOString();
    const created = new Date(now.getTime() - 2 * HOUR_MS).toISOString();

    for (const [table, id, expiresAt] of [
      ['sessions', 'expired-session', past],
      ['password_reset_tokens', 'expired-reset', past],
      ['password_reset_tokens', 'live-reset', future],
      ['sign_in_links', 'expired-link', past],
    ] as const) {
      await server.db.query(
        `INSERT INTO ${table} (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
        [id, userId, created, expiresAt],
      );
    }

    const removed = await runCleanup({ db: server.db, now: () => now });

    assert.deepEqual(removed, {
      sessions: 1,
      passwordResetTokens: 1,
      signInLinks: 1,
    });

    // The session from registering is still valid and still signs in
    const session = await client.request('GET', '/api/auth/session');
    assert.equal(session.status, 200);
    assert.equal(session.body.user.id, userId);

    const remainingResets = await server.db.all<{ id: string }>(
      'SELECT id FROM password_reset_tokens WHERE user_id = $1',
      [userId],
    );
    assert.deepEqual(
      remainingResets.map(row => row.id),
      ['live-reset'],
    );
  });
});
