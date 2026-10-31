import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { seedCatalogue } from './catalogueSeed.js';
import { openDatabase, runMigrations } from './client.js';
import { MIGRATIONS } from './migrations.js';
import { TOPIC_LIBRARY } from './topicLibrary.js';

const CARD_FIELDS_MIGRATION = '007_topic_card_fields';

describe('migration 007: topic card fields', () => {
  it('fills card names, icons and featured ranks on a database seeded before it', async () => {
    const db = await openDatabase(':memory:');
    try {
      // A production-like database: migrated and seeded up to 006
      const before = MIGRATIONS.filter(
        migration => migration.id < CARD_FIELDS_MIGRATION,
      );
      await db.exec(
        'CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)',
      );
      for (const migration of before) {
        await db.exec(migration.sql);
        await db.query(
          'INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)',
          [migration.id, new Date().toISOString()],
        );
      }
      // The seed before 007 wrote no card fields; insert its topics bare
      await db.exec(`
        INSERT INTO subjects (id, slug, name, description, status, position)
          VALUES ('subject_accounts', 'accounts', 'Accounts', '', 'AVAILABLE', 0),
                 ('subject_chemistry', 'chemistry', 'Chemistry', '', 'AVAILABLE', 1);
        INSERT INTO chapters (id, subject_id, title, position)
          VALUES ('chapter_a', 'subject_accounts', 'A', 0),
                 ('chapter_c', 'subject_chemistry', 'C', 0);
        INSERT INTO topics (id, chapter_id, title, summary, level, position) VALUES
          ('topic_accounts_gst_class_11', 'chapter_a', 'Learn GST for Class 11', '', 'Class 11', 0),
          ('topic_chemistry_mole_concept_class_11', 'chapter_c', 'Learn the Mole concept for Class 11', '', 'Class 11', 0),
          ('topic_accounts_trial_balance_class_11', 'chapter_a', 'Learn Trial balance for Class 11', '', 'Class 11', 1);
      `);

      await runMigrations(db);

      const rows = await db.all<{
        id: string;
        short_title: string;
        icon: string | null;
        featured_rank: number | null;
      }>('SELECT id, short_title, icon, featured_rank FROM topics ORDER BY id');

      assert.deepEqual(rows, [
        {
          id: 'topic_accounts_gst_class_11',
          short_title: 'GST',
          icon: 'topicGst',
          featured_rank: 1,
        },
        {
          id: 'topic_accounts_trial_balance_class_11',
          short_title: 'Trial balance',
          icon: null,
          featured_rank: null,
        },
        {
          id: 'topic_chemistry_mole_concept_class_11',
          short_title: 'Mole concept',
          icon: 'topicMole',
          featured_rank: 5,
        },
      ]);
    } finally {
      await db.close();
    }
  });

  it('agrees with what the seed writes from the topic library', async () => {
    const db = await openDatabase(':memory:');
    try {
      await runMigrations(db);
      await seedCatalogue(db);
      const rows = await db.all<{
        id: string;
        short_title: string;
        icon: string | null;
        featured_rank: number | null;
      }>('SELECT id, short_title, icon, featured_rank FROM topics');
      const seeded = new Map(rows.map(row => [row.id, row]));

      for (const topic of TOPIC_LIBRARY) {
        const row = seeded.get(topic.id);
        assert.equal(row?.short_title, topic.title, topic.id);
        assert.equal(row?.icon, topic.icon ?? null, topic.id);
        assert.equal(row?.featured_rank, topic.featuredRank ?? null, topic.id);
      }
    } finally {
      await db.close();
    }
  });
});
