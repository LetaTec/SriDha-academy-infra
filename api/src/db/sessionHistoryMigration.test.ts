import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { openDatabase } from './client.js';
import { MIGRATIONS } from './migrations.js';

describe('migration 030: auth session history', () => {
  it('backfills sessions present when the migration is applied', async () => {
    const db = await openDatabase(':memory:');
    try {
      await db.exec(
        'CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)',
      );
      const position = MIGRATIONS.findIndex(
        migration => migration.id === '030_auth_session_history',
      );
      assert.ok(position >= 0);

      for (const migration of MIGRATIONS.slice(0, position)) {
        await db.exec(migration.sql);
        await db.query(
          'INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)',
          [migration.id, new Date().toISOString()],
        );
      }

      await db.query(
        `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, NULL, 'STUDENT', $3, $3)`,
        ['history-user', 'history@example.com', '2026-10-10T09:00:00.000Z'],
      );
      await db.query(
        `INSERT INTO sessions (id, user_id, created_at, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [
          'history-session',
          'history-user',
          '2026-10-10T09:00:00.000Z',
          '2026-10-11T09:00:00.000Z',
        ],
      );

      const migration = MIGRATIONS[position];
      assert.ok(migration);
      await db.exec(migration.sql);

      const row = await db.get<{
        session_id: string;
        user_id: string;
        started_at: string | Date;
      }>(
        `SELECT session_id, user_id, started_at
         FROM auth_session_history WHERE session_id = $1`,
        ['history-session'],
      );
      assert.equal(row?.session_id, 'history-session');
      assert.equal(row?.user_id, 'history-user');
      assert.equal(
        new Date(String(row?.started_at)).toISOString(),
        '2026-10-10T09:00:00.000Z',
      );
    } finally {
      await db.close();
    }
  });
});
