import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

      // 007 by itself: later migrations (027) remove non-roster topics
      await runOnly(db, CARD_FIELDS_MIGRATION);

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

// A database migrated up to (not including) the given migration, chosen by
// its position in the list (the order migrations run), not by comparing ids
const migrateBefore = async (
  db: Awaited<ReturnType<typeof openDatabase>>,
  migrationId: string,
) => {
  // The table first: closing an in-memory database that has never run a
  // query does not settle, so a failed assertion must come after it
  await db.exec(
    'CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)',
  );
  const position = MIGRATIONS.findIndex(item => item.id === migrationId);
  assert.ok(position >= 0, `${migrationId} is a listed migration`);
  for (const migration of MIGRATIONS.slice(0, position)) {
    await db.exec(migration.sql);
    await db.query(
      'INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)',
      [migration.id, new Date().toISOString()],
    );
  }
};

// A seeded database on which data migrations have not run yet: they run
// again on the next start. Today's seed needs today's schema, so the
// database is migrated in full and the migrations are marked as not applied.
const seededWithout = async (
  db: Awaited<ReturnType<typeof openDatabase>>,
  ...migrationIds: string[]
) => {
  await runMigrations(db);
  await seedCatalogue(db);
  for (const migrationId of migrationIds) {
    await db.query('DELETE FROM schema_migrations WHERE id = $1', [
      migrationId,
    ]);
  }
};

// Runs one migration on its own, to check what it does by itself (later
// migrations may have changed the same rows since)
const runOnly = async (
  db: Awaited<ReturnType<typeof openDatabase>>,
  migrationId: string,
) => {
  const migration = MIGRATIONS.find(item => item.id === migrationId);
  assert.ok(migration, `${migrationId} is a listed migration`);
  await db.exec(migration.sql);
  await db.query(
    'INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)',
    [migration.id, new Date().toISOString()],
  );
};

// Removes the placeholder tutors and batches (see migrations.ts)
const PLACEHOLDER_CLEAN_UP = '026_remove_placeholder_tutors_and_batches';

// The Ray optics December batch as the seed wrote it before 026
const insertRayOpticsDecember = (
  db: Awaited<ReturnType<typeof openDatabase>>,
) =>
  db.query(
    `INSERT INTO batches (id, topic_id, name, schedule_label, start_date, start_time,
       session_count, session_duration_minutes, instructor_name, capacity, status, position)
     VALUES ('batch_physics_ray_optics_class_12_december', $1, 'December batch',
       '1st & 2nd December', '2026-12-01', '10:00', 2, NULL, NULL, 100, 'OPEN', 0)`,
    [RAY_OPTICS_TOPIC_ID],
  );

describe('migration 008: more Ray optics batches', () => {
  it('adds the January and February batches beside December on a seeded database', async () => {
    const db = await openDatabase(':memory:');
    try {
      // Production before 008: seeded with December only
      await seededWithout(db, MORE_BATCHES_MIGRATION);
      await db.query('DELETE FROM batches WHERE topic_id = $1', [
        RAY_OPTICS_TOPIC_ID,
      ]);
      await insertRayOpticsDecember(db);

      await runOnly(db, MORE_BATCHES_MIGRATION);

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

  it("ends with the seed's batches once 026 removes the placeholders", async () => {
    const migrated = await openDatabase(':memory:');
    const seeded = await openDatabase(':memory:');
    try {
      await seededWithout(
        migrated,
        MORE_BATCHES_MIGRATION,
        PLACEHOLDER_CLEAN_UP,
      );
      await migrated.query('DELETE FROM batches WHERE topic_id = $1', [
        RAY_OPTICS_TOPIC_ID,
      ]);
      await insertRayOpticsDecember(migrated);
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

const TUTORS_MIGRATION = '010_tutors';

describe('migration 010: tutors', () => {
  it("gives every existing topic its subject's tutor", async () => {
    const db = await openDatabase(':memory:');
    try {
      // Production before 010: topics with no tutor
      await migrateBefore(db, TUTORS_MIGRATION);
      await db.exec(`
        INSERT INTO subjects (id, slug, name, description, status, position)
          VALUES ('subject_accounts', 'accounts', 'Accounts', '', 'AVAILABLE', 0),
                 ('subject_new', 'new', 'New', '', 'AVAILABLE', 1);
        INSERT INTO chapters (id, subject_id, title, position)
          VALUES ('chapter_a', 'subject_accounts', 'A', 0),
                 ('chapter_n', 'subject_new', 'N', 0);
        INSERT INTO topics (id, chapter_id, title, summary, level, position) VALUES
          ('topic_gst', 'chapter_a', 'Learn GST for Class 11', '', 'Class 11', 0),
          ('topic_new', 'chapter_n', 'Learn New for Class 11', '', 'Class 11', 0);
      `);

      await runOnly(db, TUTORS_MIGRATION);

      assert.deepEqual(
        await db.all('SELECT id, tutor_id FROM topics ORDER BY id'),
        [
          { id: 'topic_gst', tutor_id: 'tutor_accounts' },
          // A subject with no tutor leaves its topics without one
          { id: 'topic_new', tutor_id: null },
        ],
      );
      const tutor = await db.get<{ name: string; credentials: string[] }>(
        "SELECT name, credentials FROM tutors WHERE id = 'tutor_accounts'",
      );
      assert.equal(typeof tutor?.name, 'string');
      assert.ok((tutor?.credentials.length ?? 0) > 0);
    } finally {
      await db.close();
    }
  });

  it('leaves no invented tutor once 026 has run', async () => {
    const db = await openDatabase(':memory:');
    try {
      await runMigrations(db);
      await seedCatalogue(db);
      const { tutors } = (await db.get<{ tutors: number }>(
        'SELECT COUNT(*)::int AS tutors FROM tutors',
      )) ?? { tutors: -1 };
      assert.equal(tutors, 0);
      const { assigned } = (await db.get<{ assigned: number }>(
        'SELECT COUNT(*)::int AS assigned FROM topics WHERE tutor_id IS NOT NULL',
      )) ?? { assigned: -1 };
      assert.equal(assigned, 0);
    } finally {
      await db.close();
    }
  });
});

describe('migration 026: placeholder tutors and batches', () => {
  it('removes them, but keeps a booked batch as inactive and leaves the roster alone', async () => {
    const db = await openDatabase(':memory:');
    try {
      // Production before 026: the placeholder tutors and batches, one of
      // them booked by a student
      await seededWithout(db, PLACEHOLDER_CLEAN_UP);
      await db.exec(`
        INSERT INTO tutors (id, name, headline, credentials, position)
          VALUES ('tutor_physics', 'Ananya Iyer', 'Physics tutor',
            ARRAY['M.Sc. Physics'], 0);
        UPDATE topics SET tutor_id = 'tutor_physics'
        WHERE id = '${RAY_OPTICS_TOPIC_ID}';
      `);
      await insertRayOpticsDecember(db);
      await db.query(
        `INSERT INTO batches (id, topic_id, name, schedule_label, start_date, start_time,
           session_count, session_duration_minutes, instructor_name, capacity, status, position)
         VALUES ('batch_gst_class_11_december', 'topic_accounts_gst_class_11', 'December batch',
           '8th & 9th December', '2026-12-08', '10:00', 2, NULL, NULL, 100, 'OPEN', 1)`,
      );
      await db.query(
        `INSERT INTO users (id, email, password_hash, created_at, updated_at)
         VALUES ('booked-buyer', 'booked@example.com', NULL, NOW(), NOW())`,
      );
      await db.query(
        `INSERT INTO enrolments (id, user_id, batch_id, status, created_at, updated_at)
         VALUES ('booked', 'booked-buyer', 'batch_gst_class_11_december', 'CONFIRMED', NOW(), NOW())`,
      );

      await runMigrations(db);

      assert.equal(
        (await db.get<{ n: number }>('SELECT COUNT(*)::int AS n FROM tutors'))
          ?.n,
        0,
      );
      assert.equal(
        (
          await db.get<{ n: number }>(
            'SELECT COUNT(*)::int AS n FROM topics WHERE tutor_id IS NOT NULL',
          )
        )?.n,
        0,
      );
      assert.equal(
        await db.get(
          "SELECT id FROM batches WHERE id = 'batch_physics_ray_optics_class_12_december'",
        ),
        null,
      );
      // The booked one stays, closed, with its enrolment
      assert.deepEqual(
        await db.get(
          "SELECT status FROM batches WHERE id = 'batch_gst_class_11_december'",
        ),
        { status: 'INACTIVE' },
      );
      assert.equal(
        (
          await db.get<{ n: number }>(
            "SELECT COUNT(*)::int AS n FROM batches WHERE id ~ '_b[0-9]+$'",
          )
        )?.n,
        43,
      );
    } finally {
      await db.close();
    }
  });
});

const PAYMENT_INTEGRITY_MIGRATION = '011_payment_integrity';

type Db = Awaited<ReturnType<typeof openDatabase>>;

const iso = (value: unknown) =>
  value === null ? null : new Date(value as string).toISOString();

// A buyer with a paid and an unpaid payment, written as the API did before
// migration 011 (no paid_at, no item snapshot, no tax status)
const insertLegacyPayments = async (db: Db) => {
  await db.query(
    `INSERT INTO users (id, email, password_hash, created_at, updated_at)
     VALUES ('legacy-buyer', 'legacy.buyer@example.com', NULL, $1, $1)`,
    ['2026-07-02T04:55:00Z'],
  );
  await db.query(
    `INSERT INTO enrolments (id, user_id, batch_id, status, created_at, updated_at)
     VALUES ('legacy-enrolment', 'legacy-buyer', 'batch_accountancy_rectification_of_errors_class_11_b2',
       'CONFIRMED', $1, $1)`,
    ['2026-07-02T05:00:00Z'],
  );
  const insert = `INSERT INTO payments (id, user_id, enrolment_id, amount_paise, currency,
      provider, provider_order_id, provider_payment_id, status, billing_name,
      billing_email, billing_mobile, billing_state, billing_city, created_at, updated_at)
    VALUES ($1, 'legacy-buyer', 'legacy-enrolment', 12900, 'INR', 'RAZORPAY', $2, $3,
      $4, 'Legacy Buyer', 'legacy.buyer@example.com', '9876543210', 'Rajasthan',
      'Jaipur', $5, $6)`;
  await db.query(insert, [
    'legacy-paid',
    'order_legacy_1',
    'pay_legacy_1',
    'PAID',
    '2026-07-02T05:00:00Z',
    '2026-07-02T05:03:00Z',
  ]);
  await db.query(insert, [
    'legacy-unpaid',
    'order_legacy_2',
    null,
    'CREATED',
    '2026-07-03T06:00:00Z',
    '2026-07-03T06:00:00Z',
  ]);
};

describe('migration 011: payment integrity', () => {
  it('keeps existing payments as they were, estimates paid_at and marks them for CA review', async () => {
    const db = await openDatabase(':memory:');
    try {
      await migrateBefore(db, PAYMENT_INTEGRITY_MIGRATION);
      await seedCatalogue(db);
      await insertLegacyPayments(db);

      await runMigrations(db);

      const rows = await db.all<Record<string, unknown>>(
        `SELECT id, status, amount_paise, created_at, paid_at, paid_at_estimated,
                tax_status, item_description, item_topic_id, item_batch_id,
                unit_price_paise, quantity
         FROM payments ORDER BY id`,
      );
      assert.deepEqual(
        rows.map(row => ({
          ...row,
          created_at: iso(row.created_at),
          paid_at: iso(row.paid_at),
        })),
        [
          {
            id: 'legacy-paid',
            status: 'PAID',
            amount_paise: 12900,
            created_at: '2026-07-02T05:00:00.000Z',
            // The only time on record: the row's last update
            paid_at: '2026-07-02T05:03:00.000Z',
            paid_at_estimated: true,
            tax_status: 'LEGACY_UNREVIEWED',
            // Never filled in from today's catalogue
            item_description: null,
            item_topic_id: null,
            item_batch_id: null,
            unit_price_paise: null,
            quantity: 1,
          },
          {
            id: 'legacy-unpaid',
            status: 'CREATED',
            amount_paise: 12900,
            created_at: '2026-07-03T06:00:00.000Z',
            paid_at: null,
            paid_at_estimated: false,
            tax_status: 'LEGACY_UNREVIEWED',
            item_description: null,
            item_topic_id: null,
            item_batch_id: null,
            unit_price_paise: null,
            quantity: 1,
          },
        ],
      );
    } finally {
      await db.close();
    }
  });

  it('refuses to delete a customer who has payments, and still removes one who has none', async () => {
    const db = await openDatabase(':memory:');
    try {
      await migrateBefore(db, PAYMENT_INTEGRITY_MIGRATION);
      await seedCatalogue(db);
      await insertLegacyPayments(db);
      await runMigrations(db);

      // Refused by a foreign key protecting the payments. PGlite reports the
      // RESTRICT itself (23001); PostgreSQL 16 can report the generic
      // foreign-key code (23503) when the cascade to enrolments meets the
      // payment first. Either way nothing is deleted (checked below).
      await assert.rejects(
        () => db.query("DELETE FROM users WHERE id = 'legacy-buyer'"),
        (error: { code?: string; message?: string }) =>
          (error.code === '23001' || error.code === '23503') &&
          /payments/.test(String(error.message)),
      );
      const { count } = (await db.get<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM payments WHERE user_id = 'legacy-buyer'",
      )) ?? { count: -1 };
      assert.equal(count, 2);

      await db.query(
        `INSERT INTO users (id, email, password_hash, created_at, updated_at)
         VALUES ('no-payments', 'no.payments@example.com', NULL, NOW(), NOW())`,
      );
      await db.query("DELETE FROM users WHERE id = 'no-payments'");
      assert.ok(
        !(await db.get("SELECT 1 FROM users WHERE id = 'no-payments'")),
        'a customer without payments can still be removed',
      );
    } finally {
      await db.close();
    }
  });

  it('accepts only known tax statuses and positive quantities and unit prices', async () => {
    const db = await openDatabase(':memory:');
    try {
      await migrateBefore(db, PAYMENT_INTEGRITY_MIGRATION);
      await seedCatalogue(db);
      await insertLegacyPayments(db);
      await runMigrations(db);

      for (const change of [
        "tax_status = 'GUESSED'",
        'quantity = 0',
        'unit_price_paise = 0',
      ]) {
        await assert.rejects(
          () =>
            db.query(`UPDATE payments SET ${change} WHERE id = 'legacy-paid'`),
          (error: { code?: string }) => error.code === '23514',
          change,
        );
      }
    } finally {
      await db.close();
    }
  });
});

describe('migration 022: payment refunds provider id uniqueness', () => {
  it('enforces uniqueness on non-null provider_refund_id while allowing multiple nulls', async () => {
    const db = await openDatabase(':memory:');
    try {
      await runMigrations(db);
      await seedCatalogue(db);

      // Create a customer, pre-registration and payment
      await db.query(`
        INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
        VALUES ('user-m22', 'm22@example.com', NULL, 'STUDENT', NOW(), NOW())
      `);
      await db.query(`
        INSERT INTO pre_registrations (id, user_id, topic_id, status, created_at, updated_at)
        VALUES ('prereg-m22', 'user-m22', 'topic_accounts_gst_class_11', 'CONFIRMED', NOW(), NOW())
      `);
      await db.query(`
        INSERT INTO payments (
          id, user_id, amount_paise, currency, status, provider,
          provider_order_id, provider_payment_id, billing_name, billing_email,
          billing_mobile, billing_state, billing_city, customer_type, address_line1, pin_code,
          billing_state_code, item_description, item_topic_id, unit_price_paise,
          pre_registration_id, created_at, updated_at, paid_at
        ) VALUES (
          'pay-m22', 'user-m22', 100000, 'INR', 'PAID', 'RAZORPAY',
          'order_m22', 'pay_rzp_m22', 'Buyer M22', 'm22@example.com',
          '+91 98765 43210', 'Rajasthan', 'Jaipur', 'INDIVIDUAL', '12 Civil Lines', '302006',
          '08', 'Topic GST', 'topic_accounts_gst_class_11', 100000,
          'prereg-m22', NOW(), NOW(), NOW()
        )
      `);

      // 1. Two refunds with NULL provider_refund_id can coexist
      await db.query(`
        INSERT INTO payment_refunds (id, payment_id, amount_paise, currency, status, provider, source, created_at, updated_at)
        VALUES ('rfnd-null-1', 'pay-m22', 10000, 'INR', 'PENDING', 'RAZORPAY', 'FINANCE_ADMIN', NOW(), NOW()),
               ('rfnd-null-2', 'pay-m22', 10000, 'INR', 'PENDING', 'RAZORPAY', 'FINANCE_ADMIN', NOW(), NOW())
      `);

      // 2. Insert refund with a real provider_refund_id
      await db.query(`
        INSERT INTO payment_refunds (id, payment_id, amount_paise, currency, status, provider, provider_refund_id, source, created_at, updated_at)
        VALUES ('rfnd-uniq-1', 'pay-m22', 10000, 'INR', 'PROCESSED', 'RAZORPAY', 'rfnd_rzp_unique_123', 'FINANCE_ADMIN', NOW(), NOW())
      `);

      // 3. Inserting a second refund with the same provider_refund_id must be rejected by unique index (23505)
      await assert.rejects(
        () =>
          db.query(`
            INSERT INTO payment_refunds (id, payment_id, amount_paise, currency, status, provider, provider_refund_id, source, created_at, updated_at)
            VALUES ('rfnd-uniq-2', 'pay-m22', 10000, 'INR', 'PROCESSED', 'RAZORPAY', 'rfnd_rzp_unique_123', 'FINANCE_ADMIN', NOW(), NOW())
          `),
        (err: { code?: string }) => err.code === '23505',
      );
    } finally {
      await db.close();
    }
  });
});

describe('migration 023: provider refund ids are never blank or padded', () => {
  const PAYMENT = `
    INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
    VALUES ('user-m23', 'm23@example.com', NULL, 'STUDENT', NOW(), NOW());
    INSERT INTO pre_registrations (id, user_id, topic_id, status, created_at, updated_at)
    VALUES ('prereg-m23', 'user-m23', 'topic_accounts_gst_class_11', 'CONFIRMED', NOW(), NOW());
    INSERT INTO payments (
      id, user_id, amount_paise, currency, status, provider,
      provider_order_id, provider_payment_id, billing_name, billing_email,
      billing_mobile, billing_state, billing_city, customer_type, address_line1, pin_code,
      billing_state_code, item_description, item_topic_id, unit_price_paise,
      pre_registration_id, created_at, updated_at, paid_at
    ) VALUES (
      'pay-m23', 'user-m23', 100000, 'INR', 'PAID', 'RAZORPAY',
      'order_m23', 'pay_rzp_m23', 'Buyer M23', 'm23@example.com',
      '+91 98765 43210', 'Rajasthan', 'Jaipur', 'INDIVIDUAL', '12 Civil Lines', '302006',
      '08', 'Topic GST', 'topic_accounts_gst_class_11', 100000,
      'prereg-m23', NOW(), NOW(), NOW()
    );`;
  const refund = (id: string, providerRefundId: string | null) =>
    `INSERT INTO payment_refunds (id, payment_id, amount_paise, currency, status, provider, provider_refund_id, source, created_at, updated_at)
     VALUES ('${id}', 'pay-m23', 1000, 'INR', 'PENDING', 'RAZORPAY', ${
       providerRefundId === null ? 'NULL' : `'${providerRefundId}'`
     }, 'FINANCE_ADMIN', NOW(), NOW())`;

  it('refuses a blank or padded provider refund id and accepts a clean one or none', async () => {
    const db = await openDatabase(':memory:');
    try {
      await runMigrations(db);
      await seedCatalogue(db);
      await db.exec(PAYMENT);

      await db.query(refund('r-none', null));
      await db.query(refund('r-clean', 'rfnd_clean_1'));
      for (const [id, value] of [
        ['r-empty', ''],
        ['r-spaces', '   '],
        ['r-padded', ' rfnd_padded '],
      ]) {
        await assert.rejects(
          () => db.query(refund(id, value)),
          (error: { code?: string; constraint?: string }) =>
            error.code === '23514',
          `provider refund id ${JSON.stringify(value)}`,
        );
      }
      // btrim() only strips spaces; tabs and newlines are refused too
      for (const value of ['rfnd_x\n', '\trfnd_x']) {
        await assert.rejects(
          () =>
            db.query(
              `INSERT INTO payment_refunds (id, payment_id, amount_paise, currency, status, provider, provider_refund_id, source, created_at, updated_at)
               VALUES ($1, 'pay-m23', 1000, 'INR', 'PENDING', 'RAZORPAY', $2, 'FINANCE_ADMIN', NOW(), NOW())`,
              [`r-ws-${randomUUID()}`, value],
            ),
          (error: { code?: string }) => error.code === '23514',
          `provider refund id ${JSON.stringify(value)}`,
        );
      }
    } finally {
      await db.close();
    }
  });

  it('upgrades a populated database that already holds a blank id: old row kept, new ones guarded', async () => {
    const db = await openDatabase(':memory:');
    try {
      const before = MIGRATIONS.filter(
        migration => migration.id < '023_payment_refunds_provider_id_clean',
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
      await seedCatalogue(db);
      await db.exec(PAYMENT);
      // What the R3.1 audit reproduced: a blank id stored by a webhook
      await db.query(refund('r-legacy-blank', '   '));

      await runMigrations(db);

      const kept = await db.get<{ provider_refund_id: string }>(
        `SELECT provider_refund_id FROM payment_refunds WHERE id = 'r-legacy-blank'`,
      );
      assert.equal(kept?.provider_refund_id, '   ');
      const constraint = await db.get<{ convalidated: boolean }>(
        `SELECT convalidated FROM pg_constraint
         WHERE conname = 'payment_refunds_provider_refund_id_clean'`,
      );
      assert.equal(constraint?.convalidated, false);
      await assert.rejects(
        () => db.query(refund('r-new-blank', '')),
        (error: { code?: string }) => error.code === '23514',
      );
    } finally {
      await db.close();
    }
  });

  it('validates the constraint when no existing row breaks it', async () => {
    const db = await openDatabase(':memory:');
    try {
      await runMigrations(db);
      const constraint = await db.get<{ convalidated: boolean }>(
        `SELECT convalidated FROM pg_constraint
         WHERE conname = 'payment_refunds_provider_refund_id_clean'`,
      );
      assert.equal(constraint?.convalidated, true);
    } finally {
      await db.close();
    }
  });
});
