import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { transaction } from '../../../db/client.js';
import { createFakeRazorpay } from '../../../test/fakeRazorpay.js';
import {
  captureQuotedPayment,
  countRows,
  createQuotedPayment,
  recordTestApproval,
  TEST_APPROVAL_EFFECTIVE_FROM,
} from '../../../test/invoicing.js';
import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
  testStudent,
} from '../../../test/testServer.js';
import { SUPPLIER_CONFIG } from '../gst/gst.config.js';
import {
  allocateInvoiceNumber,
  deriveIndianFiscalYear,
  findInvoiceByPaymentId,
  insertInvoice,
} from './invoices.repository.js';
import {
  INVOICE_INELIGIBLE,
  InvoiceIneligibleError,
  issueInvoice,
  reconcileMissingInvoices,
} from './invoices.service.js';
import {
  CURRENT_TAX_CONFIGURATION,
  getInvoicingActivation,
  INVOICING_INACTIVE_REASON,
} from './invoicing.activation.js';
import {
  findTaxSnapshotByPaymentId,
  insertTaxSnapshot,
} from './taxSnapshots.repository.js';

type TestServer = Awaited<ReturnType<typeof startTestServer>>;

let PAID_AT = new Date(Math.floor(Date.now() / 1000) * 1000);
let LATER = new Date(PAID_AT.getTime() + 60_000);

const refreshTimeline = () => {
  PAID_AT = new Date(Math.floor(Date.now() / 1000) * 1000);
  LATER = new Date(PAID_AT.getTime() + 60_000);
};

const contextOf = (server: TestServer, at?: Date) => ({
  db: server.db,
  config: server.config,
  now: () => at ?? LATER,
});

const paidQuotedPayment = async (
  server: TestServer,
  options?: Parameters<typeof createQuotedPayment>[1],
) => {
  const at = options?.at ?? PAID_AT;
  const payment = await createQuotedPayment(server.db, { ...options, at });
  const captured = await captureQuotedPayment(server.db, payment, at);
  assert.equal(captured.outcome, 'APPLIED');
  return payment;
};

const invoiceNumbers = async (server: TestServer) =>
  (
    await server.db.all<{ invoice_number: string }>(
      'SELECT invoice_number FROM invoices ORDER BY fiscal_year, sequence_number',
    )
  ).map(row => row.invoice_number);

describe('Indian financial year (H3)', () => {
  it('uses the calendar date in India, not in UTC', () => {
    // The audit's reproduction: 19:00 UTC on 31 March is 00:30 on 1 April in India
    assert.equal(
      deriveIndianFiscalYear(new Date('2027-03-31T19:00:00Z')),
      '27-28',
    );
    // The boundary is midnight IST, 18:30 UTC
    assert.equal(
      deriveIndianFiscalYear(new Date('2027-03-31T18:29:59.999Z')),
      '26-27',
    );
    assert.equal(
      deriveIndianFiscalYear(new Date('2027-03-31T18:30:00.000Z')),
      '27-28',
    );
    assert.equal(
      deriveIndianFiscalYear(new Date('2026-03-31T18:30:00.000Z')),
      '26-27',
    );
    // Ordinary dates either side
    assert.equal(
      deriveIndianFiscalYear(new Date('2026-11-16T12:00:00Z')),
      '26-27',
    );
    assert.equal(
      deriveIndianFiscalYear(new Date('2027-01-01T00:00:00+05:30')),
      '26-27',
    );
    assert.equal(
      deriveIndianFiscalYear(new Date('2027-04-15T10:00:00Z')),
      '27-28',
    );
  });
});

describe('Invoice number sequence', () => {
  let server: TestServer;
  before(async () => {
    server = await startTestServer();
  });
  after(async () => {
    await server.close();
  });

  it('allocates contiguous 16-character numbers and restarts each financial year', async () => {
    const first = await allocateInvoiceNumber(
      server.db,
      new Date('2026-11-16T10:00:00Z'),
    );
    const second = await allocateInvoiceNumber(
      server.db,
      new Date('2026-11-16T10:00:00Z'),
    );
    assert.equal(first.invoiceNumber, 'INV/26-27/000001');
    assert.equal(second.invoiceNumber, 'INV/26-27/000002');
    assert.equal(first.invoiceNumber.length, 16);

    const concurrent = await Promise.all(
      Array.from({ length: 10 }, () =>
        allocateInvoiceNumber(server.db, new Date('2026-11-16T10:00:00Z')),
      ),
    );
    const sequences = concurrent
      .map(a => a.sequenceNumber)
      .sort((a, b) => a - b);
    assert.deepEqual(sequences, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const nextYear = await allocateInvoiceNumber(
      server.db,
      new Date('2027-04-15T10:00:00Z'),
    );
    assert.equal(nextYear.invoiceNumber, 'INV/27-28/000001');
  });

  it('only lets the sequence move forward by one (H5)', async () => {
    await assert.rejects(
      server.db.query(
        `UPDATE invoice_sequences SET current_sequence = current_sequence - 1
         WHERE fiscal_year = '26-27'`,
      ),
      /can only advance by one/,
    );
    await assert.rejects(
      server.db.query(
        `UPDATE invoice_sequences SET current_sequence = current_sequence + 5
         WHERE fiscal_year = '26-27'`,
      ),
      /can only advance by one/,
    );
    await assert.rejects(
      server.db.query(
        `DELETE FROM invoice_sequences WHERE fiscal_year = '26-27'`,
      ),
      /cannot be deleted/,
    );
    await assert.rejects(
      server.db.query(
        `INSERT INTO invoice_sequences (fiscal_year, current_sequence) VALUES ('28-29', 40)`,
      ),
      /must start at 1/,
    );
  });
});

describe('Invoicing activation gate (C2)', () => {
  it('is off by default, even with an approval recorded', async () => {
    const server = await startTestServer();
    try {
      assert.equal(server.config.invoicingEnabled, false);
      await recordTestApproval(server.db);
      const payment = await paidQuotedPayment(server);

      const result = await reconcileMissingInvoices(contextOf(server));

      assert.equal(result.active, false);
      assert.equal(result.inactiveReason, INVOICING_INACTIVE_REASON.disabled);
      assert.equal(result.processed, 0);
      assert.equal(
        await findInvoiceByPaymentId(server.db, payment.paymentId),
        null,
      );
      assert.equal(await countRows(server.db, 'invoices'), 0);
    } finally {
      await server.close();
    }
  });

  it('needs a recorded, effective approval of exactly the current configuration', async () => {
    const server = await startTestServer({ invoicingEnabled: true });
    try {
      const at = LATER;
      const reasonAt = async (when = at) => {
        const activation = await getInvoicingActivation(
          server.db,
          server.config,
          when,
        );
        return activation.active ? 'ACTIVE' : activation.reason;
      };

      // Nothing recorded
      assert.equal(await reasonAt(), INVOICING_INACTIVE_REASON.noApproval);

      // An approval of a different rate does not approve this one
      await recordTestApproval(server.db, { gstRateBasisPoints: 1200 });
      assert.equal(await reasonAt(), INVOICING_INACTIVE_REASON.noApproval);

      // Effective before the GST registration (simulated with mock client since database trigger blocks backdated insert)
      const beforeRegMockDb = {
        ...server.db,
        get: async () => ({
          id: 'test-approval',
          status: 'APPROVED',
          supplier_gstin: CURRENT_TAX_CONFIGURATION.supplierGstin,
          sac_code: CURRENT_TAX_CONFIGURATION.sacCode,
          gst_rate_basis_points: CURRENT_TAX_CONFIGURATION.gstRateBasisPoints,
          pricing_mode: CURRENT_TAX_CONFIGURATION.pricingMode,
          calculation_version: CURRENT_TAX_CONFIGURATION.calculationVersion,
          rounding_policy: CURRENT_TAX_CONFIGURATION.roundingPolicy,
          effective_from: '2026-06-01T00:00:00.000Z',
          approved_by: 'Test CA',
          approval_reference: 'REF',
          recorded_by: 'admin',
          recorded_at: '2026-06-01T00:00:00.000Z',
        }),
      };
      const beforeRegActivation = await getInvoicingActivation(
        beforeRegMockDb as unknown as typeof server.db,
        server.config,
        at,
      );
      assert.equal(
        beforeRegActivation.active ? 'ACTIVE' : beforeRegActivation.reason,
        INVOICING_INACTIVE_REASON.beforeRegistration,
      );

      // Approved, but not yet in effect
      await recordTestApproval(server.db, {
        effectiveFrom: new Date(
          LATER.getTime() + 24 * 3600 * 1000,
        ).toISOString(),
      });
      assert.equal(await reasonAt(), INVOICING_INACTIVE_REASON.notYetEffective);

      // In effect
      await recordTestApproval(server.db);
      assert.equal(await reasonAt(), 'ACTIVE');

      // A later revocation switches it off again
      await recordTestApproval(server.db, { status: 'REVOKED' });
      assert.equal(await reasonAt(), INVOICING_INACTIVE_REASON.revoked);

      // The order is the database's, never the caller's timestamps: an
      // approval recorded after the revocation with an older time, or two
      // records with the same time, are decided by insertion order
      await recordTestApproval(server.db, {
        recordedAt: '2026-10-01T00:00:00.000Z',
      });
      assert.equal(await reasonAt(), 'ACTIVE');
      const sameTime = '2026-10-31T17:30:00.000Z';
      await recordTestApproval(server.db, { recordedAt: sameTime });
      await recordTestApproval(server.db, {
        status: 'REVOKED',
        recordedAt: sameTime,
        id: '00000000-0000-0000-0000-000000000000',
      });
      assert.equal(await reasonAt(), INVOICING_INACTIVE_REASON.revoked);

      // The database refuses an approval effective before it was recorded
      await assert.rejects(
        recordTestApproval(server.db, {
          effectiveFrom: '2026-07-01T00:00:00.000Z',
          recordedAt: '2026-11-01T00:00:00.000Z',
        }),
        /cannot take effect before it is recorded/,
      );

      // Approval records cannot be edited or deleted
      await assert.rejects(
        server.db.query(
          `UPDATE tax_configuration_approvals SET status = 'APPROVED'`,
        ),
        /immutable/,
      );
      await assert.rejects(
        server.db.query('DELETE FROM tax_configuration_approvals'),
        /immutable/,
      );
    } finally {
      await server.close();
    }
  });
});

describe('Audit reproduction: checkout without GST never gets a tax invoice (C1, C2)', () => {
  const SECRET = 'whsec_invoice_regression';
  let server: TestServer;

  before(async () => {
    refreshTimeline();
    server = await startTestServer({
      paymentGateway: createFakeRazorpay(),
      razorpayWebhookSecret: SECRET,
      invoicingEnabled: true,
      now: () => LATER,
    });
    // Even with both switches on
    await recordTestApproval(server.db);
  });
  after(async () => {
    await server.close();
  });

  it('records the capture and issues no invoice for the catalogue price collected', async () => {
    const checkout = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: 'batch_accountancy_rectification_of_errors_class_11_b2',
        customerType: 'INDIVIDUAL',
        fullName: 'Regression Buyer',
        email: 'regression.buyer@example.com',
        mobile: '+91 98765 43210',
        addressLine1: '12 Civil Lines',
        city: 'Pune',
        state: 'Maharashtra',
        pinCode: '411001',
      });
    assert.equal(checkout.status, 201);
    const { paymentId, provider, amount } = checkout.body.checkout;

    const body = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_regression_1',
            order_id: provider.orderId,
            amount: amount.amountPaise,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const signature = createHmac('sha256', SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
    const hook = await server
      .createClient()
      .request('POST', '/api/payments/webhook', body, {
        'X-Razorpay-Signature': signature,
        'X-Razorpay-Event-Id': 'evt_regression_1',
      });
    assert.equal(hook.status, 200);

    const payment = await server.db.get(
      'SELECT status, amount_paise, tax_status FROM payments WHERE id = $1',
      [paymentId],
    );
    assert.equal(payment?.status, 'PAID');
    assert.equal(payment?.tax_status, 'PENDING_CONFIGURATION');

    const result = await reconcileMissingInvoices(contextOf(server));
    assert.equal(result.active, true);
    assert.equal(result.processed, 0);
    assert.equal(await countRows(server.db, 'invoices'), 0);
    assert.equal(await countRows(server.db, 'payment_tax_snapshots'), 0);

    // Asked directly, the service refuses rather than adding GST on top
    const activation = await getInvoicingActivation(
      server.db,
      server.config,
      LATER,
    );
    assert.ok(activation.active);
    await assert.rejects(
      issueInvoice(contextOf(server), activation.approval, paymentId),
      (error: unknown) =>
        error instanceof InvoiceIneligibleError &&
        error.reason === INVOICE_INELIGIBLE.taxNotCollected,
    );
    assert.equal(await countRows(server.db, 'invoices'), 0);
  });

  it('refuses an invoice whose total differs from the amount captured', async () => {
    // A quote for the GST-inclusive total, but only the catalogue price charged
    const quoted = await createQuotedPayment(server.db, {
      at: PAID_AT,
      chargedPaise: 12900,
    });
    await captureQuotedPayment(server.db, quoted, PAID_AT);
    assert.notEqual(quoted.quote.totalAmountPaise, 12900);

    const result = await reconcileMissingInvoices(contextOf(server));
    assert.equal(result.failed, 1);
    assert.equal(
      await findInvoiceByPaymentId(server.db, quoted.paymentId),
      null,
    );

    // And the database itself refuses such a snapshot
    await assert.rejects(
      insertTaxSnapshot(server.db, {
        id: randomUUID(),
        paymentId: quoted.paymentId,
        invoiceId: null,
        quoteId: quoted.quote.id,
        supplierLegalName: SUPPLIER_CONFIG.legalName,
        supplierGstin: SUPPLIER_CONFIG.gstin,
        supplierStateCode: SUPPLIER_CONFIG.stateCode,
        supplierAddress: SUPPLIER_CONFIG.registeredAddress,
        recipientName: 'Invoice Test Buyer',
        recipientEmail: 'x@example.com',
        recipientMobile: '+91 98765 12345',
        recipientCustomerType: 'INDIVIDUAL',
        recipientAddressLine1: '42 Worli Seaface',
        recipientAddressLine2: null,
        recipientCity: 'Mumbai',
        recipientState: 'Maharashtra',
        recipientStateCode: '27',
        recipientPinCode: '400030',
        recipientBusinessName: null,
        recipientGstin: null,
        recipientGstinStateCode: null,
        placeOfSupplyStateCode: '27',
        supplyType: 'INTER_STATE',
        sacCode: quoted.quote.sacCode,
        pricingMode: 'EXCLUSIVE',
        taxableAmountPaise: quoted.quote.taxableAmountPaise,
        gstRateBasisPoints: 1800,
        cgstRateBasisPoints: 0,
        cgstPaise: 0,
        sgstRateBasisPoints: 0,
        sgstPaise: 0,
        igstRateBasisPoints: 1800,
        igstPaise: quoted.quote.igstPaise,
        totalGstPaise: quoted.quote.totalGstPaise,
        totalAmountPaise: quoted.quote.totalAmountPaise,
        calculationVersion: quoted.quote.calculationVersion,
        roundingPolicy: quoted.quote.roundingPolicy,
        timestamp: LATER.toISOString(),
      }),
      /differs from the 12900 paise collected/,
    );
  });
});

describe('Issuing an invoice for collected GST', () => {
  let server: TestServer;
  before(async () => {
    refreshTimeline();
    server = await startTestServer({ invoicingEnabled: true });
    await recordTestApproval(server.db);
  });
  after(async () => {
    await server.close();
  });

  it('issues the quoted amounts, which equal the amount captured, once', async () => {
    const payment = await paidQuotedPayment(server);

    const result = await reconcileMissingInvoices(contextOf(server));
    assert.deepEqual(result, {
      active: true,
      inactiveReason: null,
      processed: 1,
      failed: 0,
      deferred: 0,
      incompleteInvoices: 0,
      inconsistentInvoices: 0,
    });

    const invoice = await findInvoiceByPaymentId(server.db, payment.paymentId);
    const snapshot = await findTaxSnapshotByPaymentId(
      server.db,
      payment.paymentId,
    );
    assert.equal(invoice?.invoiceNumber, 'INV/26-27/000001');
    assert.equal(invoice?.timeOfSupply, PAID_AT.toISOString());
    assert.ok(snapshot);
    assert.equal(snapshot.invoiceId, invoice?.id);
    assert.equal(snapshot.quoteId, payment.quote.id);
    assert.equal(snapshot.totalAmountPaise, payment.amountPaise);
    assert.equal(snapshot.taxableAmountPaise, payment.quote.taxableAmountPaise);
    assert.equal(snapshot.igstPaise, payment.quote.igstPaise);
    assert.equal(snapshot.igstRateBasisPoints, 1800);
    assert.equal(snapshot.supplyType, 'INTER_STATE');
    assert.equal(snapshot.recipientCity, 'Mumbai');
    assert.equal(snapshot.recipientPinCode, '400030');
    assert.equal(snapshot.supplierGstin, SUPPLIER_CONFIG.gstin);

    // Running again changes nothing
    const rerun = await reconcileMissingInvoices(contextOf(server));
    assert.equal(rerun.processed, 0);
    assert.deepEqual(await invoiceNumbers(server), ['INV/26-27/000001']);
  });

  it('issues no invoice for a payment exception that is open, or resolved without a seat (owner decision)', async () => {
    const admin = await server.db.get<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [TEST_SUPER_ADMIN_EMAIL],
    );
    const withException = async () => {
      const payment = await paidQuotedPayment(server);
      await server.db.query(
        `INSERT INTO payment_exceptions (id, payment_id, kind, details, created_at)
         VALUES ($1, $2, 'CAPTURED_FOR_FULL_BATCH', '{}'::jsonb, $3)`,
        [
          `pex_test_${payment.paymentId}`,
          payment.paymentId,
          PAID_AT.toISOString(),
        ],
      );
      return payment;
    };
    const resolve = (paymentId: string, resolution: string) =>
      server.db.query(
        `UPDATE payment_exceptions SET status = 'RESOLVED', resolution = $2,
           resolution_note = 'Decided by staff', resolved_by = $3, resolved_at = $4
         WHERE id = $1`,
        [`pex_test_${paymentId}`, resolution, admin?.id, LATER.toISOString()],
      );

    const refunded = await withException();
    const seated = await withException();
    await reconcileMissingInvoices(contextOf(server));
    assert.equal(
      await findInvoiceByPaymentId(server.db, refunded.paymentId),
      null,
    );
    assert.equal(
      await findInvoiceByPaymentId(server.db, seated.paymentId),
      null,
    );

    // Resolved: invoiced only when a seat was supplied
    await resolve(refunded.paymentId, 'REFUNDED');
    await resolve(seated.paymentId, 'SEAT_CONFIRMED');
    await reconcileMissingInvoices(contextOf(server));
    assert.equal(
      await findInvoiceByPaymentId(server.db, refunded.paymentId),
      null,
    );
    assert.ok(await findInvoiceByPaymentId(server.db, seated.paymentId));
  });

  it('splits CGST and SGST for a buyer in Rajasthan', async () => {
    const payment = await paidQuotedPayment(server, {
      at: PAID_AT,
      billing: { state: 'Rajasthan', pinCode: '302001', billingCity: 'Jaipur' },
    });
    await reconcileMissingInvoices(contextOf(server));
    const snapshot = await findTaxSnapshotByPaymentId(
      server.db,
      payment.paymentId,
    );
    assert.equal(snapshot?.supplyType, 'INTRA_STATE');
    assert.equal(snapshot?.cgstRateBasisPoints, 900);
    assert.equal(snapshot?.sgstRateBasisPoints, 900);
    assert.equal(snapshot?.igstPaise, 0);
    assert.equal(snapshot?.totalAmountPaise, payment.amountPaise);
  });

  it('never invoices a payment made before the approval took effect (no backdating)', async () => {
    const early = new Date(
      new Date(TEST_APPROVAL_EFFECTIVE_FROM).getTime() - 24 * 3600 * 1000,
    );
    const payment = await paidQuotedPayment(server, { at: early });
    assert.ok(early < new Date(TEST_APPROVAL_EFFECTIVE_FROM));

    // The job never picks it up...
    const result = await reconcileMissingInvoices(contextOf(server));
    assert.equal(result.failed, 0);
    assert.equal(
      await findInvoiceByPaymentId(server.db, payment.paymentId),
      null,
    );

    // ...and the service refuses it if asked directly
    const activation = await getInvoicingActivation(
      server.db,
      server.config,
      LATER,
    );
    assert.ok(activation.active);
    await assert.rejects(
      issueInvoice(contextOf(server), activation.approval, payment.paymentId),
      (error: unknown) =>
        error instanceof InvoiceIneligibleError &&
        error.reason === INVOICE_INELIGIBLE.paidBeforeApproval,
    );
    assert.equal(
      await findInvoiceByPaymentId(server.db, payment.paymentId),
      null,
    );
  });

  it('rejects incomplete billing details instead of inventing them (H2)', async () => {
    const payment = await paidQuotedPayment(server, {
      at: PAID_AT,
      billing: { billingCity: ' ' },
    });
    const before = await invoiceNumbers(server);

    const result = await reconcileMissingInvoices(contextOf(server));
    assert.equal(result.failed, 1);
    assert.equal(
      await findInvoiceByPaymentId(server.db, payment.paymentId),
      null,
    );
    // No number was used up by the refusal
    assert.deepEqual(await invoiceNumbers(server), before);

    const activation = await getInvoicingActivation(
      server.db,
      server.config,
      LATER,
    );
    assert.ok(activation.active);
    await assert.rejects(
      issueInvoice(contextOf(server), activation.approval, payment.paymentId),
      (error: unknown) =>
        error instanceof InvoiceIneligibleError &&
        error.reason === INVOICE_INELIGIBLE.incompleteBilling &&
        /billing_city/.test(error.message),
    );
  });

  it('keeps issued invoices and snapshots immutable (H1)', async () => {
    const [number] = await invoiceNumbers(server);
    await assert.rejects(
      server.db.query(
        `UPDATE invoices SET invoice_number = 'EDITED' WHERE invoice_number = $1`,
        [number],
      ),
      /Financial record in invoices is immutable/,
    );
    await assert.rejects(
      server.db.query(`UPDATE invoices SET status = 'CANCELLED'`),
      /Financial record in invoices is immutable/,
    );
    await assert.rejects(
      server.db.query('DELETE FROM invoices WHERE invoice_number = $1', [
        number,
      ]),
      /Financial record in invoices is immutable/,
    );
    await assert.rejects(
      server.db.query(
        'UPDATE payment_tax_snapshots SET taxable_amount_paise = 999',
      ),
      /Financial record in payment_tax_snapshots is immutable/,
    );
    await assert.rejects(
      server.db.query('DELETE FROM payment_tax_snapshots'),
      /Financial record in payment_tax_snapshots is immutable/,
    );
  });
});

describe('Atomic issuance (C3, H5)', () => {
  let server: TestServer;
  before(async () => {
    refreshTimeline();
    server = await startTestServer({ invoicingEnabled: true });
    await recordTestApproval(server.db);
  });
  after(async () => {
    await server.close();
  });

  it('rolls back the number and the invoice when the snapshot insert fails, then issues with no gap', async () => {
    const payment = await paidQuotedPayment(server);

    await server.db.exec(`
      CREATE FUNCTION fail_snapshot_insert() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'injected snapshot failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER inject_snapshot_failure BEFORE INSERT ON payment_tax_snapshots
      FOR EACH ROW EXECUTE FUNCTION fail_snapshot_insert();
    `);
    const failedRun = await reconcileMissingInvoices(contextOf(server));
    assert.equal(failedRun.failed, 1);
    assert.equal(await countRows(server.db, 'invoices'), 0);
    assert.equal(await countRows(server.db, 'invoice_sequences'), 0);

    await server.db.exec(`
      DROP TRIGGER inject_snapshot_failure ON payment_tax_snapshots;
      DROP FUNCTION fail_snapshot_insert();
    `);
    // A failed payment waits before its retry (an hour after one failure)
    assert.equal(failedRun.deferred, 1);
    const tooSoon = await reconcileMissingInvoices(contextOf(server));
    assert.equal(tooSoon.processed, 0);
    const repairRun = await reconcileMissingInvoices(
      contextOf(server, new Date(LATER.getTime() + 61 * 60 * 1000)),
    );
    assert.equal(repairRun.processed, 1);
    assert.equal(repairRun.incompleteInvoices, 0);
    const invoice = await findInvoiceByPaymentId(server.db, payment.paymentId);
    assert.equal(invoice?.invoiceNumber, 'INV/26-27/000001');
  });

  it('refuses to commit an invoice without its snapshot', async () => {
    const payment = await paidQuotedPayment(server);
    await assert.rejects(
      transaction(server.db, async tx => {
        const allocation = await allocateInvoiceNumber(tx, LATER);
        await insertInvoice(tx, {
          id: randomUUID(),
          invoiceNumber: allocation.invoiceNumber,
          paymentId: payment.paymentId,
          fiscalYear: allocation.fiscalYear,
          sequenceNumber: allocation.sequenceNumber,
          timeOfSupply: PAID_AT.toISOString(),
          issuedAt: LATER.toISOString(),
          status: 'ISSUED',
          timestamp: LATER.toISOString(),
        });
      }),
      /has no tax snapshot/,
    );
    assert.equal(
      await findInvoiceByPaymentId(server.db, payment.paymentId),
      null,
    );
  });

  it('refuses an invoice number that was not just allocated', async () => {
    const payment = await paidQuotedPayment(server);
    await assert.rejects(
      insertInvoice(server.db, {
        id: randomUUID(),
        invoiceNumber: 'INV/26-27/000099',
        paymentId: payment.paymentId,
        fiscalYear: '26-27',
        sequenceNumber: 99,
        timeOfSupply: PAID_AT.toISOString(),
        issuedAt: LATER.toISOString(),
        status: 'ISSUED',
        timestamp: LATER.toISOString(),
      }),
      /does not take the number just allocated/,
    );
  });

  it('completes an invoice left without a snapshot by older code, and reports one it cannot', async () => {
    // Recreate what the pre-018 code could leave behind (an invoice row
    // with no snapshot), bypassing the triggers that now prevent it
    const leaveIncomplete = (paymentId: string) =>
      transaction(server.db, async tx => {
        await tx.exec('SET LOCAL session_replication_role = replica');
        const allocation = await allocateInvoiceNumber(tx, LATER);
        await insertInvoice(tx, {
          id: randomUUID(),
          invoiceNumber: allocation.invoiceNumber,
          paymentId,
          fiscalYear: allocation.fiscalYear,
          sequenceNumber: allocation.sequenceNumber,
          timeOfSupply: PAID_AT.toISOString(),
          issuedAt: LATER.toISOString(),
          status: 'ISSUED',
          timestamp: LATER.toISOString(),
        });
        return allocation.invoiceNumber;
      });

    // Settle anything earlier tests left due, so this test sees only its own
    await reconcileMissingInvoices(contextOf(server));

    const eligible = await paidQuotedPayment(server);
    const eligibleNumber = await leaveIncomplete(eligible.paymentId);

    const ineligible = await createQuotedPayment(server.db, { at: PAID_AT });
    await server.db.query(
      `UPDATE payments SET status = 'PAID', paid_at = $2 WHERE id = $1`,
      [ineligible.paymentId, new Date('2026-10-01T00:00:00Z').toISOString()],
    );
    const ineligibleNumber = await leaveIncomplete(ineligible.paymentId);

    const result = await reconcileMissingInvoices(contextOf(server));
    assert.equal(result.processed, 1);
    assert.equal(result.incompleteInvoices, 1);

    const repaired = await findInvoiceByPaymentId(
      server.db,
      eligible.paymentId,
    );
    const snapshot = await findTaxSnapshotByPaymentId(
      server.db,
      eligible.paymentId,
    );
    assert.equal(repaired?.invoiceNumber, eligibleNumber);
    assert.equal(snapshot?.invoiceId, repaired?.id);

    // The other stays for a person to review; nothing is deleted or invented
    const orphan = await findInvoiceByPaymentId(
      server.db,
      ineligible.paymentId,
    );
    assert.equal(orphan?.invoiceNumber, ineligibleNumber);
    assert.equal(
      await findTaxSnapshotByPaymentId(server.db, ineligible.paymentId),
      null,
    );
  });
});

describe('Capture never depends on invoicing (C4)', () => {
  let server: TestServer;
  before(async () => {
    refreshTimeline();
    server = await startTestServer({ invoicingEnabled: true });
    await recordTestApproval(server.db);
  });
  after(async () => {
    await server.close();
  });

  it('records the capture and confirms the seat even when invoices cannot be written', async () => {
    await server.db.exec(`
      CREATE FUNCTION fail_invoice_insert() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'injected invoice failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER inject_invoice_failure BEFORE INSERT ON invoices
      FOR EACH ROW EXECUTE FUNCTION fail_invoice_insert();
    `);

    const payment = await createQuotedPayment(server.db, { at: PAID_AT });
    const captured = await captureQuotedPayment(server.db, payment, PAID_AT);
    assert.equal(captured.stored, true);
    assert.equal(captured.outcome, 'APPLIED');

    const row = await server.db.get(
      `SELECT p.status, p.paid_at, r.status AS seat
       FROM payments p JOIN pre_registrations r ON r.id = p.pre_registration_id
       WHERE p.id = $1`,
      [payment.paymentId],
    );
    assert.equal(row?.status, 'PAID');
    assert.ok(row?.paid_at);
    assert.equal(row?.seat, 'CONFIRMED');
    assert.equal(await countRows(server.db, 'payment_events'), 1);

    const failedRun = await reconcileMissingInvoices(contextOf(server));
    assert.equal(failedRun.failed, 1);
    const stillPaid = await server.db.get(
      'SELECT status FROM payments WHERE id = $1',
      [payment.paymentId],
    );
    assert.equal(stillPaid?.status, 'PAID');

    await server.db.exec(`
      DROP TRIGGER inject_invoice_failure ON invoices;
      DROP FUNCTION fail_invoice_insert();
    `);
    const recovered = await reconcileMissingInvoices(
      contextOf(server, new Date(LATER.getTime() + 61 * 60 * 1000)),
    );
    assert.equal(recovered.processed, 1);
    assert.equal(
      (await findInvoiceByPaymentId(server.db, payment.paymentId))
        ?.invoiceNumber,
      'INV/26-27/000001',
    );
  });
});

describe('Who can read an invoice', () => {
  const FINANCE_EMAIL = 'finance.invoices@sridha.test';
  const OPERATIONS_EMAIL = 'operations.invoices@sridha.test';
  let server: TestServer;
  let paymentId: string;

  before(async () => {
    refreshTimeline();
    server = await startTestServer({
      invoicingEnabled: true,
      financeAdminEmails: [FINANCE_EMAIL],
      operationsAdminEmails: [OPERATIONS_EMAIL],
    });
    await recordTestApproval(server.db);
    paymentId = (await paidQuotedPayment(server)).paymentId;
    await reconcileMissingInvoices(contextOf(server));
  });
  after(async () => {
    await server.close();
  });

  it('shows the invoice, with billing details, to finance staff only', async () => {
    const path = `/api/finance/invoices/${paymentId}`;

    const anonymous = await server.createClient().request('GET', path);
    assert.equal(anonymous.status, 401);

    const student = server.createClient();
    await server.signUpStudent(testStudent(), student);
    assert.equal((await student.request('GET', path)).status, 403);

    const operations = await server.signInStaff(OPERATIONS_EMAIL);
    assert.equal((await operations.request('GET', path)).status, 403);

    const finance = await server.signInStaff(FINANCE_EMAIL);
    const allowed = await finance.request('GET', path);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.invoice.invoiceNumber, 'INV/26-27/000001');
    assert.equal(allowed.body.snapshot.paymentId, paymentId);

    const missing = await finance.request(
      'GET',
      '/api/finance/invoices/no-such-payment',
    );
    assert.equal(missing.status, 404);
  });
});

describe('Recording a tax approval (audited, super admin only)', () => {
  const FINANCE_EMAIL = 'finance.approvals@sridha.test';
  let server: TestServer;

  before(async () => {
    refreshTimeline();
    server = await startTestServer({
      invoicingEnabled: true,
      financeAdminEmails: [FINANCE_EMAIL],
      now: () => LATER,
    });
  });
  after(async () => {
    await server.close();
  });

  it('records approvals and revocations with the actor, and refuses backdating', async () => {
    const body = {
      status: 'APPROVED',
      effectiveFrom: new Date(LATER.getTime() + 24 * 3600 * 1000).toISOString(),
      approvedBy: 'Test CA firm',
      approvalReference: 'Letter TEST-1',
    };

    const anonymous = await server
      .createClient()
      .request('POST', '/api/finance/tax-approvals', body);
    assert.equal(anonymous.status, 401);
    const finance = await server.signInStaff(FINANCE_EMAIL);
    assert.equal(
      (await finance.request('POST', '/api/finance/tax-approvals', body))
        .status,
      403,
    );
    // Finance staff may see the state, not change it
    const seen = await finance.request('GET', '/api/finance/tax-approvals');
    assert.equal(seen.status, 200);
    assert.equal(seen.body.activation.active, false);

    const admin = await server.signInStaff(TEST_SUPER_ADMIN_EMAIL);

    // Cannot reach back over past payments
    const backdated = await admin.request(
      'POST',
      '/api/finance/tax-approvals',
      {
        ...body,
        effectiveFrom: '2026-07-01T00:00:00+05:30',
      },
    );
    assert.equal(backdated.status, 409);
    assert.equal(backdated.body.code, 'TAX_APPROVAL_INVALID');
    // Rates come from code, never the request
    const withRate = await admin.request('POST', '/api/finance/tax-approvals', {
      ...body,
      gstRateBasisPoints: 500,
    });
    assert.equal(withRate.status, 400);
    // Nothing to revoke yet
    const earlyRevoke = await admin.request(
      'POST',
      '/api/finance/tax-approvals',
      {
        status: 'REVOKED',
        approvedBy: 'Test CA firm',
        approvalReference: 'Letter TEST-0',
      },
    );
    assert.equal(earlyRevoke.status, 409);

    const recorded = await admin.request(
      'POST',
      '/api/finance/tax-approvals',
      body,
    );
    assert.equal(recorded.status, 201);
    assert.equal(recorded.body.approval.gstRateBasisPoints, 1800);
    assert.equal(recorded.body.approval.sacCode, '999293');
    assert.equal(recorded.body.activation.active, false);
    assert.equal(
      recorded.body.activation.inactiveReason,
      INVOICING_INACTIVE_REASON.notYetEffective,
    );

    const revoked = await admin.request('POST', '/api/finance/tax-approvals', {
      status: 'REVOKED',
      approvedBy: 'Test CA firm',
      approvalReference: 'Letter TEST-2 withdrawing TEST-1',
    });
    assert.equal(revoked.status, 201);
    assert.equal(
      revoked.body.activation.inactiveReason,
      INVOICING_INACTIVE_REASON.revoked,
    );

    const audit = await server.db.all<{
      actor_role: string;
      details: Record<string, unknown>;
    }>(
      `SELECT actor_role, details FROM finance_audit_log
       WHERE action = 'TAX_APPROVAL_RECORDED' ORDER BY id`,
    );
    assert.deepEqual(
      audit.map(entry => [entry.actor_role, entry.details.status]),
      [
        ['SUPER_ADMIN', 'APPROVED'],
        ['SUPER_ADMIN', 'REVOKED'],
      ],
    );
  });
});

describe('Invoice job resilience', () => {
  let server: TestServer;
  before(async () => {
    refreshTimeline();
    server = await startTestServer({ invoicingEnabled: true });
    await recordTestApproval(server.db);
  });
  after(async () => {
    await server.close();
  });

  it('keeps failing payments from blocking newer ones, and counts only new invoices', async () => {
    // Two older payments that cannot be invoiced, then a good one
    const bad = [
      await paidQuotedPayment(server, {
        at: new Date(PAID_AT.getTime() - 2000),
        billing: { billingCity: ' ' },
      }),
      await paidQuotedPayment(server, {
        at: new Date(PAID_AT.getTime() - 1000),
        billing: { billingCity: ' ' },
      }),
    ];
    const good = await paidQuotedPayment(server);

    const first = await reconcileMissingInvoices(contextOf(server), {
      limit: 2,
    });
    assert.equal(first.failed, 2);
    assert.equal(first.deferred, 2);

    const second = await reconcileMissingInvoices(contextOf(server), {
      limit: 2,
    });
    assert.equal(second.processed, 1);
    assert.equal(second.failed, 0);
    assert.ok(await findInvoiceByPaymentId(server.db, good.paymentId));
    for (const payment of bad) {
      assert.equal(
        await findInvoiceByPaymentId(server.db, payment.paymentId),
        null,
      );
    }

    // Asking again for an issued invoice issues nothing new
    const activation = await getInvoicingActivation(
      server.db,
      server.config,
      LATER,
    );
    assert.ok(activation.active);
    const again = await issueInvoice(
      contextOf(server),
      activation.approval,
      good.paymentId,
    );
    assert.equal(again.created, false);
  });

  it('stops issuing as soon as the approval is revoked, even mid-batch', async () => {
    const payment = await paidQuotedPayment(server);
    const activation = await getInvoicingActivation(
      server.db,
      server.config,
      LATER,
    );
    assert.ok(activation.active);

    // Revoked after the job read the approval
    await recordTestApproval(server.db, { status: 'REVOKED' });
    await assert.rejects(
      issueInvoice(contextOf(server), activation.approval, payment.paymentId),
      (error: unknown) =>
        error instanceof InvoiceIneligibleError &&
        error.reason === INVOICE_INELIGIBLE.approvalChanged,
    );
    assert.equal(
      await findInvoiceByPaymentId(server.db, payment.paymentId),
      null,
    );
  });
});

describe('Financial tables resist tampering in the database (H1, H5)', () => {
  let server: TestServer;
  before(async () => {
    refreshTimeline();
    server = await startTestServer({ invoicingEnabled: true });
    await recordTestApproval(server.db);
    await paidQuotedPayment(server);
    await reconcileMissingInvoices(contextOf(server));
  });
  after(async () => {
    await server.close();
  });

  it('refuses TRUNCATE on every financial table', async () => {
    for (const table of [
      'payments',
      'payment_events',
      'payment_refunds',
      'payment_disputes',
      'finance_audit_log',
      'tax_quotes',
      'invoice_sequences',
      'invoices',
      'payment_tax_snapshots',
      'tax_configuration_approvals',
    ]) {
      await assert.rejects(
        server.db.exec(`TRUNCATE ${table} CASCADE`),
        new RegExp(`Financial table ${table} cannot be truncated`),
        table,
      );
    }
  });

  it('refuses a duplicate sequence number or an invoice number that does not match it', async () => {
    const payment = await paidQuotedPayment(server);
    const write = (invoiceNumber: string, sequenceNumber: number) =>
      server.db.query(
        `INSERT INTO invoices (id, invoice_number, payment_id, fiscal_year,
           sequence_number, time_of_supply, issued_at, status, created_at, updated_at)
         VALUES ($1, $2, $3, '26-27', $4, now(), now(), 'ISSUED', now(), now())`,
        [randomUUID(), invoiceNumber, payment.paymentId, sequenceNumber],
      );
    // The audit's reproduction: a second invoice with the current number
    await assert.rejects(write('DUP-0001', 1), /does not match sequence/);
    await assert.rejects(write('INV/26-27/000001', 1), /duplicate key|unique/i);
  });

  it('refuses a snapshot that differs from the quote, or has no invoice', async () => {
    const payment = await paidQuotedPayment(server);
    const base = {
      id: randomUUID(),
      paymentId: payment.paymentId,
      invoiceId: null,
      quoteId: payment.quote.id,
      supplierLegalName: SUPPLIER_CONFIG.legalName,
      supplierGstin: SUPPLIER_CONFIG.gstin,
      supplierStateCode: '08',
      supplierAddress: SUPPLIER_CONFIG.registeredAddress,
      recipientName: 'Invoice Test Buyer',
      recipientEmail: 'x@example.com',
      recipientMobile: '+91 98765 12345',
      recipientCustomerType: 'INDIVIDUAL' as const,
      recipientAddressLine1: '42 Worli Seaface',
      recipientAddressLine2: null,
      recipientCity: 'Mumbai',
      recipientState: 'Maharashtra',
      recipientStateCode: '27',
      recipientPinCode: '400030',
      recipientBusinessName: null,
      recipientGstin: null,
      recipientGstinStateCode: null,
      placeOfSupplyStateCode: '27',
      supplyType: 'INTER_STATE' as const,
      sacCode: '999293',
      pricingMode: 'EXCLUSIVE' as const,
      taxableAmountPaise: payment.quote.taxableAmountPaise,
      gstRateBasisPoints: 1800,
      cgstRateBasisPoints: 0,
      cgstPaise: 0,
      sgstRateBasisPoints: 0,
      sgstPaise: 0,
      igstRateBasisPoints: 1800,
      igstPaise: payment.quote.igstPaise,
      totalGstPaise: payment.quote.totalGstPaise,
      totalAmountPaise: payment.quote.totalAmountPaise,
      calculationVersion: payment.quote.calculationVersion,
      roundingPolicy: payment.quote.roundingPolicy,
      timestamp: LATER.toISOString(),
    };
    // No invoice: refused (the audit's 1-paise split had none)
    await assert.rejects(
      insertTaxSnapshot(server.db, base),
      /must belong to an invoice/,
    );

    // With an invoice, a split that differs from the quote is refused
    await assert.rejects(
      transaction(server.db, async tx => {
        const allocation = await allocateInvoiceNumber(tx, LATER);
        const invoiceId = randomUUID();
        await insertInvoice(tx, {
          id: invoiceId,
          invoiceNumber: allocation.invoiceNumber,
          paymentId: payment.paymentId,
          fiscalYear: allocation.fiscalYear,
          sequenceNumber: allocation.sequenceNumber,
          timeOfSupply: PAID_AT.toISOString(),
          issuedAt: LATER.toISOString(),
          status: 'ISSUED',
          timestamp: LATER.toISOString(),
        });
        await insertTaxSnapshot(tx, {
          ...base,
          invoiceId,
          cgstRateBasisPoints: 900,
          cgstPaise: 1,
          igstPaise: payment.quote.igstPaise - 1,
        });
      }),
      /differs from the GST quoted and collected/,
    );
  });

  it('refuses edits and deletes of quotes, except using an unused one', async () => {
    const { quote } = await paidQuotedPayment(server);
    await assert.rejects(
      server.db.query(
        'UPDATE tax_quotes SET total_amount_paise = 1 WHERE id = $1',
        [quote.id],
      ),
      /cannot be edited/,
    );
    await assert.rejects(
      server.db.query(`UPDATE tax_quotes SET status = 'ACTIVE' WHERE id = $1`, [
        quote.id,
      ]),
      /cannot move from CONSUMED to ACTIVE/,
    );
    await assert.rejects(
      server.db.query('DELETE FROM tax_quotes WHERE id = $1', [quote.id]),
      /cannot be deleted/,
    );
  });

  it('reports an older invoice that breaks the money rules, without changing it', async () => {
    const payment = await paidQuotedPayment(server);
    await reconcileMissingInvoices(contextOf(server));
    // What pre-remediation code could leave: a paid amount that differs
    await transaction(server.db, async tx => {
      await tx.exec('SET LOCAL session_replication_role = replica');
      await tx.query('UPDATE payments SET amount_paise = 12900 WHERE id = $1', [
        payment.paymentId,
      ]);
    });
    const result = await reconcileMissingInvoices(contextOf(server));
    assert.equal(result.inconsistentInvoices, 1);
    assert.ok(await findInvoiceByPaymentId(server.db, payment.paymentId));
  });
});

describe('Invoice retry backoff (N2)', () => {
  let server: TestServer;
  before(async () => {
    refreshTimeline();
    server = await startTestServer({ invoicingEnabled: true });
    await recordTestApproval(server.db);
  });
  after(async () => {
    await server.close();
  });

  const attemptRow = (paymentId: string) =>
    server.db.get<{
      attempts: number;
      last_reason: string;
      last_attempt_at: string;
      next_attempt_at: string;
    }>('SELECT * FROM invoice_issuance_attempts WHERE payment_id = $1', [
      paymentId,
    ]);

  it('doubles the delay with each failure up to a day, and keeps the reason visible', async () => {
    // A permanent rule violation: the billing city is blank
    const payment = await paidQuotedPayment(server, {
      at: PAID_AT,
      billing: { billingCity: ' ' },
    });

    const delaysInHours: number[] = [];
    let at = LATER;
    for (let failure = 1; failure <= 7; failure++) {
      // Each run is a fresh job context, as after a restart
      const run = await reconcileMissingInvoices(contextOf(server, at));
      assert.equal(run.failed, 1, `failure ${failure} was attempted`);
      const row = (await attemptRow(payment.paymentId))!;
      assert.equal(row.attempts, failure);
      assert.equal(row.last_reason, INVOICE_INELIGIBLE.incompleteBilling);
      const next = new Date(row.next_attempt_at);
      delaysInHours.push(
        (next.getTime() - new Date(row.last_attempt_at).getTime()) / 3_600_000,
      );

      // Not retried a minute before it is due
      const early = await reconcileMissingInvoices(
        contextOf(server, new Date(next.getTime() - 60_000)),
      );
      assert.equal(early.failed, 0);
      assert.equal(early.deferred, 1);
      at = next;
    }
    assert.deepEqual(delaysInHours, [1, 2, 4, 8, 16, 24, 24]);
    assert.equal(
      await findInvoiceByPaymentId(server.db, payment.paymentId),
      null,
    );
  });

  it('issues exactly one invoice once a temporary failure clears, and forgets the failures', async () => {
    const payment = await paidQuotedPayment(server);
    await server.db.exec(`
      CREATE FUNCTION fail_invoice_once_more() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'injected invoice failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER inject_invoice_retry_failure BEFORE INSERT ON invoices
      FOR EACH ROW EXECUTE FUNCTION fail_invoice_once_more();
    `);
    let at = LATER;
    for (let failure = 1; failure <= 2; failure++) {
      await reconcileMissingInvoices(contextOf(server, at));
      at = new Date((await attemptRow(payment.paymentId))!.next_attempt_at);
    }
    await server.db.exec(`
      DROP TRIGGER inject_invoice_retry_failure ON invoices;
      DROP FUNCTION fail_invoice_once_more();
    `);

    const retried = await reconcileMissingInvoices(contextOf(server, at));
    assert.equal(retried.processed, 1);
    assert.equal(await attemptRow(payment.paymentId), null);
    const again = await reconcileMissingInvoices(
      contextOf(server, new Date(at.getTime() + 48 * 3_600_000)),
    );
    assert.equal(again.processed, 0);
    assert.equal(
      (
        await server.db.all('SELECT id FROM invoices WHERE payment_id = $1', [
          payment.paymentId,
        ])
      ).length,
      1,
    );
  });
});
