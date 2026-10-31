import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { runMigrations } from '../db/client.js';
import { startTestServer } from './testServer.js';

describe('database & migrations (PostgreSQL)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
  });

  it('runs migrations deterministically and records history in schema_migrations', async () => {
    const migrations = await server.db.all<{ id: string }>(
      'SELECT id FROM schema_migrations ORDER BY id',
    );
    const ids = migrations.map(m => m.id);

    assert.ok(ids.includes('001_initial_schema'));
    assert.ok(ids.includes('002_model_paper_waitlist'));
    assert.ok(ids.includes('003_student_stream_other'));

    // Re-running migrations is completely idempotent
    await runMigrations(server.db);
    const afterRerun = await server.db.all<{ id: string }>(
      'SELECT id FROM schema_migrations ORDER BY id',
    );
    assert.equal(afterRerun.length, ids.length);
  });

  it('enforces case-insensitive uniqueness on user emails in PostgreSQL', async () => {
    const timestamp = new Date().toISOString();
    await server.db.query(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
      [
        'u-test-case-1',
        'unique_test@example.com',
        'hash1',
        timestamp,
        timestamp,
      ],
    );

    // Attempt duplicate with different casing
    await assert.rejects(
      async () => {
        await server.db.query(
          'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
          [
            'u-test-case-2',
            'UNIQUE_TEST@EXAMPLE.COM',
            'hash2',
            timestamp,
            timestamp,
          ],
        );
      },
      (error: any) => {
        return (
          error.code === '23505' ||
          /duplicate key/i.test(error.message) ||
          /unique/i.test(error.message)
        );
      },
    );
  });

  it('enforces foreign key cascading deletes (user -> profile & sessions)', async () => {
    const timestamp = new Date().toISOString();
    const userId = 'u-cascade-test';

    await server.db.query(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'cascade@example.com', 'hash', timestamp, timestamp],
    );

    await server.db.query(
      `INSERT INTO student_profiles
        (id, user_id, full_name, date_of_birth, mobile, standard, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'sp-cascade-test',
        userId,
        'Cascade Test',
        '2008-01-01',
        '1234567890',
        'CLASS_11',
        timestamp,
        timestamp,
      ],
    );

    await server.db.query(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
      ['sess-cascade-test', userId, timestamp, timestamp],
    );

    // Delete the user
    await server.db.query('DELETE FROM users WHERE id = $1', [userId]);

    // Profile and sessions must be cascaded
    const profile = await server.db.get(
      'SELECT id FROM student_profiles WHERE user_id = $1',
      [userId],
    );
    const session = await server.db.get(
      'SELECT id FROM sessions WHERE user_id = $1',
      [userId],
    );

    assert.equal(profile, null);
    assert.equal(session, null);
  });

  it('rolls back atomic transactions on failure without leaving partial records', async () => {
    const timestamp = new Date().toISOString();
    const userId = 'u-tx-fail-test';

    await assert.rejects(async () => {
      await server.db.transaction(async tx => {
        await tx.query(
          'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
          [userId, 'tx_fail@example.com', 'hash', timestamp, timestamp],
        );

        // Force an intentional error inside the transaction
        throw new Error('Simulated transaction failure');
      });
    }, /Simulated transaction failure/);

    // Verify user was NOT persisted
    const user = await server.db.get('SELECT id FROM users WHERE id = $1', [
      userId,
    ]);
    assert.equal(user, null);
  });

  it('returns database: connected on /api/health', async () => {
    const client = server.createClient();
    const response = await client.request('GET', '/api/health');

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'ok');
    assert.equal(response.body.database, 'connected');
    assert.ok(response.body.timestamp);
  });

  it('enforces rate limiting on authentication routes when enabled', async () => {
    const rateLimitedServer = await startTestServer({
      enableRateLimiting: true,
    });

    try {
      const client = rateLimitedServer.createClient();
      let lastResponse: any;

      // Send 16 requests (max limit is 15)
      for (let i = 0; i < 16; i++) {
        lastResponse = await client.request('POST', '/api/auth/login', {
          email: `attempt${i}@example.com`,
          password: 'some-password',
        });
      }

      assert.equal(lastResponse.status, 429);
      assert.equal(lastResponse.body.code, 'RATE_LIMIT_EXCEEDED');
      assert.match(lastResponse.body.message, /Too many login attempts/);
    } finally {
      await rateLimitedServer.close();
    }
  });
});
