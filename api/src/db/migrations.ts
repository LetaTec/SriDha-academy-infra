export type Migration = {
  id: string;
  sql: string;
};

// Append new migrations to the end of this list. Never edit a migration that
// has already been applied to a shared database — add a new one instead.
export const MIGRATIONS: readonly Migration[] = [
  {
    id: '001_initial_schema',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));

      CREATE TABLE student_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        date_of_birth TEXT NOT NULL,
        mobile TEXT NOT NULL,
        standard TEXT NOT NULL,
        stream TEXT,
        address TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX sessions_user_id_idx ON sessions (user_id);

      CREATE TABLE password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ
      );

      CREATE INDEX password_reset_tokens_user_id_idx
        ON password_reset_tokens (user_id);

      CREATE TABLE subjects (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'UPCOMING')),
        list_price_paise INTEGER CHECK (list_price_paise >= 0),
        list_price_tax_label TEXT,
        position INTEGER NOT NULL
      );

      CREATE TABLE chapters (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        position INTEGER NOT NULL
      );

      CREATE TABLE topics (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        level TEXT,
        price_paise INTEGER CHECK (price_paise >= 0),
        price_tax_label TEXT,
        position INTEGER NOT NULL
      );

      CREATE TABLE lessons (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        duration_minutes INTEGER CHECK (duration_minutes > 0),
        position INTEGER NOT NULL
      );

      CREATE TABLE batches (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        schedule_label TEXT NOT NULL,
        start_date TEXT,
        start_time TEXT,
        session_count INTEGER CHECK (session_count > 0),
        session_duration_minutes INTEGER CHECK (session_duration_minutes > 0),
        instructor_name TEXT,
        capacity INTEGER CHECK (capacity > 0),
        status TEXT NOT NULL CHECK (status IN ('OPEN', 'UPCOMING', 'INACTIVE')),
        position INTEGER NOT NULL
      );

      CREATE TABLE enrolments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        batch_id TEXT NOT NULL REFERENCES batches (id) ON DELETE RESTRICT,
        status TEXT NOT NULL
          CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED')),
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        UNIQUE (user_id, batch_id)
      );

      CREATE INDEX enrolments_batch_id_idx ON enrolments (batch_id);

      CREATE TABLE enquiries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('COUNSELLING', 'GUESS_PAPER_WAITLIST')),
        full_name TEXT,
        email TEXT NOT NULL,
        mobile TEXT,
        subject TEXT,
        user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `,
  },
  {
    // Counselling is no longer offered and the guess paper is now the AI
    // model paper: keep only waitlist sign-ups, under the new type name.
    id: '002_model_paper_waitlist',
    sql: `
      CREATE TABLE enquiries_next (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('MODEL_PAPER_WAITLIST')),
        email TEXT NOT NULL,
        exam TEXT NOT NULL,
        user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      INSERT INTO enquiries_next (id, type, email, exam, user_id, created_at)
        SELECT id, 'MODEL_PAPER_WAITLIST', email, subject, user_id, created_at
        FROM enquiries
        WHERE type = 'GUESS_PAPER_WAITLIST';

      DROP TABLE enquiries;
      ALTER TABLE enquiries_next RENAME TO enquiries;
    `,
  },
  {
    // Students can choose "Other" as their stream and describe it.
    id: '003_student_stream_other',
    sql: `
      ALTER TABLE student_profiles ADD COLUMN stream_other TEXT;
    `,
  },
  {
    // Accounts carry a role. Super admins are named in SUPER_ADMIN_EMAILS,
    // may have no password (they sign in with an emailed one-time link) and
    // need no student profile.
    id: '004_user_roles_and_sign_in_links',
    sql: `
      ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'STUDENT'
        CHECK (role IN ('STUDENT', 'SUPER_ADMIN'));
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

      CREATE TABLE sign_in_links (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ
      );

      CREATE INDEX sign_in_links_user_id_idx ON sign_in_links (user_id);
    `,
  },
  {
    // Students pre-register for topics without batches, and pay for an
    // enrolment or a pre-registration through a payment provider. Card and
    // UPI details never reach the API; only the provider's order and payment
    // identifiers are stored.
    id: '005_pre_registrations_and_payments',
    sql: `
      CREATE TABLE pre_registrations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        topic_id TEXT NOT NULL REFERENCES topics (id) ON DELETE RESTRICT,
        status TEXT NOT NULL
          CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED')),
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        UNIQUE (user_id, topic_id)
      );

      CREATE TABLE payments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        enrolment_id TEXT REFERENCES enrolments (id) ON DELETE RESTRICT,
        pre_registration_id TEXT REFERENCES pre_registrations (id) ON DELETE RESTRICT,
        amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
        currency TEXT NOT NULL,
        provider TEXT NOT NULL CHECK (provider IN ('RAZORPAY', 'TEST')),
        provider_order_id TEXT NOT NULL UNIQUE,
        provider_payment_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('CREATED', 'PAID')),
        billing_name TEXT NOT NULL,
        billing_email TEXT NOT NULL,
        billing_mobile TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        CHECK ((enrolment_id IS NULL) <> (pre_registration_id IS NULL))
      );

      CREATE INDEX payments_user_id_idx ON payments (user_id);
    `,
  },
  {
    // The hourly clean-up deletes expired sessions and links by expiry,
    // and order lists join payments to the seat they paid for.
    id: '006_cleanup_and_payment_indexes',
    sql: `
      CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
      CREATE INDEX password_reset_tokens_expires_at_idx
        ON password_reset_tokens (expires_at);
      CREATE INDEX sign_in_links_expires_at_idx ON sign_in_links (expires_at);
      CREATE INDEX payments_enrolment_id_idx ON payments (enrolment_id);
      CREATE INDEX payments_pre_registration_id_idx
        ON payments (pre_registration_id);
    `,
  },
  {
    // What a topic card shows, so the website reads every topic from the
    // catalogue instead of keeping its own copy: the short card name, an
    // optional icon and the order of featured topics. The seed fills them.
    // Existing rows are filled here too, so a database that is migrated
    // but not re-seeded still shows proper cards: the eight featured topics
    // by id, the rest from their "Learn <name> for Class N" titles.
    id: '007_topic_card_fields',
    sql: `
      ALTER TABLE topics ADD COLUMN short_title TEXT;
      ALTER TABLE topics ADD COLUMN icon TEXT;
      ALTER TABLE topics
        ADD COLUMN featured_rank INTEGER CHECK (featured_rank > 0);

      UPDATE topics
      SET short_title = regexp_replace(title, '^Learn (.+) for Class [0-9]+$', '\\1')
      WHERE title ~ '^Learn (.+) for Class [0-9]+$';

      UPDATE topics SET short_title = featured.short_title,
        icon = featured.icon, featured_rank = featured.featured_rank
      FROM (VALUES
        ('topic_accounts_gst_class_11', 'GST', 'topicGst', 1),
        ('topic_chemistry_bonding_class_11', 'Chemical bonding', 'topicBonding', 2),
        ('topic_physics_ray_optics_class_12', 'Ray optics', 'topicOptics', 3),
        ('topic_maths_integrals_class_12', 'Integrals', 'topicIntegrals', 4),
        ('topic_chemistry_mole_concept_class_11', 'Mole concept', 'topicMole', 5),
        ('topic_physics_current_electricity_class_12', 'Current electricity', 'topicCurrent', 6),
        ('topic_physics_laws_of_motion_class_11', 'Laws of motion', 'topicMotion', 7),
        ('topic_accounts_partnership_class_12', 'Partnership accounts', 'topicPartnership', 8)
      ) AS featured (id, short_title, icon, featured_rank)
      WHERE topics.id = featured.id;
    `,
  },
  {
    // Ray optics gets a January and a February batch beside December.
    // Production is seeded by hand, so the batches are added here, once and
    // only where the topic exists; the seed writes the same rows.
    id: '008_ray_optics_more_batches',
    sql: `
      INSERT INTO batches (id, topic_id, name, schedule_label, start_date,
        start_time, session_count, session_duration_minutes, instructor_name,
        capacity, status, position)
      SELECT more.id, more.topic_id, more.name, more.schedule_label,
        more.start_date, '10:00', 2, NULL, NULL, 100, 'OPEN', more.position
      FROM (VALUES
        ('batch_physics_ray_optics_class_12_january',
          'topic_physics_ray_optics_class_12', 'January batch',
          '5th & 6th January', '2027-01-05', 1),
        ('batch_physics_ray_optics_class_12_february',
          'topic_physics_ray_optics_class_12', 'February batch',
          '2nd & 3rd February', '2027-02-02', 2)
      ) AS more (id, topic_id, name, schedule_label, start_date, position)
      WHERE EXISTS (SELECT 1 FROM topics WHERE topics.id = more.topic_id)
      ON CONFLICT (id) DO NOTHING;
    `,
  },
  {
    // Checkout asks for the student's state and city, for the tax invoice.
    // Orders placed before have neither, so both stay optional here.
    id: '009_payment_billing_state_city',
    sql: `
      ALTER TABLE payments ADD COLUMN billing_state TEXT;
      ALTER TABLE payments ADD COLUMN billing_city TEXT;
    `,
  },
  {
    // Each topic shows who teaches it. The tutors here are placeholders,
    // one per subject; a later migration swaps in the real ones. Production
    // is seeded by hand, so the tutors are added here and every existing
    // topic takes its subject's tutor (subject_<key> → tutor_<key>).
    id: '010_tutors',
    sql: `
      CREATE TABLE tutors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        headline TEXT NOT NULL,
        credentials TEXT[] NOT NULL DEFAULT '{}',
        photo_url TEXT,
        position INTEGER NOT NULL
      );

      ALTER TABLE topics
        ADD COLUMN tutor_id TEXT REFERENCES tutors (id) ON DELETE SET NULL;

      INSERT INTO tutors (id, name, headline, credentials, position) VALUES
        ('tutor_accounts', 'Neha Agarwal', 'Accounts tutor',
          ARRAY['M.Com, Accountancy', '9 years teaching Class 11 and 12 accounts', 'Specialises in GST and partnership accounts'], 0),
        ('tutor_chemistry', 'Rohan Mehta', 'Chemistry tutor',
          ARRAY['M.Sc. Chemistry', '8 years teaching Class 11 and 12 chemistry', 'Specialises in physical and organic chemistry'], 1),
        ('tutor_physics', 'Ananya Iyer', 'Physics tutor',
          ARRAY['M.Sc. Physics', '10 years teaching Class 11 and 12 physics', 'Specialises in optics and electricity'], 2),
        ('tutor_economics', 'Kabir Sethi', 'Economics tutor',
          ARRAY['M.A. Economics', '7 years teaching Class 11 and 12 economics', 'Specialises in micro and macroeconomics'], 3),
        ('tutor_mathematics', 'Priya Nair', 'Mathematics tutor',
          ARRAY['M.Sc. Mathematics', '9 years teaching Class 11 and 12 mathematics', 'Specialises in calculus and algebra'], 4),
        ('tutor_neet', 'Dr. Arjun Rao', 'NEET tutor',
          ARRAY['MBBS', '6 years preparing students for NEET', 'Specialises in biology and chemistry for NEET'], 5),
        ('tutor_jee', 'Vikram Joshi', 'JEE tutor',
          ARRAY['B.Tech, M.Tech', '8 years preparing students for JEE Main and Advanced', 'Specialises in physics and mathematics problem solving'], 6),
        ('tutor_business_studies', 'Meera Kapoor', 'Business Studies tutor',
          ARRAY['MBA', '7 years teaching Class 11 and 12 business studies', 'Specialises in management and marketing'], 7),
        ('tutor_biology', 'Sana Qureshi', 'Biology tutor',
          ARRAY['M.Sc. Zoology', '8 years teaching Class 11 and 12 biology', 'Specialises in human physiology and genetics'], 8),
        ('tutor_ca_cs', 'Aditya Malhotra', 'CA / CS tutor',
          ARRAY['Chartered Accountant', '6 years teaching CA and CS foundation', 'Specialises in accounting standards and law'], 9)
      ON CONFLICT (id) DO NOTHING;

      UPDATE topics SET tutor_id = tutors.id
      FROM chapters, tutors
      WHERE chapters.id = topics.chapter_id
        AND tutors.id = 'tutor_' || substring(chapters.subject_id FROM 9)
        AND topics.tutor_id IS NULL;
    `,
  },
];
