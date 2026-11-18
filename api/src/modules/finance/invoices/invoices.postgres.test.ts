import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import pg from 'pg';

import { seedCatalogue } from '../../../db/catalogueSeed.js';
import {
  openDatabase,
  runMigrations,
  transaction,
  type Database,
} from '../../../db/client.js';
import { loadConfig } from '../../../config/env.js';
import { ApiError, ERROR_CODE } from '../../../http/errors.js';
import {
  captureQuotedPayment,
  countRows,
  createQuotedPayment,
  recordTestApproval,
  TEST_LATER,
  TEST_PAID_AT,
  TEST_TOPIC_ID,
} from '../../../test/invoicing.js';
import { postgresSuite } from '../../../test/postgres.js';
import { createTaxQuote, redeemTaxQuote } from '../quotes/quotes.service.js';
import { findInvoiceByPaymentId } from './invoices.repository.js';
import { issueInvoice, reconcileMissingInvoices } from './invoices.service.js';
import { getInvoicingActivation } from './invoicing.activation.js';

// Locking, deferred constraints and concurrency on a real PostgreSQL
// server, not only PGlite (which runs one statement at a time). Needs
// TEST_DATABASE_URL pointing at a server's maintenance database (e.g.
// .../postgres); creates its own throwaway database and drops it after.
// Skipped when the variable is unset.
const ADMIN_URL = process.env.TEST_DATABASE_URL;

const PAID_AT = TEST_PAID_AT;
const LATER = TEST_LATER;

describe(
  'Invoicing on real PostgreSQL',
  postgresSuite('invoices.postgres'),
  () => {
    const databaseName = `sridha_invoice_test_${randomBytes(6).toString('hex')}`;
    let db: Database;
    const config = loadConfig({ NODE_ENV: 'test', INVOICING_ENABLED: 'true' });
    const context = () => ({ db, config, now: () => LATER });

    const admin = async (sql: string) => {
      const client = new pg.Client({ connectionString: ADMIN_URL });
      await client.connect();
      try {
        await client.query(sql);
      } finally {
        await client.end();
      }
    };

    const freshPaidPayments = async (count: number) => {
      const payments = [];
      for (let index = 0; index < count; index++) {
        const payment = await createQuotedPayment(db, { at: PAID_AT });
        await captureQuotedPayment(db, payment, PAID_AT);
        payments.push(payment);
      }
      return payments;
    };

    const invoiceNumbers = async () =>
      (
        await db.all<{ invoice_number: string }>(
          'SELECT invoice_number FROM invoices ORDER BY fiscal_year, sequence_number',
        )
      ).map(row => row.invoice_number);

    before(async () => {
      await admin(`CREATE DATABASE ${databaseName}`);
      const url = new URL(ADMIN_URL!);
      url.pathname = `/${databaseName}`;
      db = await openDatabase(url.toString(), 20, {
        mode: 'disable',
        ca: null,
      });
      await runMigrations(db);
      await seedCatalogue(db);
      await recordTestApproval(db);
    });

    after(async () => {
      await db?.close();
      await admin(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    });

    it('issues contiguous numbers, one invoice per payment, under concurrent job runs', async () => {
      const payments = await freshPaidPayments(8);

      const runs = await Promise.all(
        Array.from({ length: 4 }, () => reconcileMissingInvoices(context())),
      );
      assert.equal(
        runs.reduce((sum, run) => sum + run.failed, 0),
        0,
      );

      assert.deepEqual(
        await invoiceNumbers(),
        Array.from(
          { length: 8 },
          (_, i) => `INV/26-27/${String(i + 1).padStart(6, '0')}`,
        ),
      );
      for (const payment of payments) {
        const rows = await db.all(
          'SELECT id FROM invoices WHERE payment_id = $1',
          [payment.paymentId],
        );
        assert.equal(rows.length, 1);
      }
      assert.equal(await countRows(db, 'payment_tax_snapshots'), 8);
    });

    it('gives one invoice when the same payment is issued many times at once', async () => {
      const [payment] = await freshPaidPayments(1);
      const activation = await getInvoicingActivation(db, config, LATER);
      assert.ok(activation.active);

      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          issueInvoice(context(), activation.approval, payment.paymentId),
        ),
      );
      assert.ok(results.every(result => result.status === 'fulfilled'));
      const numbers = new Set(
        results.map(result =>
          result.status === 'fulfilled'
            ? result.value.invoice.invoiceNumber
            : '',
        ),
      );
      assert.equal(numbers.size, 1);
      assert.equal(
        (await findInvoiceByPaymentId(db, payment.paymentId))?.invoiceNumber,
        [...numbers][0],
      );
    });

    it('lets exactly one of several simultaneous checkouts redeem a quote', async () => {
      const email = 'pg.redeemer@example.com';
      const quote = await createTaxQuote(
        { db, now: () => PAID_AT },
        {
          itemType: 'TOPIC',
          itemId: TEST_TOPIC_ID,
          customerType: 'INDIVIDUAL',
          customerEmail: email,
          addressLine1: '10 Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400020',
        },
      );

      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          transaction(db, tx =>
            redeemTaxQuote(tx, {
              quoteId: quote.id,
              userId: null,
              customerEmail: email,
              itemType: 'TOPIC',
              itemId: TEST_TOPIC_ID,
              cataloguePricePaise: quote.taxableAmountPaise,
              customerType: 'INDIVIDUAL',
              billingStateCode: '27',
              pinCode: '400020',
              gstin: null,
              now: new Date(PAID_AT.getTime() + 60_000),
            }),
          ),
        ),
      );

      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      for (const result of results) {
        if (result.status === 'rejected') {
          assert.ok(
            result.reason instanceof ApiError &&
              result.reason.code === ERROR_CODE.taxQuoteAlreadyUsed,
          );
        }
      }
    });

    it('rolls back a failed issuance completely, leaving no gap in the numbers', async () => {
      const before = await invoiceNumbers();
      const [payment] = await freshPaidPayments(1);

      await db.exec(`
      CREATE FUNCTION fail_snapshot_insert() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'injected snapshot failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER inject_snapshot_failure BEFORE INSERT ON payment_tax_snapshots
      FOR EACH ROW EXECUTE FUNCTION fail_snapshot_insert();
    `);
      try {
        const failed = await reconcileMissingInvoices(context());
        assert.equal(failed.failed, 1);
        assert.deepEqual(await invoiceNumbers(), before);
      } finally {
        await db.exec(`
        DROP TRIGGER inject_snapshot_failure ON payment_tax_snapshots;
        DROP FUNCTION fail_snapshot_insert();
      `);
      }

      // A failed payment is retried after its backoff (an hour)
      await reconcileMissingInvoices({
        ...context(),
        now: () => new Date(LATER.getTime() + 61 * 60 * 1000),
      });
      const next = `INV/26-27/${String(before.length + 1).padStart(6, '0')}`;
      assert.equal(
        (await findInvoiceByPaymentId(db, payment.paymentId))?.invoiceNumber,
        next,
      );
    });

    it('records a capture even while invoices cannot be written', async () => {
      await db.exec(`
      CREATE FUNCTION fail_invoice_insert() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'injected invoice failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER inject_invoice_failure BEFORE INSERT ON invoices
      FOR EACH ROW EXECUTE FUNCTION fail_invoice_insert();
    `);
      try {
        const payment = await createQuotedPayment(db, { at: PAID_AT });
        const captured = await captureQuotedPayment(db, payment, PAID_AT);
        assert.equal(captured.outcome, 'APPLIED');
        const row = await db.get('SELECT status FROM payments WHERE id = $1', [
          payment.paymentId,
        ]);
        assert.equal(row?.status, 'PAID');
        const run = await reconcileMissingInvoices(context());
        assert.equal(run.failed, 1);
      } finally {
        await db.exec(`
        DROP TRIGGER inject_invoice_failure ON invoices;
        DROP FUNCTION fail_invoice_insert();
      `);
      }
    });

    it('enforces immutability and the snapshot requirement in PostgreSQL itself', async () => {
      await assert.rejects(
        db.query(`UPDATE invoices SET invoice_number = 'EDITED'`),
        /immutable/,
      );
      await assert.rejects(db.query('DELETE FROM invoices'), /immutable/);
      await assert.rejects(
        db.query(`UPDATE invoice_sequences SET current_sequence = 1`),
        /can only advance by one/,
      );
    });
  },
);
