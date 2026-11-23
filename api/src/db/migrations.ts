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
  {
    // Financial records must outlive the customer row: deleting a user who
    // has payments is now refused instead of erasing their payment history.
    // paid_at records when a payment was captured; payments that were
    // already paid get their last update time, marked as an estimate,
    // because no better time was ever stored. What was sold is snapshotted
    // on the payment from now on; older payments keep NULL (never filled in
    // from today's catalogue). tax_status starts every existing payment as
    // LEGACY_UNREVIEWED: no automatic process acts on those until the CA has
    // decided how they are treated. TEST-provider payments are left out of
    // the reporting indexes, as they are of every business figure.
    // To undo:
    //   ALTER TABLE payments DROP CONSTRAINT payments_user_id_fkey,
    //     ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id)
    //     REFERENCES users (id) ON DELETE CASCADE;
    //   DROP INDEX payments_paid_at_real_idx, payments_created_at_real_idx;
    //   ALTER TABLE payments DROP COLUMN paid_at, DROP COLUMN paid_at_estimated,
    //     DROP COLUMN item_description, DROP COLUMN item_topic_id,
    //     DROP COLUMN item_batch_id, DROP COLUMN unit_price_paise,
    //     DROP COLUMN quantity, DROP COLUMN tax_status;
    id: '011_payment_integrity',
    sql: `
      ALTER TABLE payments DROP CONSTRAINT payments_user_id_fkey;
      ALTER TABLE payments
        ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT;

      ALTER TABLE payments ADD COLUMN paid_at TIMESTAMPTZ;
      ALTER TABLE payments
        ADD COLUMN paid_at_estimated BOOLEAN NOT NULL DEFAULT false;
      UPDATE payments SET paid_at = updated_at, paid_at_estimated = true
      WHERE status = 'PAID';

      ALTER TABLE payments ADD COLUMN item_description TEXT;
      ALTER TABLE payments ADD COLUMN item_topic_id TEXT;
      ALTER TABLE payments ADD COLUMN item_batch_id TEXT;
      ALTER TABLE payments
        ADD COLUMN unit_price_paise INTEGER CHECK (unit_price_paise > 0);
      ALTER TABLE payments
        ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0);

      ALTER TABLE payments
        ADD COLUMN tax_status TEXT NOT NULL DEFAULT 'PENDING_CONFIGURATION'
        CHECK (tax_status IN
          ('LEGACY_UNREVIEWED', 'PENDING_CONFIGURATION', 'QUOTED', 'NOT_APPLICABLE'));
      UPDATE payments SET tax_status = 'LEGACY_UNREVIEWED';

      CREATE INDEX payments_paid_at_real_idx ON payments (paid_at)
        WHERE provider <> 'TEST' AND status = 'PAID';
      CREATE INDEX payments_created_at_real_idx ON payments (created_at)
        WHERE provider <> 'TEST';
    `,
  },
  {
    // The payment lifecycle: a provider signature makes a payment
    // AUTHORIZED, only a capture reported by Razorpay makes it PAID, and
    // failures and expiry are recorded instead of leaving payments CREATED
    // forever. Existing values keep their meaning (PAID is captured).
    // payment_events keeps every webhook, signature check and provider
    // lookup, once each (Razorpay delivers at least once and out of order),
    // with only the fields this system needs: no card, UPI, bank, email or
    // phone details.
    // To undo:
    //   DROP TABLE payment_events;
    //   ALTER TABLE payments DROP COLUMN authorized_at, DROP COLUMN failed_at,
    //     DROP COLUMN expired_at, DROP COLUMN failure_code,
    //     DROP COLUMN failure_reason;
    //   (then, only once no row uses a new status)
    //   ALTER TABLE payments DROP CONSTRAINT payments_status_check,
    //     ADD CONSTRAINT payments_status_check CHECK (status IN ('CREATED', 'PAID'));
    id: '012_payment_lifecycle',
    sql: `
      ALTER TABLE payments DROP CONSTRAINT payments_status_check;
      ALTER TABLE payments ADD CONSTRAINT payments_status_check
        CHECK (status IN ('CREATED', 'AUTHORIZED', 'PAID', 'FAILED', 'EXPIRED'));

      ALTER TABLE payments ADD COLUMN authorized_at TIMESTAMPTZ;
      ALTER TABLE payments ADD COLUMN failed_at TIMESTAMPTZ;
      ALTER TABLE payments ADD COLUMN expired_at TIMESTAMPTZ;
      ALTER TABLE payments ADD COLUMN failure_code TEXT;
      ALTER TABLE payments ADD COLUMN failure_reason TEXT;

      CREATE TABLE payment_events (
        -- Increasing, so events received in the same instant keep their order
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('RAZORPAY', 'TEST')),
        source TEXT NOT NULL
          CHECK (source IN ('WEBHOOK', 'CHECKOUT_SIGNATURE', 'API_FETCH')),
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        provider_payment_id TEXT,
        provider_order_id TEXT,
        amount_paise INTEGER,
        currency TEXT,
        payload JSONB NOT NULL,
        payment_id TEXT REFERENCES payments (id) ON DELETE RESTRICT,
        outcome TEXT NOT NULL CHECK (outcome IN (
          'APPLIED', 'IGNORED_STALE', 'REJECTED_MISMATCH', 'UNKNOWN_ORDER',
          'RECORDED', 'CAPTURED_FOR_CONFIRMED_SEAT')),
        received_at TIMESTAMPTZ NOT NULL,
        UNIQUE (provider, event_id)
      );

      CREATE INDEX payment_events_payment_id_idx ON payment_events (payment_id);
      CREATE INDEX payment_events_provider_payment_id_idx
        ON payment_events (provider_payment_id);
    `,
  },
  {
    // Staff roles beyond the super admin: FINANCE_ADMIN (payments, refunds,
    // invoices, reports) and OPERATIONS_ADMIN (operational views without
    // financial records). The finance audit log records who did what to
    // financial records and roles. It is append-only: a trigger refuses
    // every UPDATE and DELETE, whoever runs them.
    // To undo:
    //   DROP TABLE finance_audit_log; DROP FUNCTION finance_audit_log_append_only();
    //   (then, only once no user holds a new role)
    //   ALTER TABLE users DROP CONSTRAINT users_role_check,
    //     ADD CONSTRAINT users_role_check CHECK (role IN ('STUDENT', 'SUPER_ADMIN'));
    id: '013_staff_roles_and_audit',
    sql: `
      ALTER TABLE users DROP CONSTRAINT users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN
        ('STUDENT', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_ADMIN'));

      CREATE TABLE finance_audit_log (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        occurred_at TIMESTAMPTZ NOT NULL,
        -- Null for actions the system takes itself (configuration, webhooks)
        actor_user_id TEXT REFERENCES users (id) ON DELETE RESTRICT,
        actor_role TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details JSONB NOT NULL DEFAULT '{}',
        request_id TEXT
      );

      CREATE INDEX finance_audit_log_occurred_at_idx
        ON finance_audit_log (occurred_at DESC);
      CREATE INDEX finance_audit_log_entity_idx
        ON finance_audit_log (entity_type, entity_id);

      CREATE FUNCTION finance_audit_log_append_only() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'finance_audit_log is append-only'
          USING ERRCODE = '42501';
      END
      $$;

      CREATE TRIGGER finance_audit_log_no_change
        BEFORE UPDATE OR DELETE ON finance_audit_log
        FOR EACH ROW EXECUTE FUNCTION finance_audit_log_append_only();
    `,
  },
  {
    // Refunds and disputes. A refund is requested by finance staff (or made
    // in the Razorpay dashboard and reported by webhook); several partial
    // refunds may follow one another, but pending and processed refunds
    // together never exceed the captured amount: the API checks with the
    // payment row locked, and this trigger refuses anything that slips past.
    // receipt is the refund's own id sent to Razorpay, which treats it as an
    // idempotency key. Disputes are recorded from Razorpay's dispute events.
    // To undo:
    //   DROP TABLE payment_disputes, payment_refunds;
    //   DROP FUNCTION payment_refunds_within_captured();
    //   ALTER TABLE payment_events DROP CONSTRAINT payment_events_outcome_check,
    //     ADD CONSTRAINT payment_events_outcome_check CHECK (outcome IN (...previous list...));
    id: '014_refunds_and_disputes',
    sql: `
      ALTER TABLE payment_events DROP CONSTRAINT payment_events_outcome_check;
      ALTER TABLE payment_events ADD CONSTRAINT payment_events_outcome_check
        CHECK (outcome IN ('APPLIED', 'IGNORED_STALE', 'REJECTED_MISMATCH',
          'UNKNOWN_ORDER', 'UNKNOWN_PAYMENT', 'RECORDED',
          'CAPTURED_FOR_CONFIRMED_SEAT'));

      CREATE TABLE payment_refunds (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments (id) ON DELETE RESTRICT,
        provider TEXT NOT NULL CHECK (provider IN ('RAZORPAY', 'TEST')),
        provider_refund_id TEXT UNIQUE,
        receipt TEXT UNIQUE,
        request_key TEXT UNIQUE,
        amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
        currency TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
        reason TEXT,
        failure_reason TEXT,
        source TEXT NOT NULL
          CHECK (source IN ('FINANCE_ADMIN', 'PROVIDER_DASHBOARD')),
        requested_by TEXT REFERENCES users (id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ
      );

      CREATE INDEX payment_refunds_payment_id_idx ON payment_refunds (payment_id);
      CREATE INDEX payment_refunds_processed_at_idx ON payment_refunds (processed_at)
        WHERE status = 'PROCESSED';

      CREATE FUNCTION payment_refunds_within_captured() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        captured INTEGER;
        already INTEGER;
      BEGIN
        IF NEW.status = 'FAILED' THEN
          RETURN NEW;
        END IF;
        SELECT amount_paise INTO captured FROM payments
          WHERE id = NEW.payment_id FOR UPDATE;
        SELECT COALESCE(SUM(amount_paise), 0) INTO already FROM payment_refunds
          WHERE payment_id = NEW.payment_id AND status <> 'FAILED'
            AND id <> NEW.id;
        IF already + NEW.amount_paise > captured THEN
          RAISE EXCEPTION 'refunds would exceed the captured amount of payment %',
            NEW.payment_id USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
      $$;

      CREATE TRIGGER payment_refunds_within_captured
        BEFORE INSERT OR UPDATE ON payment_refunds
        FOR EACH ROW EXECUTE FUNCTION payment_refunds_within_captured();

      CREATE TABLE payment_disputes (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments (id) ON DELETE RESTRICT,
        provider TEXT NOT NULL CHECK (provider IN ('RAZORPAY', 'TEST')),
        provider_dispute_id TEXT NOT NULL UNIQUE,
        phase TEXT,
        status TEXT NOT NULL
          CHECK (status IN ('open', 'under_review', 'won', 'lost', 'closed')),
        reason_code TEXT,
        amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
        amount_deducted_paise INTEGER NOT NULL DEFAULT 0
          CHECK (amount_deducted_paise >= 0),
        currency TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX payment_disputes_payment_id_idx ON payment_disputes (payment_id);
    `,
  },
  {
    // Billing details for tax invoices, kept on each payment exactly as
    // given at checkout (a later change elsewhere never rewrites them).
    // Individuals give a billing address and PIN; businesses also give
    // their legal name and GSTIN (checked here for format, state code and
    // check character: gstin_check says FORMAT_VALID, never "verified",
    // unless an authorised verification service confirms it). The state is
    // also kept as its GST state code, which tax rules compare. Payments
    // made before this have no customer_type: their details were never
    // collected and are not invented.
    // To undo:
    //   ALTER TABLE payments DROP CONSTRAINT payments_billing_complete,
    //     DROP COLUMN customer_type, DROP COLUMN address_line1,
    //     DROP COLUMN address_line2, DROP COLUMN pin_code,
    //     DROP COLUMN billing_state_code, DROP COLUMN business_legal_name,
    //     DROP COLUMN gstin, DROP COLUMN gstin_state_code,
    //     DROP COLUMN gstin_check, DROP COLUMN purchase_order_reference;
    id: '015_customer_billing',
    sql: `
      ALTER TABLE payments
        ADD COLUMN customer_type TEXT
          CHECK (customer_type IN ('INDIVIDUAL', 'BUSINESS'));
      ALTER TABLE payments ADD COLUMN address_line1 TEXT;
      ALTER TABLE payments ADD COLUMN address_line2 TEXT;
      ALTER TABLE payments
        ADD COLUMN pin_code TEXT CHECK (pin_code ~ '^[1-9][0-9]{5}$');
      ALTER TABLE payments
        ADD COLUMN billing_state_code TEXT
          CHECK (billing_state_code ~ '^[0-9]{2}$');
      ALTER TABLE payments ADD COLUMN business_legal_name TEXT;
      ALTER TABLE payments
        ADD COLUMN gstin TEXT CHECK (gstin ~ '^[0-9]{2}[0-9A-Z]{13}$');
      ALTER TABLE payments
        ADD COLUMN gstin_state_code TEXT
          CHECK (gstin_state_code ~ '^[0-9]{2}$');
      ALTER TABLE payments
        ADD COLUMN gstin_check TEXT
          CHECK (gstin_check IN ('FORMAT_VALID', 'PROVIDER_VERIFIED'));
      ALTER TABLE payments ADD COLUMN purchase_order_reference TEXT;

      ALTER TABLE payments ADD CONSTRAINT payments_billing_complete CHECK (
        customer_type IS NULL
        OR (
          address_line1 IS NOT NULL AND pin_code IS NOT NULL
          AND billing_state_code IS NOT NULL
          AND (
            (customer_type = 'INDIVIDUAL'
              AND gstin IS NULL AND business_legal_name IS NULL
              AND purchase_order_reference IS NULL)
            OR (customer_type = 'BUSINESS'
              AND gstin IS NOT NULL AND business_legal_name IS NOT NULL
              AND gstin_state_code IS NOT NULL AND gstin_check IS NOT NULL)
          )
        )
      );

      CREATE INDEX payments_customer_gstin_idx ON payments (gstin)
        WHERE gstin IS NOT NULL;
    `,
  },
  {
    // The email outbox: transactional queueing for emails so network
    // failures, crashed processes or email provider outages never lose
    // payment confirmations. Idempotency keys prevent duplicate deliveries
    // when webhooks repeat.
    // To undo:
    //   DROP TABLE email_outbox;
    id: '016_email_outbox',
    sql: `
      CREATE TABLE email_outbox (
        id TEXT PRIMARY KEY,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        template TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL
          CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        last_attempt_at TIMESTAMPTZ,
        next_attempt_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        last_error TEXT,
        idempotency_key TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX email_outbox_retry_idx
        ON email_outbox (next_attempt_at, created_at)
        WHERE status IN ('PENDING', 'PROCESSING');
    `,
  },
  {
    // Tax quotes, immutable snapshots, and sequential invoices (Milestone 6).
    // Separates quotes (temporary pre-payment calculations), immutable
    // snapshots (permanent calculation records), and official invoices
    // (with FY-aware atomic sequences). Enforces BigInt paise and
    // database-level immutability triggers on financial records.
    // To undo:
    //   DROP TABLE payment_tax_snapshots;
    //   DROP TABLE invoices;
    //   DROP TABLE invoice_sequences;
    //   DROP TABLE tax_quotes;
    id: '017_tax_quotes_and_invoices',
    sql: `
      CREATE TABLE tax_quotes (
        id TEXT PRIMARY KEY,
        quote_key TEXT NOT NULL,
        user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
        customer_email TEXT NOT NULL,
        item_type TEXT NOT NULL CHECK (item_type IN ('TOPIC', 'BATCH')),
        item_id TEXT NOT NULL,
        customer_type TEXT NOT NULL CHECK (customer_type IN ('INDIVIDUAL', 'BUSINESS')),
        taxable_amount_paise BIGINT NOT NULL CHECK (taxable_amount_paise > 0),
        gst_rate_basis_points INTEGER NOT NULL CHECK (gst_rate_basis_points >= 0),
        cgst_paise BIGINT NOT NULL DEFAULT 0 CHECK (cgst_paise >= 0),
        sgst_paise BIGINT NOT NULL DEFAULT 0 CHECK (sgst_paise >= 0),
        igst_paise BIGINT NOT NULL DEFAULT 0 CHECK (igst_paise >= 0),
        total_gst_paise BIGINT NOT NULL DEFAULT 0 CHECK (total_gst_paise >= 0),
        total_amount_paise BIGINT NOT NULL CHECK (total_amount_paise > 0),
        supplier_state_code TEXT NOT NULL,
        place_of_supply_state_code TEXT NOT NULL,
        supply_type TEXT NOT NULL CHECK (supply_type IN ('INTRA_STATE', 'INTER_STATE')),
        sac_code TEXT NOT NULL,
        pricing_mode TEXT NOT NULL DEFAULT 'EXCLUSIVE',
        calculation_version TEXT NOT NULL,
        rounding_policy TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED')),
        consumed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT tax_quotes_gst_sum_check CHECK (total_gst_paise = cgst_paise + sgst_paise + igst_paise),
        CONSTRAINT tax_quotes_total_sum_check CHECK (total_amount_paise = taxable_amount_paise + total_gst_paise)
      );

      CREATE INDEX tax_quotes_active_lookup_idx
        ON tax_quotes (quote_key, status, expires_at);

      CREATE TABLE invoice_sequences (
        fiscal_year TEXT PRIMARY KEY,
        current_sequence BIGINT NOT NULL DEFAULT 0 CHECK (current_sequence >= 0)
      );

      CREATE TABLE invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        payment_id TEXT NOT NULL UNIQUE REFERENCES payments (id) ON DELETE RESTRICT,
        fiscal_year TEXT NOT NULL,
        sequence_number BIGINT NOT NULL CHECK (sequence_number > 0),
        time_of_supply TIMESTAMPTZ NOT NULL,
        issued_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('PENDING', 'ISSUED', 'FAILED', 'CANCELLED')),
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX invoices_fiscal_year_seq_idx
        ON invoices (fiscal_year, sequence_number);

      CREATE TABLE payment_tax_snapshots (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL UNIQUE REFERENCES payments (id) ON DELETE RESTRICT,
        invoice_id TEXT REFERENCES invoices (id) ON DELETE RESTRICT,
        quote_id TEXT REFERENCES tax_quotes (id) ON DELETE SET NULL,
        supplier_legal_name TEXT NOT NULL,
        supplier_gstin TEXT NOT NULL,
        supplier_state_code TEXT NOT NULL,
        supplier_address TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        recipient_mobile TEXT NOT NULL,
        recipient_customer_type TEXT NOT NULL CHECK (recipient_customer_type IN ('INDIVIDUAL', 'BUSINESS')),
        recipient_address_line1 TEXT NOT NULL,
        recipient_address_line2 TEXT,
        recipient_city TEXT NOT NULL,
        recipient_state TEXT NOT NULL,
        recipient_state_code TEXT NOT NULL,
        recipient_pin_code TEXT NOT NULL,
        recipient_business_name TEXT,
        recipient_gstin TEXT,
        recipient_gstin_state_code TEXT,
        place_of_supply_state_code TEXT NOT NULL,
        supply_type TEXT NOT NULL CHECK (supply_type IN ('INTRA_STATE', 'INTER_STATE')),
        sac_code TEXT NOT NULL,
        pricing_mode TEXT NOT NULL DEFAULT 'EXCLUSIVE',
        taxable_amount_paise BIGINT NOT NULL CHECK (taxable_amount_paise > 0),
        gst_rate_basis_points INTEGER NOT NULL CHECK (gst_rate_basis_points >= 0),
        cgst_rate_basis_points INTEGER NOT NULL DEFAULT 0,
        cgst_paise BIGINT NOT NULL DEFAULT 0 CHECK (cgst_paise >= 0),
        sgst_rate_basis_points INTEGER NOT NULL DEFAULT 0,
        sgst_paise BIGINT NOT NULL DEFAULT 0 CHECK (sgst_paise >= 0),
        igst_rate_basis_points INTEGER NOT NULL DEFAULT 0,
        igst_paise BIGINT NOT NULL DEFAULT 0 CHECK (igst_paise >= 0),
        total_gst_paise BIGINT NOT NULL DEFAULT 0 CHECK (total_gst_paise >= 0),
        total_amount_paise BIGINT NOT NULL CHECK (total_amount_paise > 0),
        calculation_version TEXT NOT NULL,
        rounding_policy TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT snapshots_gst_sum_check CHECK (total_gst_paise = cgst_paise + sgst_paise + igst_paise),
        CONSTRAINT snapshots_total_sum_check CHECK (total_amount_paise = taxable_amount_paise + total_gst_paise)
      );

      CREATE OR REPLACE FUNCTION prevent_financial_record_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Financial record in % is immutable and cannot be updated or deleted', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_tax_snapshots_immutable
      BEFORE UPDATE OR DELETE ON payment_tax_snapshots
      FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_modification();
    `,
  },
  {
    // Invoicing safeguards (remediation of the November 2026 finance audit).
    // - tax_configuration_approvals: the recorded CA approval that, together
    //   with INVOICING_ENABLED, activates invoicing. Append-only: a later
    //   REVOKED row withdraws an approval.
    // - payments.tax_quote_id: the quote whose GST a payment actually
    //   collected. A payment is QUOTED only with its quote, and one quote
    //   pays for one payment.
    // - invoices are immutable; the invoice number sequence only moves
    //   forward by one and an invoice must take the number just allocated.
    // - an invoice cannot commit without its tax snapshot (deferred check),
    //   and a snapshot must equal the amount collected on a paid, QUOTED
    //   payment, so no invoice can state GST or a total that was not paid.
    // To undo:
    //   DROP TRIGGER trg_invoices_require_snapshot ON invoices;
    //   DROP TRIGGER trg_invoices_number_matches_sequence ON invoices;
    //   DROP TRIGGER trg_invoices_immutable ON invoices;
    //   DROP TRIGGER trg_invoice_sequences_forward_only ON invoice_sequences;
    //   DROP TRIGGER trg_tax_snapshots_match_payment ON payment_tax_snapshots;
    //   DROP FUNCTION invoice_requires_snapshot(),
    //     invoice_number_matches_sequence(), invoice_sequence_forward_only(),
    //     tax_snapshot_matches_payment();
    //   DROP INDEX payments_tax_quote_unique;
    //   ALTER TABLE payments DROP CONSTRAINT payments_quoted_has_quote,
    //     DROP COLUMN tax_quote_id;
    //   DROP TABLE tax_configuration_approvals;
    //   DELETE FROM schema_migrations WHERE id = '018_invoicing_safeguards';
    //   (019 depends on 018: undo 019 first)
    id: '018_invoicing_safeguards',
    sql: `
      CREATE TABLE tax_configuration_approvals (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('APPROVED', 'REVOKED')),
        supplier_gstin TEXT NOT NULL
          CHECK (supplier_gstin ~ '^[0-9]{2}[0-9A-Z]{13}$'),
        sac_code TEXT NOT NULL CHECK (sac_code ~ '^[0-9]{6}$'),
        gst_rate_basis_points INTEGER NOT NULL
          CHECK (gst_rate_basis_points BETWEEN 0 AND 10000),
        pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('EXCLUSIVE')),
        calculation_version TEXT NOT NULL,
        rounding_policy TEXT NOT NULL,
        effective_from TIMESTAMPTZ NOT NULL,
        approved_by TEXT NOT NULL CHECK (length(trim(approved_by)) > 0),
        approval_reference TEXT NOT NULL
          CHECK (length(trim(approval_reference)) > 0),
        recorded_by TEXT NOT NULL CHECK (length(trim(recorded_by)) > 0),
        recorded_at TIMESTAMPTZ NOT NULL
      );

      CREATE TRIGGER trg_tax_configuration_approvals_append_only
      BEFORE UPDATE OR DELETE ON tax_configuration_approvals
      FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_modification();

      ALTER TABLE payments
        ADD COLUMN tax_quote_id TEXT REFERENCES tax_quotes (id) ON DELETE RESTRICT;
      ALTER TABLE payments ADD CONSTRAINT payments_quoted_has_quote
        CHECK (tax_status <> 'QUOTED' OR tax_quote_id IS NOT NULL) NOT VALID;
      CREATE UNIQUE INDEX payments_tax_quote_unique
        ON payments (tax_quote_id) WHERE tax_quote_id IS NOT NULL;

      CREATE TRIGGER trg_invoices_immutable
      BEFORE UPDATE OR DELETE ON invoices
      FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_modification();

      CREATE FUNCTION invoice_sequence_forward_only()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Invoice sequence for % cannot be deleted', OLD.fiscal_year;
        END IF;
        IF TG_OP = 'INSERT' THEN
          IF NEW.current_sequence <> 1 THEN
            RAISE EXCEPTION 'Invoice sequence for % must start at 1', NEW.fiscal_year;
          END IF;
          RETURN NEW;
        END IF;
        IF NEW.fiscal_year <> OLD.fiscal_year
          OR NEW.current_sequence <> OLD.current_sequence + 1 THEN
          RAISE EXCEPTION 'Invoice sequence for % can only advance by one', OLD.fiscal_year;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_invoice_sequences_forward_only
      BEFORE INSERT OR UPDATE OR DELETE ON invoice_sequences
      FOR EACH ROW EXECUTE FUNCTION invoice_sequence_forward_only();

      CREATE FUNCTION invoice_number_matches_sequence()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM invoice_sequences
          WHERE fiscal_year = NEW.fiscal_year
            AND current_sequence = NEW.sequence_number
        ) THEN
          RAISE EXCEPTION 'Invoice % does not take the number just allocated for %',
            NEW.invoice_number, NEW.fiscal_year;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_invoices_number_matches_sequence
      BEFORE INSERT ON invoices
      FOR EACH ROW EXECUTE FUNCTION invoice_number_matches_sequence();

      CREATE FUNCTION invoice_requires_snapshot()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM payment_tax_snapshots
          WHERE invoice_id = NEW.id AND payment_id = NEW.payment_id
        ) THEN
          RAISE EXCEPTION 'Invoice % has no tax snapshot', NEW.invoice_number;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE CONSTRAINT TRIGGER trg_invoices_require_snapshot
      AFTER INSERT ON invoices
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION invoice_requires_snapshot();

      CREATE FUNCTION tax_snapshot_matches_payment()
      RETURNS TRIGGER AS $$
      DECLARE
        paid RECORD;
      BEGIN
        SELECT status, amount_paise, currency, tax_status, tax_quote_id
          INTO paid FROM payments WHERE id = NEW.payment_id;
        IF NOT FOUND OR paid.status <> 'PAID' OR paid.currency <> 'INR' THEN
          RAISE EXCEPTION 'A tax snapshot needs a paid INR payment (payment %)', NEW.payment_id;
        END IF;
        IF paid.tax_status <> 'QUOTED'
          OR NEW.quote_id IS DISTINCT FROM paid.tax_quote_id THEN
          RAISE EXCEPTION 'Payment % did not collect the quoted GST', NEW.payment_id;
        END IF;
        IF NEW.total_amount_paise <> paid.amount_paise THEN
          RAISE EXCEPTION 'Tax snapshot total % differs from the % paise collected for payment %',
            NEW.total_amount_paise, paid.amount_paise, NEW.payment_id;
        END IF;
        IF NEW.invoice_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM invoices
          WHERE id = NEW.invoice_id AND payment_id = NEW.payment_id
        ) THEN
          RAISE EXCEPTION 'Invoice % belongs to another payment', NEW.invoice_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_tax_snapshots_match_payment
      BEFORE INSERT ON payment_tax_snapshots
      FOR EACH ROW EXECUTE FUNCTION tax_snapshot_matches_payment();
    `,
  },
  {
    // Finance integrity hardening (Phase 1, from the independent
    // verification of November 2026).
    // - Refunds: REQUIRES_REVIEW for a refund Razorpay has not listed a day
    //   after the request (its amount stays reserved), with the reason.
    // - Approvals: a database-assigned order (seq), so the latest record
    //   never depends on caller timestamps; an approval cannot take effect
    //   before it was recorded.
    // - Invoices: one invoice per (financial year, sequence number), and the
    //   number text must be INV/<year>/<sequence>.
    // - Snapshots: always tied to an invoice, and every amount must equal
    //   the quote the payment collected.
    // - Quotes: only an unused quote's status may change (to used or
    //   expired); nothing else in a quote can be edited, and none deleted.
    // - TRUNCATE is refused on every financial table.
    // - invoice_issuance_attempts: per-payment retry state for the invoice
    //   job, so payments that keep failing back off instead of blocking.
    // - email_outbox.claim_token: only the worker holding the current claim
    //   may record an email's result.
    // To undo (019 only; leaves 018 intact):
    //   ALTER TABLE email_outbox DROP COLUMN claim_token;
    //   DROP TABLE invoice_issuance_attempts;
    //   DROP TRIGGER trg_tax_quotes_guard ON tax_quotes;
    //   DROP FUNCTION tax_quote_guard();
    //   DROP TRIGGER trg_tax_configuration_approvals_not_backdated
    //     ON tax_configuration_approvals;
    //   DROP FUNCTION tax_approval_not_backdated();
    //   For each table T in payments, payment_events, payment_refunds,
    //     payment_disputes, finance_audit_log, tax_quotes, invoice_sequences,
    //     invoices, payment_tax_snapshots, tax_configuration_approvals:
    //     DROP TRIGGER trg_T_no_truncate ON T;
    //   DROP FUNCTION prevent_financial_truncate();
    //   Restore the 018 bodies of invoice_number_matches_sequence() and
    //     tax_snapshot_matches_payment() (CREATE OR REPLACE from 018).
    //   DROP INDEX invoices_fiscal_year_sequence_unique;
    //   CREATE INDEX invoices_fiscal_year_seq_idx
    //     ON invoices (fiscal_year, sequence_number);
    //   ALTER TABLE tax_configuration_approvals DROP COLUMN seq;
    //   UPDATE payment_refunds SET status = 'PENDING'
    //     WHERE status = 'REQUIRES_REVIEW';
    //   ALTER TABLE payment_refunds DROP CONSTRAINT payment_refunds_status_check,
    //     DROP COLUMN review_reason;
    //   ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_status_check
    //     CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED'));
    //   DELETE FROM schema_migrations WHERE id = '019_finance_integrity_hardening';
    id: '019_finance_integrity_hardening',
    sql: `
      ALTER TABLE payment_refunds
        DROP CONSTRAINT IF EXISTS payment_refunds_status_check;
      ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_status_check
        CHECK (status IN ('PENDING', 'REQUIRES_REVIEW', 'PROCESSED', 'FAILED'));
      ALTER TABLE payment_refunds ADD COLUMN review_reason TEXT;

      ALTER TABLE tax_configuration_approvals
        ADD COLUMN seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE;

      CREATE FUNCTION tax_approval_not_backdated()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'APPROVED'
          AND NEW.effective_from < NEW.recorded_at - INTERVAL '5 minutes' THEN
          RAISE EXCEPTION 'A tax configuration approval cannot take effect before it is recorded';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_tax_configuration_approvals_not_backdated
      BEFORE INSERT ON tax_configuration_approvals
      FOR EACH ROW EXECUTE FUNCTION tax_approval_not_backdated();

      DROP INDEX IF EXISTS invoices_fiscal_year_seq_idx;
      CREATE UNIQUE INDEX invoices_fiscal_year_sequence_unique
        ON invoices (fiscal_year, sequence_number);

      CREATE OR REPLACE FUNCTION invoice_number_matches_sequence()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM invoice_sequences
          WHERE fiscal_year = NEW.fiscal_year
            AND current_sequence = NEW.sequence_number
        ) THEN
          RAISE EXCEPTION 'Invoice % does not take the number just allocated for %',
            NEW.invoice_number, NEW.fiscal_year;
        END IF;
        IF NEW.invoice_number <>
          'INV/' || NEW.fiscal_year || '/' || lpad(NEW.sequence_number::text, 6, '0') THEN
          RAISE EXCEPTION 'Invoice number % does not match sequence % of %',
            NEW.invoice_number, NEW.sequence_number, NEW.fiscal_year;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION tax_snapshot_matches_payment()
      RETURNS TRIGGER AS $$
      DECLARE
        paid RECORD;
        quoted RECORD;
      BEGIN
        SELECT status, amount_paise, currency, tax_status, tax_quote_id
          INTO paid FROM payments WHERE id = NEW.payment_id;
        IF NOT FOUND OR paid.status <> 'PAID' OR paid.currency <> 'INR' THEN
          RAISE EXCEPTION 'A tax snapshot needs a paid INR payment (payment %)', NEW.payment_id;
        END IF;
        IF paid.tax_status <> 'QUOTED'
          OR NEW.quote_id IS DISTINCT FROM paid.tax_quote_id THEN
          RAISE EXCEPTION 'Payment % did not collect the quoted GST', NEW.payment_id;
        END IF;
        IF NEW.total_amount_paise <> paid.amount_paise THEN
          RAISE EXCEPTION 'Tax snapshot total % differs from the % paise collected for payment %',
            NEW.total_amount_paise, paid.amount_paise, NEW.payment_id;
        END IF;
        IF NEW.invoice_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM invoices
          WHERE id = NEW.invoice_id AND payment_id = NEW.payment_id
        ) THEN
          RAISE EXCEPTION 'A tax snapshot must belong to an invoice for payment %', NEW.payment_id;
        END IF;
        SELECT taxable_amount_paise, cgst_paise, sgst_paise, igst_paise,
               total_gst_paise, place_of_supply_state_code, supply_type
          INTO quoted FROM tax_quotes WHERE id = NEW.quote_id;
        IF NOT FOUND
          OR NEW.taxable_amount_paise <> quoted.taxable_amount_paise
          OR NEW.cgst_paise <> quoted.cgst_paise
          OR NEW.sgst_paise <> quoted.sgst_paise
          OR NEW.igst_paise <> quoted.igst_paise
          OR NEW.total_gst_paise <> quoted.total_gst_paise
          OR NEW.place_of_supply_state_code <> quoted.place_of_supply_state_code
          OR NEW.supply_type <> quoted.supply_type THEN
          RAISE EXCEPTION 'Tax snapshot for payment % differs from the GST quoted and collected',
            NEW.payment_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE FUNCTION tax_quote_guard()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Tax quote % cannot be deleted', OLD.id;
        END IF;
        IF (to_jsonb(NEW) - ARRAY['status', 'consumed_at', 'user_id'])
          IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'consumed_at', 'user_id'])
          OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Tax quote % cannot be edited', OLD.id;
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status
          AND NOT (OLD.status = 'ACTIVE' AND NEW.status IN ('CONSUMED', 'EXPIRED')) THEN
          RAISE EXCEPTION 'Tax quote % cannot move from % to %', OLD.id, OLD.status, NEW.status;
        END IF;
        IF NEW.consumed_at IS DISTINCT FROM OLD.consumed_at
          AND NOT (OLD.status = 'ACTIVE' AND NEW.status = 'CONSUMED') THEN
          RAISE EXCEPTION 'Tax quote % usage time cannot be changed', OLD.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_tax_quotes_guard
      BEFORE UPDATE OR DELETE ON tax_quotes
      FOR EACH ROW EXECUTE FUNCTION tax_quote_guard();

      CREATE FUNCTION prevent_financial_truncate()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Financial table % cannot be truncated', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_payments_no_truncate BEFORE TRUNCATE ON payments
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_payment_events_no_truncate BEFORE TRUNCATE ON payment_events
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_payment_refunds_no_truncate BEFORE TRUNCATE ON payment_refunds
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_payment_disputes_no_truncate BEFORE TRUNCATE ON payment_disputes
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_finance_audit_log_no_truncate BEFORE TRUNCATE ON finance_audit_log
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_tax_quotes_no_truncate BEFORE TRUNCATE ON tax_quotes
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_invoice_sequences_no_truncate BEFORE TRUNCATE ON invoice_sequences
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_invoices_no_truncate BEFORE TRUNCATE ON invoices
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_payment_tax_snapshots_no_truncate BEFORE TRUNCATE ON payment_tax_snapshots
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();
      CREATE TRIGGER trg_tax_configuration_approvals_no_truncate
        BEFORE TRUNCATE ON tax_configuration_approvals
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_truncate();

      CREATE TABLE invoice_issuance_attempts (
        payment_id TEXT PRIMARY KEY REFERENCES payments (id) ON DELETE RESTRICT,
        attempts INTEGER NOT NULL CHECK (attempts > 0),
        last_reason TEXT,
        last_error TEXT NOT NULL,
        last_attempt_at TIMESTAMPTZ NOT NULL,
        next_attempt_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX invoice_issuance_attempts_due_idx
        ON invoice_issuance_attempts (next_attempt_at);

      ALTER TABLE email_outbox ADD COLUMN claim_token TEXT;

      -- 018 added this check NOT VALID; no code has ever set QUOTED, so
      -- every existing row satisfies it
      ALTER TABLE payments VALIDATE CONSTRAINT payments_quoted_has_quote;
    `,
  },
  {
    // Financial history guards (Phase 1.6, from the Phase 1.5 audit).
    // Database-level, so they hold whatever code or role writes the rows.
    // - payment_events: append-only. The only change allowed is recording
    //   the outcome once, right after the event is stored (RECORDED to its
    //   outcome, and the payment it matched).
    // - payment_refunds: never deleted. Amount, payment, currency, receipt
    //   and origin never change; a Razorpay refund id is set once; status
    //   moves only forward (PENDING/REQUIRES_REVIEW to any, FAILED only to
    //   PROCESSED when Razorpay confirms it, PROCESSED never).
    // - payments: once PAID, the amount, currency, provider, order,
    //   Razorpay payment id, paid time, buyer and status are fixed, and the
    //   row cannot be deleted. Other columns (tax review status) stay
    //   writable for the CA review.
    // - email_outbox: UNCONFIRMED for an email whose last attempt may have
    //   reached the provider but whose result was never recorded; it is
    //   never resent automatically.
    // To undo (020 only):
    //   DROP TRIGGER trg_payment_events_guard ON payment_events;
    //   DROP TRIGGER trg_payment_refunds_guard ON payment_refunds;
    //   DROP TRIGGER trg_payments_paid_guard ON payments;
    //   DROP FUNCTION payment_event_guard(), payment_refund_guard(),
    //     paid_payment_guard();
    //   UPDATE email_outbox SET status = 'FAILED' WHERE status = 'UNCONFIRMED';
    //   ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_status_check;
    //   ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check
    //     CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED'));
    //   DELETE FROM schema_migrations WHERE id = '020_financial_history_guards';
    id: '020_financial_history_guards',
    sql: `
      CREATE FUNCTION payment_event_guard()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Payment event % cannot be deleted', OLD.id;
        END IF;
        IF (to_jsonb(NEW) - ARRAY['outcome', 'payment_id'])
            IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['outcome', 'payment_id'])
          OR OLD.outcome <> 'RECORDED'
          OR (OLD.payment_id IS NOT NULL
              AND NEW.payment_id IS DISTINCT FROM OLD.payment_id) THEN
          RAISE EXCEPTION 'Payment event % cannot be changed', OLD.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_payment_events_guard
      BEFORE UPDATE OR DELETE ON payment_events
      FOR EACH ROW EXECUTE FUNCTION payment_event_guard();

      CREATE FUNCTION payment_refund_guard()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Refund % cannot be deleted', OLD.id;
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id
          OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
          OR NEW.provider IS DISTINCT FROM OLD.provider
          OR NEW.amount_paise IS DISTINCT FROM OLD.amount_paise
          OR NEW.currency IS DISTINCT FROM OLD.currency
          OR NEW.receipt IS DISTINCT FROM OLD.receipt
          OR NEW.request_key IS DISTINCT FROM OLD.request_key
          OR NEW.source IS DISTINCT FROM OLD.source
          OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
          OR NEW.reason IS DISTINCT FROM OLD.reason
          OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
          RAISE EXCEPTION 'Refund % details cannot be changed', OLD.id;
        END IF;
        IF OLD.provider_refund_id IS NOT NULL
          AND NEW.provider_refund_id IS DISTINCT FROM OLD.provider_refund_id THEN
          RAISE EXCEPTION 'Refund % Razorpay id cannot be changed', OLD.id;
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
          OLD.status IN ('PENDING', 'REQUIRES_REVIEW')
          OR (OLD.status = 'FAILED' AND NEW.status = 'PROCESSED')
        ) THEN
          RAISE EXCEPTION 'Refund % cannot move from % to %',
            OLD.id, OLD.status, NEW.status;
        END IF;
        IF OLD.processed_at IS NOT NULL
          AND NEW.processed_at IS DISTINCT FROM OLD.processed_at THEN
          RAISE EXCEPTION 'Refund % processed time cannot be changed', OLD.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_payment_refunds_guard
      BEFORE UPDATE OR DELETE ON payment_refunds
      FOR EACH ROW EXECUTE FUNCTION payment_refund_guard();

      CREATE FUNCTION paid_payment_guard()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status <> 'PAID' THEN
          IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
          RETURN NEW;
        END IF;
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Paid payment % cannot be deleted', OLD.id;
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status
          OR NEW.id IS DISTINCT FROM OLD.id
          OR NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.amount_paise IS DISTINCT FROM OLD.amount_paise
          OR NEW.currency IS DISTINCT FROM OLD.currency
          OR NEW.provider IS DISTINCT FROM OLD.provider
          OR NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id
          OR NEW.provider_payment_id IS DISTINCT FROM OLD.provider_payment_id
          OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
          RAISE EXCEPTION 'Paid payment % cannot change its amount, currency, provider references, buyer, paid time or status',
            OLD.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_payments_paid_guard
      BEFORE UPDATE OR DELETE ON payments
      FOR EACH ROW EXECUTE FUNCTION paid_payment_guard();

      ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_status_check;
      ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check
        CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'UNCONFIRMED'));
    `,
  },
  {
    // Migration 021 undo instructions (forward-only repository convention; document only):
    //   CREATE OR REPLACE FUNCTION tax_approval_not_backdated()
    //   RETURNS TRIGGER AS $$
    //   BEGIN
    //     IF NEW.status = 'APPROVED'
    //       AND NEW.effective_from < NEW.recorded_at - INTERVAL '5 minutes' THEN
    //       RAISE EXCEPTION 'A tax configuration approval cannot take effect before it is recorded';
    //     END IF;
    //     RETURN NEW;
    //   END;
    //   $$ LANGUAGE plpgsql;
    //   ALTER TABLE tax_configuration_approvals ALTER COLUMN recorded_at DROP DEFAULT;
    //   DELETE FROM schema_migrations WHERE id = '021_tax_approval_clock_timestamp';
    id: '021_tax_approval_clock_timestamp',
    sql: `
      ALTER TABLE tax_configuration_approvals
        ALTER COLUMN recorded_at SET DEFAULT clock_timestamp();

      CREATE OR REPLACE FUNCTION tax_approval_not_backdated()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.recorded_at := clock_timestamp();
        IF NEW.status = 'APPROVED'
          AND NEW.effective_from < NEW.recorded_at - INTERVAL '5 minutes' THEN
          RAISE EXCEPTION 'A tax configuration approval cannot take effect before it is recorded';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `,
  },
  {
    // Migration 022 undo instructions (forward-only repository convention; document only):
    //   DROP INDEX IF EXISTS payment_refunds_provider_refund_id_unique;
    //   DELETE FROM schema_migrations WHERE id = '022_payment_refunds_provider_id_unique';
    id: '022_payment_refunds_provider_id_unique',
    sql: `
      DO $$
      DECLARE
        dup_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO dup_count
        FROM (
          SELECT provider_refund_id
          FROM payment_refunds
          WHERE provider_refund_id IS NOT NULL
          GROUP BY provider_refund_id
          HAVING COUNT(*) > 1
        ) dups;

        IF dup_count > 0 THEN
          RAISE EXCEPTION 'Cannot create unique index: payment_refunds contains % duplicate provider_refund_id values', dup_count;
        END IF;
      END $$;

      CREATE UNIQUE INDEX payment_refunds_provider_refund_id_unique
        ON payment_refunds (provider_refund_id)
        WHERE provider_refund_id IS NOT NULL;
    `,
  },
  {
    // Migration 023 undo instructions (forward-only repository convention; document only):
    //   ALTER TABLE payment_refunds DROP CONSTRAINT payment_refunds_provider_refund_id_clean;
    //   DELETE FROM schema_migrations WHERE id = '023_payment_refunds_provider_id_clean';
    //
    // A provider refund id is exactly what Razorpay sent: never blank, and
    // never padded with whitespace (the application refuses both; this is the
    // database's own guard). Existing rows are not rewritten. When any row
    // already breaks the rule the constraint is added NOT VALID, so it still
    // protects every new and changed row, and finance can review the old
    // ones (SELECT id, provider_refund_id FROM payment_refunds WHERE
    // provider_refund_id IS NOT NULL AND provider_refund_id !~ '^\S(.*\S)?$').
    id: '023_payment_refunds_provider_id_clean',
    sql: `
      ALTER TABLE payment_refunds
        ADD CONSTRAINT payment_refunds_provider_refund_id_clean
        CHECK (
          provider_refund_id IS NULL
          OR provider_refund_id ~ '^\\S(.*\\S)?$'
        ) NOT VALID;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM payment_refunds
          WHERE provider_refund_id IS NOT NULL
            AND provider_refund_id !~ '^\\S(.*\\S)?$'
        ) THEN
          ALTER TABLE payment_refunds
            VALIDATE CONSTRAINT payment_refunds_provider_refund_id_clean;
        ELSE
          RAISE NOTICE 'payment_refunds has provider_refund_id values that are blank or padded; constraint left NOT VALID for review';
        END IF;
      END $$;
    `,
  },
];
