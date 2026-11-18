import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { loadConfig } from '../config/env.js';
import {
  INVOICE_INELIGIBLE,
  InvoiceIneligibleError,
  issueInvoice,
  reconcileMissingInvoices,
} from '../modules/finance/invoices/invoices.service.js';
import {
  findInvoiceByPaymentId,
  insertTaxConfigurationApproval,
  recordIssuanceFailure,
} from '../modules/finance/invoices/invoices.repository.js';
import {
  CURRENT_TAX_CONFIGURATION,
  getInvoicingActivation,
  lockApprovalsForChange,
} from '../modules/finance/invoices/invoicing.activation.js';
import { generateHistoricalPaymentsReport } from '../modules/finance/reports.service.js';
import {
  applyPaymentEvent,
  EVENT_SOURCE,
} from '../modules/payments/payments.lifecycle.js';
import { reconcilePendingRefunds } from '../modules/payments/payments.refunds.reconciliation.js';
import { requestRefund } from '../modules/payments/payments.refunds.js';
import { createScriptedRazorpay } from '../test/fakeRazorpay.js';
import {
  captureQuotedPayment,
  createQuotedPayment,
  recordTestApproval,
  TEST_LATER,
  TEST_PAID_AT,
} from '../test/invoicing.js';
import {
  asPostgresAdmin,
  postgresSuite,
  postgresUrl,
} from '../test/postgres.js';
import {
  DatabaseRoleError,
  inspectApplicationRole,
} from './applicationRole.js';
import { seedCatalogue } from './catalogueSeed.js';
import { openDatabase, transaction, type Database } from './client.js';
import { openApplicationDatabase } from './startup.js';

// The two-role model on a real PostgreSQL server, through the same start-up
// function the API uses: the owner (a non-superuser that owns the database)
// migrates and grants, the API serves as a restricted role. Covers the
// database guards on financial history, every role misconfiguration that
// must stop start-up, the invoice approval lock, the refund lock order and
// the invoice retry counter.

const PAID_AT = TEST_PAID_AT;
const LATER = TEST_LATER;
const HOUR = 60 * 60 * 1000;
const local = { mode: 'disable' as const, ca: null };

describe(
  'Database roles and financial guards on real PostgreSQL',
  postgresSuite('applicationRole.postgres'),
  () => {
    const suffix = randomBytes(5).toString('hex');
    const database = `sridha_role_test_${suffix}`;
    const roles: string[] = [];
    const password = randomBytes(18).toString('hex');
    const role = (name: string) => {
      const full = `sridha_t_${name}_${suffix}`;
      roles.push(full);
      return { name: full, password };
    };
    const owner = role('own');
    const app = role('app');
    let ownerDb: Database;
    let db: Database;
    const config = loadConfig({ NODE_ENV: 'test', INVOICING_ENABLED: 'true' });

    const settings = (appUser: { name: string; password: string }) => ({
      databaseUrl: postgresUrl(database, appUser),
      migrationDatabaseUrl: postgresUrl(database, owner),
      databaseTls: local,
      pgMaxConnections: 10,
    });

    const createRole = (user: { name: string; password: string }, extra = '') =>
      asPostgresAdmin(
        `CREATE ROLE ${user.name} LOGIN PASSWORD '${user.password}' ${extra}`,
      );

    const staffMember = async () => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, NULL, 'FINANCE_ADMIN', $3, $3)`,
        [id, `finance.${id}@sridha.test`, LATER.toISOString()],
      );
      return { userId: id, role: 'FINANCE_ADMIN' as const };
    };

    const providerPaymentIdOf = async (paymentId: string) =>
      String(
        (
          await db.get(
            'SELECT provider_payment_id FROM payments WHERE id = $1',
            [paymentId],
          )
        )?.provider_payment_id,
      );

    before(async () => {
      await createRole(owner);
      await createRole(app);
      await asPostgresAdmin(`CREATE DATABASE ${database} OWNER ${owner.name}`);
      db = await openApplicationDatabase(settings(app));
      ownerDb = await openDatabase(postgresUrl(database, owner), 2, local);
      await seedCatalogue(ownerDb);
    });

    after(async () => {
      await db?.close();
      await ownerDb?.close();
      await asPostgresAdmin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      for (const name of roles) {
        await asPostgresAdmin(`DROP ROLE IF EXISTS ${name}`);
      }
    });

    it('serves as a restricted role, and the owner keeps what migrations need', async () => {
      const report = await inspectApplicationRole(db);
      assert.equal(report.role, app.name);
      assert.deepEqual(report.problems, []);

      // Start-up again: grants are idempotent and never touch the owner
      const second = await openApplicationDatabase(settings(app));
      await second.close();
      const privileges = await ownerDb.get<{ insert: boolean }>(
        `SELECT has_table_privilege(current_user, 'schema_migrations', 'INSERT') AS insert`,
      );
      assert.equal(privileges?.insert, true);
      assert.ok(
        (await inspectApplicationRole(ownerDb)).problems.length > 0,
        'the owner itself would fail the application-role check',
      );
    });

    it('runs the whole money path as the application role, and the figures agree', async () => {
      const razorpay = createScriptedRazorpay();
      const context = (at: Date) => ({ db, config, now: () => at });

      const payment = await createQuotedPayment(db, { at: PAID_AT });
      assert.equal(
        (await captureQuotedPayment(db, payment, PAID_AT)).outcome,
        'APPLIED',
      );
      await recordTestApproval(db);
      assert.equal(
        (await reconcileMissingInvoices(context(LATER))).processed,
        1,
      );

      razorpay.state.refundResult = () => ({ outcome: 'unknown' });
      await requestRefund(
        context(LATER),
        razorpay.gateway,
        await staffMember(),
        payment.paymentId,
        { amountPaise: 1000, reason: 'Partial refund' },
      );
      const providerPaymentId = await providerPaymentIdOf(payment.paymentId);
      razorpay.paymentRefunds.set(providerPaymentId, []);
      const absent = await reconcilePendingRefunds(
        context(new Date(LATER.getTime() + 25 * HOUR)),
        razorpay.gateway,
        { olderThanMinutes: 0 },
      );
      assert.equal(absent.needsReview, 1);
      razorpay.paymentRefunds.set(providerPaymentId, [
        {
          id: 'rfnd_pg_late',
          status: 'processed',
          amountPaise: 1000,
          currency: 'INR',
          paymentId: providerPaymentId,
          receipt: razorpay.refundRequests[0].receipt,
        },
      ]);
      const settled = await reconcilePendingRefunds(
        context(new Date(LATER.getTime() + 26 * HOUR)),
        razorpay.gateway,
        { olderThanMinutes: 0 },
      );
      assert.equal(settled.processed, 1);

      await createQuotedPayment(db, { at: PAID_AT });

      const snapshot = await db.get<{ total: string }>(
        'SELECT total_amount_paise AS total FROM payment_tax_snapshots WHERE payment_id = $1',
        [payment.paymentId],
      );
      const report = await generateHistoricalPaymentsReport(
        db,
        () => LATER,
        new Date('2026-07-01T00:00:00+05:30'),
      );
      assert.equal(Number(snapshot?.total), payment.amountPaise);
      assert.equal(report.summary.realCapturedPaise, payment.amountPaise);
      assert.equal(report.summary.realRefundedPaise, 1000);
      assert.equal(
        report.summary.realNetCollectedPaise,
        payment.amountPaise - 1000,
      );
      assert.equal(report.summary.realNotCollectedCount, 1);
    });

    it('refuses every way to rewrite or erase financial history', async () => {
      const paid = await createQuotedPayment(db, { at: PAID_AT });
      await captureQuotedPayment(db, paid, PAID_AT);
      const refundId = String(
        (
          await db.get(
            `SELECT id FROM payment_refunds WHERE status = 'PROCESSED' LIMIT 1`,
          )
        )?.id,
      );
      const refused = (target: Database, sql: string, pattern: RegExp) =>
        assert.rejects(target.exec(sql), pattern, sql);
      const id = paid.paymentId;

      // As the application role
      await refused(db, 'TRUNCATE invoices CASCADE', /permission denied/);
      await refused(db, 'TRUNCATE payment_events', /permission denied/);
      await refused(
        db,
        'ALTER TABLE payments DISABLE TRIGGER ALL',
        /must be owner/,
      );
      await refused(
        db,
        'DROP TRIGGER trg_payments_paid_guard ON payments',
        /must be owner/,
      );
      await refused(
        db,
        'SET session_replication_role = replica',
        /permission denied/,
      );
      await refused(db, 'CREATE TABLE sneaky (id int)', /permission denied/);
      await refused(
        db,
        `UPDATE invoices SET invoice_number = 'EDITED'`,
        /permission denied/,
      );
      await refused(db, 'DELETE FROM finance_audit_log', /permission denied/);
      await refused(db, 'DELETE FROM schema_migrations', /permission denied/);
      for (const change of [
        'amount_paise = 1',
        `status = 'CREATED'`,
        `currency = 'USD'`,
        `provider_payment_id = 'pay_other'`,
        `paid_at = now()`,
      ]) {
        await refused(
          db,
          `UPDATE payments SET ${change} WHERE id = '${id}'`,
          /Paid payment .* cannot change/,
        );
      }
      await refused(
        db,
        `DELETE FROM payments WHERE id = '${id}'`,
        /permission denied/,
      );
      await refused(db, 'DELETE FROM payment_events', /permission denied/);
      await refused(
        db,
        'UPDATE payment_events SET amount_paise = 1',
        /cannot be changed/,
      );
      await refused(db, 'DELETE FROM payment_refunds', /permission denied/);
      await refused(
        db,
        `UPDATE payment_refunds SET amount_paise = 1 WHERE id = '${refundId}'`,
        /details cannot be changed/,
      );
      await refused(
        db,
        `UPDATE payment_refunds SET status = 'PENDING' WHERE id = '${refundId}'`,
        /cannot move from PROCESSED to PENDING/,
      );

      // The guards hold for the owner too: they are triggers, not grants
      await refused(
        ownerDb,
        `UPDATE payments SET amount_paise = 1 WHERE id = '${id}'`,
        /Paid payment .* cannot change/,
      );
      await refused(
        ownerDb,
        `DELETE FROM payments WHERE id = '${id}'`,
        /Paid payment .* cannot be deleted/,
      );
      await refused(ownerDb, 'DELETE FROM payment_events', /cannot be deleted/);
      await refused(
        ownerDb,
        `DELETE FROM payment_refunds WHERE id = '${refundId}'`,
        /cannot be deleted/,
      );
      await refused(
        ownerDb,
        'TRUNCATE payment_refunds CASCADE',
        /cannot be truncated/,
      );
      await refused(
        ownerDb,
        'SET session_replication_role = replica',
        /permission denied/,
      );

      // A tax review can still update a paid payment's tax status
      await ownerDb.query(
        `UPDATE payments SET tax_status = 'LEGACY_UNREVIEWED' WHERE id = $1 AND tax_status = 'PENDING_CONFIGURATION'`,
        [id],
      );
    });

    it('stops start-up for every unsafe role configuration', async () => {
      const startWith = (
        appUser: { name: string; password: string },
        url?: string,
      ) =>
        openApplicationDatabase({
          ...settings(appUser),
          ...(url ? { databaseUrl: url } : {}),
        });

      // The same role behind a different URL
      await assert.rejects(
        startWith(
          owner,
          `${postgresUrl(database, owner)}?application_name=api`,
        ),
        (error: unknown) =>
          error instanceof DatabaseRoleError &&
          /both sign in as/.test(error.message),
      );

      // The application role can act as the owner through membership
      const member = role('member');
      await createRole(member);
      await asPostgresAdmin(`GRANT ${owner.name} TO ${member.name}`);
      await assert.rejects(
        startWith(member),
        /is a member of the migration role/,
      );

      // The owner is a member of the application role
      const related = role('related');
      await createRole(related);
      await asPostgresAdmin(`GRANT ${related.name} TO ${owner.name}`);
      await assert.rejects(
        startWith(related),
        /is a member of the application role/,
      );
      await asPostgresAdmin(`REVOKE ${related.name} FROM ${owner.name}`);

      // A role with powers the application must not have
      const powerful = role('powerful');
      await createRole(powerful, 'CREATEDB CREATEROLE');
      await assert.rejects(
        startWith(powerful),
        /can create roles; can create databases/,
      );

      // Everyone may create tables in public (the PostgreSQL 14 default)
      await ownerDb.exec('GRANT CREATE ON SCHEMA public TO PUBLIC');
      try {
        await assert.rejects(
          startWith(app),
          /can create tables in schema public/,
        );
      } finally {
        await ownerDb.exec('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      }

      // A role that does not exist
      await assert.rejects(
        startWith({ name: `sridha_t_missing_${suffix}`, password }),
        /does not exist/,
      );

      // After all that, the owner can still migrate and the app still starts
      const again = await startWith(app);
      await again.close();
    });

    it('issues nothing after a revocation that was in progress (approval lock)', async () => {
      const payment = await createQuotedPayment(db, { at: PAID_AT });
      await captureQuotedPayment(db, payment, PAID_AT);
      const activation = await getInvoicingActivation(db, config, LATER);
      assert.ok(activation.active);

      // A revocation holds the approval lock while it is being recorded
      let release!: () => void;
      const held = new Promise<void>(resolve => (release = resolve));
      const revoking = transaction(db, async tx => {
        await lockApprovalsForChange(tx);
        await insertTaxConfigurationApproval(tx, {
          id: randomUUID(),
          status: 'REVOKED',
          ...CURRENT_TAX_CONFIGURATION,
          effectiveFrom: LATER.toISOString(),
          approvedBy: 'Test fixture CA',
          approvalReference: 'TEST-REVOKE',
          recordedBy: 'admin@sridha.test',
          recordedAt: LATER.toISOString(),
        });
        await held;
      });
      await new Promise(resolve => setTimeout(resolve, 100));

      // The job read the approval before the revocation; issuing must wait
      const issuing = issueInvoice(
        { db, now: () => LATER },
        activation.approval,
        payment.paymentId,
      ).then(
        () => 'issued',
        (error: unknown) => error,
      );
      await new Promise(resolve => setTimeout(resolve, 300));
      release();
      await revoking;

      const outcome = await issuing;
      assert.ok(
        outcome instanceof InvoiceIneligibleError &&
          outcome.reason === INVOICE_INELIGIBLE.approvalChanged,
        `expected APPROVAL_CHANGED, got ${String(outcome)}`,
      );
      assert.equal(await findInvoiceByPaymentId(db, payment.paymentId), null);
      await recordTestApproval(db);
    });

    it('takes refund locks in one order, so a webhook and reconciliation never deadlock', async () => {
      const razorpay = createScriptedRazorpay();
      const payment = await createQuotedPayment(db, { at: PAID_AT });
      await captureQuotedPayment(db, payment, PAID_AT);
      const providerPaymentId = await providerPaymentIdOf(payment.paymentId);
      razorpay.state.refundResult = () => ({ outcome: 'unknown' });
      await requestRefund(
        { db, now: () => LATER },
        razorpay.gateway,
        await staffMember(),
        payment.paymentId,
        { amountPaise: 700, reason: 'Lock order' },
      );
      const receipt = razorpay.refundRequests[0].receipt;
      razorpay.paymentRefunds.set(providerPaymentId, [
        {
          id: 'rfnd_lock_order',
          status: 'processed',
          amountPaise: 700,
          currency: 'INR',
          paymentId: providerPaymentId,
          receipt,
        },
      ]);

      // Every refund update pauses while holding its locks, so the two paths
      // overlap each time (fires before the refund cap trigger)
      await ownerDb.exec(`
        CREATE FUNCTION a_slow_refund_update() RETURNS TRIGGER AS $$
        BEGIN PERFORM pg_sleep(0.4); RETURN NEW; END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER a_slow_refund_update BEFORE UPDATE ON payment_refunds
        FOR EACH ROW EXECUTE FUNCTION a_slow_refund_update();
      `);
      try {
        const later = () => new Date(LATER.getTime() + HOUR);
        const reconciling = reconcilePendingRefunds(
          { db, now: later },
          razorpay.gateway,
          { olderThanMinutes: 0 },
        );
        await new Promise(resolve => setTimeout(resolve, 150));
        const webhook = applyPaymentEvent(
          { db, now: later },
          {
            provider: 'RAZORPAY',
            source: EVENT_SOURCE.webhook,
            eventId: `evt_lock_${suffix}`,
            eventType: 'refund.processed',
            providerPaymentId,
            providerOrderId: null,
            amountPaise: 700,
            currency: 'INR',
            payload: {},
            refund: {
              id: 'rfnd_lock_order',
              paymentId: providerPaymentId,
              amountPaise: 700,
              currency: 'INR',
              receipt,
              status: 'processed',
            },
          },
        );
        const [reconciled, delivered] = await Promise.allSettled([
          reconciling,
          webhook,
        ]);
        assert.equal(delivered.status, 'fulfilled', 'webhook completed');
        assert.equal(
          reconciled.status,
          'fulfilled',
          'reconciliation completed',
        );
        if (reconciled.status === 'fulfilled') {
          // A deadlock is caught per item and counted as skipped
          assert.equal(reconciled.value.skipped, 0, 'no item hit a deadlock');
        }
      } finally {
        await ownerDb.exec(`
          DROP TRIGGER a_slow_refund_update ON payment_refunds;
          DROP FUNCTION a_slow_refund_update();
        `);
      }

      const refund = await db.get(
        'SELECT status, amount_paise, provider_refund_id FROM payment_refunds WHERE receipt = $1',
        [receipt],
      );
      assert.equal(refund?.status, 'PROCESSED');
      assert.equal(Number(refund?.amount_paise), 700);
      assert.equal(refund?.provider_refund_id, 'rfnd_lock_order');
    });

    it('counts concurrent invoice failures exactly and caps the delay', async () => {
      const payment = await createQuotedPayment(db, { at: PAID_AT });
      await captureQuotedPayment(db, payment, PAID_AT);
      const fail = () =>
        recordIssuanceFailure(db, {
          paymentId: payment.paymentId,
          reason: 'TEST',
          error: 'injected',
          at: LATER.toISOString(),
          baseDelayHours: 1,
          maxDelayHours: 24,
        });

      await Promise.all(Array.from({ length: 8 }, fail));
      const row = await db.get<{ attempts: number; delay_hours: string }>(
        `SELECT attempts,
           EXTRACT(EPOCH FROM next_attempt_at - last_attempt_at) / 3600 AS delay_hours
         FROM invoice_issuance_attempts WHERE payment_id = $1`,
        [payment.paymentId],
      );
      assert.equal(row?.attempts, 8);
      assert.equal(Number(row?.delay_hours), 24);
    });
  },
);
