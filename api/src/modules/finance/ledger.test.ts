import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { HistoricalPaymentsReportResponse } from '../../contracts/finance.js';
import { createScriptedRazorpay } from '../../test/fakeRazorpay.js';
import {
  captureQuotedPayment,
  createQuotedPayment,
  recordTestApproval,
  TEST_APPROVAL_EFFECTIVE_FROM,
} from '../../test/invoicing.js';
import { startTestServer, type TestClient } from '../../test/testServer.js';
import { reconcilePendingRefunds } from '../payments/payments.refunds.reconciliation.js';
import { reconcileMissingInvoices } from './invoices/invoices.service.js';

// One end-to-end money trail through the real routes (checkout, Razorpay
// webhooks, the finance refund route, the report route) with the fake
// Razorpay gateway, proving in paise that captures, payment records,
// refunds, invoices and the report agree wherever they should. Captured
// amounts are Razorpay captures, not bank receipts: settlements and fees
// are not part of this system yet.

const SECRET = 'whsec_ledger';
const FINANCE_EMAIL = 'finance.ledger@sridha.test';
const TOPIC = 'topic_physics_wave_optics_class_12';
const T0 = new Date(new Date(TEST_APPROVAL_EFFECTIVE_FROM).getTime() + 30_000);
const HOUR = 60 * 60 * 1000;

describe('Financial reconciliation, end to end, in paise', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let razorpay: ReturnType<typeof createScriptedRazorpay>;
  let finance: TestClient;
  let eventNumber = 0;
  let buyer = 0;
  const captured: number[] = [];

  const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);
  const setClock = (time: Date) => {
    server.clock.now = () => time;
  };

  const deliver = (body: Record<string, unknown>, eventId?: string) => {
    eventNumber += 1;
    return server
      .createClient()
      .request('POST', '/api/payments/webhook', body, {
        'X-Razorpay-Signature': createHmac('sha256', SECRET)
          .update(JSON.stringify(body))
          .digest('hex'),
        'X-Razorpay-Event-Id': eventId ?? `evt_ledger_${eventNumber}`,
      });
  };

  const checkout = async () => {
    buyer += 1;
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'PRE_REGISTRATION',
        topicId: TOPIC,
        fullName: 'Ledger Buyer',
        email: `ledger.buyer${buyer}@example.com`,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(response.status, 201);
    const { paymentId, provider, amount } = response.body.checkout;
    return {
      paymentId: String(paymentId),
      orderId: String(provider.orderId),
      amountPaise: Number(amount.amountPaise),
      providerPaymentId: `pay_ledger_${buyer}`,
    };
  };

  const paymentWebhook = (
    order: Awaited<ReturnType<typeof checkout>>,
    event: 'payment.captured' | 'payment.authorized',
  ) =>
    deliver({
      event,
      payload: {
        payment: {
          entity: {
            id: order.providerPaymentId,
            order_id: order.orderId,
            amount: order.amountPaise,
            currency: 'INR',
            status: event === 'payment.captured' ? 'captured' : 'authorized',
          },
        },
      },
    });

  const paid = async () => {
    const order = await checkout();
    assert.equal((await paymentWebhook(order, 'payment.captured')).status, 200);
    captured.push(order.amountPaise);
    return order;
  };

  const STATUS_OF_EVENT: Record<string, string> = {
    'refund.created': 'pending',
    'refund.processed': 'processed',
    'refund.failed': 'failed',
  };

  const refundWebhook = (
    eventType: string,
    entity: Record<string, unknown>,
    eventId?: string,
  ) =>
    deliver(
      {
        event: eventType,
        payload: {
          refund: {
            entity: {
              currency: 'INR',
              // Razorpay always sends the refund's status with the event
              status: STATUS_OF_EVENT[eventType],
              ...entity,
            },
          },
        },
      },
      eventId,
    );

  const sumOf = (sql: string, params: unknown[] = []) =>
    server.db
      .get<{ total: string | number }>(sql, params)
      .then(row => Number(row?.total ?? 0));

  before(async () => {
    razorpay = createScriptedRazorpay();
    server = await startTestServer({
      paymentGateway: razorpay.gateway,
      razorpayWebhookSecret: SECRET,
      financeAdminEmails: [FINANCE_EMAIL],
      invoicingEnabled: true,
      now: () => T0,
    });
    finance = await server.signInStaff(FINANCE_EMAIL);
  });

  after(async () => {
    await server.close();
  });

  it('agrees from Razorpay to payment records, refunds, invoices and the report', async t => {
    // 1-3. Payment A: checkout, capture, partial refund confirmed by webhook
    const a = await paid();
    const refundA = await finance.request(
      'POST',
      `/api/finance/payments/${a.paymentId}/refunds`,
      { amountPaise: 3000, reason: 'Partial refund' },
    );
    assert.equal(refundA.status, 201);
    const refundAEntity = {
      id: refundA.body.refund.providerRefundId,
      payment_id: a.providerPaymentId,
      amount: 3000,
    };
    assert.equal(
      (await refundWebhook('refund.processed', refundAEntity, 'evt_refund_a'))
        .status,
      200,
    );

    // 8. The same webhook again, and 9. a mismatched one (9,000 for 3,000)
    await refundWebhook('refund.processed', refundAEntity, 'evt_refund_a');
    await refundWebhook('refund.processed', { ...refundAEntity, amount: 9000 });

    // 4-5. Payment B: the refund request times out; Razorpay lists it later
    const b = await paid();
    razorpay.state.refundResult = () => ({ outcome: 'unknown' });
    await finance.request(
      'POST',
      `/api/finance/payments/${b.paymentId}/refunds`,
      {
        amountPaise: 5000,
        reason: 'Timed out request',
      },
    );
    const receiptB = razorpay.refundRequests.at(-1)!.receipt;
    razorpay.paymentRefunds.set(b.providerPaymentId, [
      {
        id: 'rfnd_ledger_b',
        status: 'processed',
        amountPaise: 5000,
        currency: 'INR',
        paymentId: b.providerPaymentId,
        receipt: receiptB,
      },
    ]);

    // 7. Payment C: a refund Razorpay never lists, so it goes to review
    const c = await paid();
    await finance.request(
      'POST',
      `/api/finance/payments/${c.paymentId}/refunds`,
      {
        amountPaise: 2000,
        reason: 'Lost request',
      },
    );
    razorpay.paymentRefunds.set(c.providerPaymentId, []);

    setClock(at(26));
    const reconciled = await reconcilePendingRefunds(
      { db: server.db, now: server.clock.now },
      razorpay.gateway,
      { olderThanMinutes: 0 },
    );
    assert.equal(reconciled.processed, 1);
    assert.equal(reconciled.needsReview, 1);

    // 6. Payment D: checkout, never paid
    const d = await checkout();

    // Payment E: only authorised here, refunded at Razorpay (an exception)
    const e = await checkout();
    await paymentWebhook(e, 'payment.authorized');
    await refundWebhook('refund.processed', {
      id: 'rfnd_ledger_e',
      payment_id: e.providerPaymentId,
      amount: e.amountPaise,
    });

    // 10. Invoicing disabled: nothing is issued
    const off = await reconcileMissingInvoices({
      db: server.db,
      config: { ...server.config, invoicingEnabled: false },
      now: server.clock.now,
    });
    assert.equal(off.active, false);
    assert.equal(off.processed, 0);
    assert.equal(await sumOf('SELECT COUNT(*) AS total FROM invoices'), 0);

    // 11. Test-only: the gate on, an approval and a payment that collected
    // quoted GST (no production path produces one yet)
    await recordTestApproval(server.db);
    const q = await createQuotedPayment(server.db, { at: T0 });
    await captureQuotedPayment(server.db, q, T0);
    captured.push(q.amountPaise);
    const on = await reconcileMissingInvoices({
      db: server.db,
      config: server.config,
      now: server.clock.now,
    });
    assert.equal(on.processed, 1);

    // 12-13. The report, as JSON and CSV (the clock moved past the
    // one-day session, so finance signs in again)
    finance = await server.signInStaff(FINANCE_EMAIL);
    const json = await finance.request<HistoricalPaymentsReportResponse>(
      'GET',
      '/api/finance/reports/historical-payments',
    );
    assert.equal(json.status, 200);
    const report = json.body;
    const csv = String(
      (
        await finance.request(
          'GET',
          '/api/finance/reports/historical-payments?format=csv&includeTest=false',
        )
      ).body,
    );

    // The figures, each read from its own source
    const ledger = {
      razorpayCaptured: captured.reduce((total, amount) => total + amount, 0),
      paymentRecords: await sumOf(
        `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM payments WHERE status = 'PAID'`,
      ),
      processedRefunds: await sumOf(
        `SELECT COALESCE(SUM(r.amount_paise), 0) AS total FROM payment_refunds r
         JOIN payments p ON p.id = r.payment_id
         WHERE r.status = 'PROCESSED' AND p.status = 'PAID'`,
      ),
      pendingRefunds: await sumOf(
        `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM payment_refunds WHERE status = 'PENDING'`,
      ),
      underReviewRefunds: await sumOf(
        `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM payment_refunds WHERE status = 'REQUIRES_REVIEW'`,
      ),
      exceptionalRefunds: await sumOf(
        `SELECT COALESCE(SUM(r.amount_paise), 0) AS total FROM payment_refunds r
         JOIN payments p ON p.id = r.payment_id
         WHERE r.status <> 'FAILED' AND p.status <> 'PAID'`,
      ),
      invoiceTotal: await sumOf(
        `SELECT COALESCE(SUM(p.amount_paise), 0) AS total FROM invoices i
         JOIN payments p ON p.id = i.payment_id`,
      ),
      taxSnapshotTotal: await sumOf(
        'SELECT COALESCE(SUM(total_amount_paise), 0) AS total FROM payment_tax_snapshots',
      ),
      reportCaptured: report.summary.realCapturedPaise,
      reportRefunded: report.summary.realRefundedPaise,
      reportNet: report.summary.realNetCollectedPaise,
      unpaidCheckouts: await sumOf(
        `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM payments WHERE status = 'CREATED'`,
      ),
    };
    t.diagnostic(`ledger (paise): ${JSON.stringify(ledger, null, 2)}`);

    // Captures
    assert.equal(ledger.paymentRecords, ledger.razorpayCaptured);
    assert.equal(ledger.reportCaptured, ledger.razorpayCaptured);
    // Refunds: A 3,000 by webhook and B 5,000 by reconciliation; the
    // duplicate and the 9,000 mismatch changed nothing
    assert.equal(ledger.processedRefunds, 8000);
    assert.equal(ledger.reportRefunded, ledger.processedRefunds);
    assert.equal(ledger.pendingRefunds, 0);
    assert.equal(ledger.underReviewRefunds, 2000);
    assert.equal(report.summary.realRefundUnderReviewPaise, 2000);
    assert.equal(ledger.exceptionalRefunds, e.amountPaise);
    assert.equal(report.summary.realRefundExceptionPaise, e.amountPaise);
    // Net
    assert.equal(
      ledger.reportNet,
      ledger.reportCaptured - ledger.reportRefunded,
    );
    // Invoices: only the payment that collected quoted GST, at its amount
    assert.equal(ledger.invoiceTotal, q.amountPaise);
    assert.equal(ledger.taxSnapshotTotal, ledger.invoiceTotal);
    // Not collected: the unpaid checkout and the authorised-only payment
    assert.equal(ledger.unpaidCheckouts, d.amountPaise);
    assert.equal(
      report.summary.realNotCollectedPaise,
      d.amountPaise + e.amountPaise,
    );

    // The mismatched webhook is on record as an exception, and refunds are
    // never more than was captured on any payment
    const exceptions = await finance.request(
      'GET',
      '/api/finance/refund-exceptions',
    );
    assert.ok(
      exceptions.body.mismatches.some(
        (entry: { details: { field?: string } }) =>
          entry.details.field === 'amount',
      ),
    );
    const overRefunded = await sumOf(
      `SELECT COUNT(*) AS total FROM payments p WHERE (
         SELECT COALESCE(SUM(amount_paise), 0) FROM payment_refunds r
         WHERE r.payment_id = p.id AND r.status <> 'FAILED') > p.amount_paise`,
    );
    assert.equal(overRefunded, 0);

    // The CSV carries the same net figure, row by row
    const lines = csv.split('\r\n').filter(Boolean);
    const header = lines[0].split(',');
    const netColumn = header.indexOf('Net Collected (Paise)');
    const csvNet = lines
      .slice(1)
      .map(line => Number(line.split(',')[netColumn]))
      .reduce((total, amount) => total + amount, 0);
    assert.equal(csvNet, ledger.reportNet);
  });
});
