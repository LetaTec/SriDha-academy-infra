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

const MORE_BATCHES_MIGRATION = '008_ray_optics_more_batches';
const RAY_OPTICS_TOPIC_ID = 'topic_physics_ray_optics_class_12';

type BatchRow = {
  id: string;
  name: string;
  schedule_label: string;
  start_date: string;
  start_time: string;
  session_count: number;
  capacity: number;
  status: string;
  position: number;
};

const RAY_OPTICS_BATCHES_SQL = `
  SELECT id, name, schedule_label, start_date, start_time, session_count,
    capacity, status, position
  FROM batches WHERE topic_id = $1 ORDER BY position
`;

// A database migrated up to (not including) the given migration
const migrateBefore = async (
  db: Awaited<ReturnType<typeof openDatabase>>,
  migrationId: string,
) => {
  await db.exec(
    'CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)',
  );
  for (const migration of MIGRATIONS.filter(item => item.id < migrationId)) {
    await db.exec(migration.sql);
    await db.query(
      'INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)',
      [migration.id, new Date().toISOString()],
    );
  }
};

describe('migration 008: more Ray optics batches', () => {
  it('adds the January and February batches beside December on a seeded database', async () => {
    const db = await openDatabase(':memory:');
    try {
      // Production before 008: seeded with December only
      await migrateBefore(db, MORE_BATCHES_MIGRATION);
      await seedCatalogue(db);
      await db.query(
        "DELETE FROM batches WHERE topic_id = $1 AND id <> 'batch_physics_ray_optics_class_12_december'",
        [RAY_OPTICS_TOPIC_ID],
      );

      await runMigrations(db);

      const rows = await db.all<BatchRow>(RAY_OPTICS_BATCHES_SQL, [
        RAY_OPTICS_TOPIC_ID,
      ]);
      assert.deepEqual(
        rows.map(row => [row.name, row.schedule_label, row.start_date]),
        [
          ['December batch', '1st & 2nd December', '2026-12-01'],
          ['January batch', '5th & 6th January', '2027-01-05'],
          ['February batch', '2nd & 3rd February', '2027-02-02'],
        ],
      );
    } finally {
      await db.close();
    }
  });

  it('writes the same batches as the seed', async () => {
    const migrated = await openDatabase(':memory:');
    const seeded = await openDatabase(':memory:');
    try {
      await migrateBefore(migrated, MORE_BATCHES_MIGRATION);
      await seedCatalogue(migrated);
      await migrated.query(
        "DELETE FROM batches WHERE topic_id = $1 AND id <> 'batch_physics_ray_optics_class_12_december'",
        [RAY_OPTICS_TOPIC_ID],
      );
      await runMigrations(migrated);

      await runMigrations(seeded);
      await seedCatalogue(seeded);

      assert.deepEqual(
        await migrated.all<BatchRow>(RAY_OPTICS_BATCHES_SQL, [
          RAY_OPTICS_TOPIC_ID,
        ]),
        await seeded.all<BatchRow>(RAY_OPTICS_BATCHES_SQL, [
          RAY_OPTICS_TOPIC_ID,
        ]),
      );
    } finally {
      await migrated.close();
      await seeded.close();
    }
  });

  it('adds nothing where Ray optics does not exist yet', async () => {
    const db = await openDatabase(':memory:');
    try {
      await runMigrations(db);
      const { count } = (await db.get<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM batches',
      )) ?? { count: -1 };
      assert.equal(count, 0);
    } finally {
      await db.close();
    }
  });
});
