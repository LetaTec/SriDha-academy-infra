import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { HistoricalPaymentsReportResponse } from '../../contracts/finance.js';
import { ApiError } from '../../http/errors.js';
import {
  escapeCsvField,
  generateHistoricalPaymentsReport,
} from './reports.service.js';
import {
  startTestServer,
  TEST_SUPER_ADMIN_EMAIL,
  testStudent,
  type TestClient,
} from '../../test/testServer.js';

const FINANCE_EMAIL = 'finance@sridha.test';
const OPERATIONS_EMAIL = 'operations@sridha.test';

describe('historical payments report for CA review', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let superAdmin: TestClient;
  let finance: TestClient;
  let operations: TestClient;
  let student: TestClient;

  before(async () => {
    server = await startTestServer({
      financeAdminEmails: [FINANCE_EMAIL],
      operationsAdminEmails: [OPERATIONS_EMAIL],
    });
    superAdmin = await server.signInStaff(TEST_SUPER_ADMIN_EMAIL);
    finance = await server.signInStaff(FINANCE_EMAIL);
    operations = await server.signInStaff(OPERATIONS_EMAIL);
    student = server.createClient();
    await server.signUpStudent(testStudent(), student);

    // Seed historical payments across different dates and providers
    const topic = (await server.db.get<{ id: string }>(
      `SELECT topic_id AS id FROM batches LIMIT 1`,
    ))!;
    const batch = (await server.db.get<{ id: string }>(
      `SELECT id FROM batches WHERE topic_id = $1 LIMIT 1`,
      [topic.id],
    ))!;

    // 1. A pre-July payment (15 June 2026) that must be excluded from default scope
    const user1 = (await server.db.get<{ id: string }>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ('usr_hist_pre', 'pre.july@example.com', 'hash', 'STUDENT', '2026-06-15T10:00:00Z', '2026-06-15T10:00:00Z')
       RETURNING id`,
    ))!;
    const prereg1 = (await server.db.get<{ id: string }>(
      `INSERT INTO pre_registrations (id, user_id, topic_id, status, created_at, updated_at)
       VALUES ('prereg_hist_pre', $1, $2, 'CONFIRMED', '2026-06-15T10:00:00+05:30', '2026-06-15T10:05:00+05:30')
       RETURNING id`,
      [user1.id, topic.id],
    ))!;
    await server.db.run(
      `INSERT INTO payments (
         id, user_id, pre_registration_id, amount_paise, currency, provider, provider_order_id,
         provider_payment_id, status, billing_name, billing_email, billing_mobile,
         billing_state, billing_city, created_at, updated_at, paid_at,
         paid_at_estimated, tax_status
       ) VALUES (
         'pay_hist_pre_july', $1, $2, 12900, 'INR', 'RAZORPAY', 'order_hist_pre',
         'pay_rzp_pre', 'PAID', 'Pre July Buyer', 'pre.july@example.com',
         '+91 98765 00001', 'Delhi', 'New Delhi', '2026-06-15T10:00:00+05:30',
         '2026-06-15T10:05:00+05:30', '2026-06-15T10:05:00+05:30', true,
         'LEGACY_UNREVIEWED'
       )`,
      [user1.id, prereg1.id],
    );

    // 2. Real RAZORPAY captured payment on 2 July 2026 with estimated paid_at
    const user2 = (await server.db.get<{ id: string }>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ('usr_hist_real_1', 'asha.legacy@example.com', 'hash', 'STUDENT', '2026-07-02T10:00:00Z', '2026-07-02T10:00:00Z')
       RETURNING id`,
    ))!;
    const enrolment = (await server.db.get<{ id: string }>(
      `INSERT INTO enrolments (id, user_id, batch_id, status, created_at, updated_at)
       VALUES ('enr_hist_1', $1, $2, 'CONFIRMED', '2026-07-02T10:00:00+05:30', '2026-07-02T10:05:00+05:30')
       RETURNING id`,
      [user2.id, batch.id],
    ))!;
    await server.db.run(
      `INSERT INTO payments (
         id, user_id, enrolment_id, amount_paise, currency, provider, provider_order_id,
         provider_payment_id, status, billing_name, billing_email, billing_mobile,
         billing_state, billing_city, created_at, updated_at, paid_at,
         paid_at_estimated, tax_status
       ) VALUES (
         'pay_hist_real_paid', $1, $2, 12900, 'INR', 'RAZORPAY', 'order_hist_real_1',
         'pay_rzp_real_1', 'PAID', 'Asha Verma', 'asha.legacy@example.com',
         '+91 98765 00002', 'Rajasthan', 'Jaipur', '2026-07-02T10:00:00+05:30',
         '2026-07-02T10:05:00+05:30', '2026-07-02T10:05:00+05:30', true,
         'LEGACY_UNREVIEWED'
       )`,
      [user2.id, enrolment.id],
    );

    // Add a partial refund to pay_hist_real_paid
    await server.db.exec(
      `INSERT INTO payment_refunds (
         id, payment_id, provider, provider_refund_id, receipt, amount_paise,
         currency, status, source, created_at, updated_at, processed_at
       ) VALUES (
         'rfnd_hist_1', 'pay_hist_real_paid', 'RAZORPAY', 'rfnd_prov_1',
         'rcpt_hist_1', 2900, 'INR', 'PROCESSED', 'FINANCE_ADMIN',
         '2026-07-03T12:00:00+05:30', '2026-07-03T12:00:00+05:30',
         '2026-07-03T12:00:00+05:30'
       )`,
    );

    // ...and a second refund still pending at Razorpay (not yet returned)
    await server.db.exec(
      `INSERT INTO payment_refunds (
         id, payment_id, provider, provider_refund_id, receipt, amount_paise,
         currency, status, source, created_at, updated_at
       ) VALUES (
         'rfnd_hist_2', 'pay_hist_real_paid', 'RAZORPAY', 'rfnd_prov_2',
         'rcpt_hist_2', 1000, 'INR', 'PENDING', 'FINANCE_ADMIN',
         '2026-07-04T12:00:00+05:30', '2026-07-04T12:00:00+05:30'
       )`,
    );

    // 3. Real RAZORPAY failed payment on 5 July 2026
    const user3 = (await server.db.get<{ id: string }>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ('usr_hist_failed', 'failed.buyer@example.com', 'hash', 'STUDENT', '2026-07-05T14:00:00Z', '2026-07-05T14:00:00Z')
       RETURNING id`,
    ))!;
    const prereg3 = (await server.db.get<{ id: string }>(
      `INSERT INTO pre_registrations (id, user_id, topic_id, status, created_at, updated_at)
       VALUES ('prereg_hist_failed', $1, $2, 'CANCELLED', '2026-07-05T14:00:00+05:30', '2026-07-05T14:02:00+05:30')
       RETURNING id`,
      [user3.id, topic.id],
    ))!;
    await server.db.run(
      `INSERT INTO payments (
         id, user_id, pre_registration_id, amount_paise, currency, provider,
         provider_order_id, provider_payment_id, status, billing_name, billing_email,
         billing_mobile, billing_state, billing_city, created_at, updated_at,
         tax_status
       ) VALUES (
         'pay_hist_real_failed', $1, $2, 9900, 'INR', 'RAZORPAY', 'order_hist_real_failed',
         NULL, 'FAILED', '=Dangerous Formula', 'failed.buyer@example.com',
         '+91 98765 00003', 'Maharashtra', 'Mumbai', '2026-07-05T14:00:00+05:30',
         '2026-07-05T14:02:00+05:30', 'LEGACY_UNREVIEWED'
       )`,
      [user3.id, prereg3.id],
    );

    // 4. TEST provider payment on 10 July 2026 (must be partitioned into testPayments)
    const user4 = (await server.db.get<{ id: string }>(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ('usr_hist_test', 'test.buyer@example.com', 'hash', 'STUDENT', '2026-07-10T09:00:00Z', '2026-07-10T09:00:00Z')
       RETURNING id`,
    ))!;
    const enrolment4 = (await server.db.get<{ id: string }>(
      `INSERT INTO enrolments (id, user_id, batch_id, status, created_at, updated_at)
       VALUES ('enr_hist_test', $1, $2, 'CONFIRMED', '2026-07-10T09:00:00+05:30', '2026-07-10T09:05:00+05:30')
       RETURNING id`,
      [user4.id, batch.id],
    ))!;
    await server.db.run(
      `INSERT INTO payments (
         id, user_id, enrolment_id, amount_paise, currency, provider, provider_order_id,
         provider_payment_id, status, billing_name, billing_email, billing_mobile,
         billing_state, billing_city, created_at, updated_at, paid_at,
         paid_at_estimated, tax_status
       ) VALUES (
         'pay_hist_test_mode', $1, $2, 12900, 'INR', 'TEST', 'order_hist_test_mode',
         'pay_test_mode_1', 'PAID', 'Test Mode Buyer', 'test.buyer@example.com',
         '+91 98765 00004', 'Gujarat', 'Ahmedabad', '2026-07-10T09:00:00+05:30',
         '2026-07-10T09:05:00+05:30', '2026-07-10T09:05:00+05:30', false,
         'LEGACY_UNREVIEWED'
       )`,
      [user4.id, enrolment4.id],
    );
  });

  after(async () => {
    await server.close();
  });

  it('enforces server-side permissions: only super admin and finance admin can view', async () => {
    // 1. Unauthenticated -> 401
    const anon = await server
      .createClient()
      .request('GET', '/api/finance/reports/historical-payments');
    assert.equal(anon.status, 401);

    // 2. Student -> 403
    const asStudent = await student.request(
      'GET',
      '/api/finance/reports/historical-payments',
    );
    assert.equal(asStudent.status, 403);

    // 3. Operations admin -> 403
    const asOperations = await operations.request(
      'GET',
      '/api/finance/reports/historical-payments',
    );
    assert.equal(asOperations.status, 403);

    // 4. Finance admin -> 200
    const asFinance = await finance.request(
      'GET',
      '/api/finance/reports/historical-payments',
    );
    assert.equal(asFinance.status, 200);

    // 5. Super admin -> 200
    const asSuper = await superAdmin.request(
      'GET',
      '/api/finance/reports/historical-payments',
    );
    assert.equal(asSuper.status, 200);
  });

  it('generates the JSON report with correct scope, partitioning and metadata', async () => {
    const res = await finance.request<HistoricalPaymentsReportResponse>(
      'GET',
      '/api/finance/reports/historical-payments',
    );
    assert.equal(res.status, 200);

    const report = res.body;

    // Scope verification
    assert.equal(report.scope.since, '2026-07-01T00:00:00+05:30');
    assert.ok(report.scope.timezone.includes('Asia/Kolkata'));
    assert.ok(report.scope.disclaimer.includes('No GST, SAC, or tax figures'));

    // Real payments verification (pre-July excluded, test payment excluded)
    assert.equal(report.payments.length, 2);
    const paidPayment = report.payments.find(
      p => p.paymentId === 'pay_hist_real_paid',
    );
    assert.ok(paidPayment);
    assert.equal(paidPayment.status, 'PAID');
    assert.equal(paidPayment.amountPaise, 12900);
    assert.equal(paidPayment.amountRupees, '129.00');
    assert.equal(paidPayment.provider, 'RAZORPAY');
    assert.equal(paidPayment.billingName, 'Asha Verma');
    assert.equal(paidPayment.billingState, 'Rajasthan');
    assert.equal(paidPayment.billingCity, 'Jaipur');
    assert.equal(paidPayment.paidAtEstimated, true);
    assert.ok(paidPayment.createdAtIst.includes('2026-07-02'));
    assert.ok(paidPayment.createdAtIst.includes('IST'));
    assert.equal(paidPayment.seatStatus, 'CONFIRMED');
    assert.equal(paidPayment.refundCount, 2);
    // Only refunds Razorpay has processed count as refunded
    assert.equal(paidPayment.refundedAmountPaise, 2900);
    assert.equal(paidPayment.refundedAmountRupees, '29.00');
    assert.equal(paidPayment.refundPendingPaise, 1000);
    assert.equal(paidPayment.netCollectedPaise, 12900 - 2900);
    assert.equal(paidPayment.taxStatus, 'LEGACY_UNREVIEWED');

    // Failed payment
    const failedPayment = report.payments.find(
      p => p.paymentId === 'pay_hist_real_failed',
    );
    assert.ok(failedPayment);
    assert.equal(failedPayment.status, 'FAILED');
    assert.equal(failedPayment.paidAt, null);
    assert.equal(failedPayment.paidAtIst, null);
    assert.equal(failedPayment.netCollectedPaise, 0);

    // Pre-July payment must not be in payments
    assert.equal(
      report.payments.some(p => p.paymentId === 'pay_hist_pre_july'),
      false,
    );

    // Test payments verification (partitioned separately)
    assert.equal(report.testPayments.length, 1);
    const testPayment = report.testPayments[0];
    assert.equal(testPayment.paymentId, 'pay_hist_test_mode');
    assert.equal(testPayment.provider, 'TEST');
    assert.equal(testPayment.amountRupees, '129.00');

    // Summary: only captured money counts as collected. The failed 9,900
    // was never collected; pending refunds are shown, not yet deducted.
    assert.deepEqual(report.summary, {
      realPaymentsCount: 2,
      realCapturedCount: 1,
      realCapturedPaise: 12900,
      realCapturedRupees: '129.00',
      realRefundedPaise: 2900,
      realRefundPendingPaise: 1000,
      realRefundUnderReviewPaise: 0,
      realRefundFailedPaise: 0,
      realRefundExceptionCount: 0,
      realRefundExceptionPaise: 0,
      realNetCollectedPaise: 10000,
      realNetCollectedRupees: '100.00',
      realNotCollectedCount: 1,
      realNotCollectedPaise: 9900,
      testPaymentsCount: 1,
    });
    assert.ok(report.scope.disclaimer.includes('not bank receipts'));
  });

  it('exports the report in CSV format with sanitized values and separated test section', async () => {
    const res = await superAdmin.request(
      'GET',
      '/api/finance/reports/historical-payments?format=csv',
    );
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type']?.includes('text/csv'));
    assert.ok(
      res.headers['content-disposition']?.includes(
        'attachment; filename="historical-payments-report-',
      ),
    );

    const csvText =
      typeof res.body === 'string' ? res.body : JSON.stringify(res.body);

    // First line must be the standard CSV header
    const lines = csvText.trim().split(/\r?\n/);
    assert.ok(lines[0].startsWith('Payment ID,Created At (IST),Paid At (IST)'));
    assert.ok(lines[0].includes('Tax Status'));

    // Real payments appear in the top section
    assert.ok(csvText.includes('pay_hist_real_paid'));
    assert.ok(csvText.includes('Asha Verma'));
    assert.ok(csvText.includes('Jaipur'));

    // Formula injection protection: '=Dangerous Formula' must be sanitized with a leading quote
    assert.ok(
      csvText.includes("''=Dangerous Formula") ||
        csvText.includes("'=Dangerous Formula"),
    );

    // Refund and net columns
    assert.ok(lines[0].includes('Refund Pending (Paise)'));
    assert.ok(lines[0].includes('Net Collected (Paise)'));

    // Test section exists and contains test payment
    assert.ok(csvText.includes('# TEST MODE PAYMENTS'));
    assert.ok(csvText.includes('pay_hist_test_mode'));
    assert.ok(csvText.includes('Test Mode Buyer'));
  });

  it('omits the test payments section in CSV when includeTest=false', async () => {
    const res = await superAdmin.request(
      'GET',
      '/api/finance/reports/historical-payments?format=csv&includeTest=false',
    );
    assert.equal(res.status, 200);
    const csvText =
      typeof res.body === 'string' ? res.body : JSON.stringify(res.body);

    assert.ok(csvText.includes('pay_hist_real_paid'));
    assert.equal(csvText.includes('# TEST MODE PAYMENTS'), false);
    assert.equal(csvText.includes('pay_hist_test_mode'), false);
  });

  it('records every report export in the append-only finance audit log', async () => {
    const beforeAuditCount = (
      await server.db.all<{ count: string }>(
        `SELECT COUNT(*) AS count FROM finance_audit_log
         WHERE action = 'REPORT_EXPORTED' AND entity_id = 'HISTORICAL_PAYMENTS'`,
      )
    )[0].count;

    // Export report as finance admin
    const exportRes = await finance.request(
      'GET',
      '/api/finance/reports/historical-payments?format=csv',
    );
    assert.equal(exportRes.status, 200);

    const afterAuditCount = (
      await server.db.all<{ count: string }>(
        `SELECT COUNT(*) AS count FROM finance_audit_log
         WHERE action = 'REPORT_EXPORTED' AND entity_id = 'HISTORICAL_PAYMENTS'`,
      )
    )[0].count;
    assert.equal(Number(afterAuditCount), Number(beforeAuditCount) + 1);

    const auditRows = await server.db.all<{
      action: string;
      actor_role: string;
      entity_type: string;
      entity_id: string;
      details: string | Record<string, unknown>;
    }>(
      `SELECT action, actor_role, entity_type, entity_id, details
       FROM finance_audit_log
       WHERE action = 'REPORT_EXPORTED' AND entity_id = 'HISTORICAL_PAYMENTS'
       ORDER BY id DESC LIMIT 1`,
    );

    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].action, 'REPORT_EXPORTED');
    assert.equal(auditRows[0].actor_role, 'FINANCE_ADMIN');
    assert.equal(auditRows[0].entity_type, 'REPORT');
    assert.equal(auditRows[0].entity_id, 'HISTORICAL_PAYMENTS');

    const details =
      typeof auditRows[0].details === 'string'
        ? JSON.parse(auditRows[0].details)
        : auditRows[0].details;
    assert.equal(details.format, 'csv');
    assert.equal(details.realCount, 2);
    assert.equal(details.testCount, 1);
  });

  it('guarantees that report generation is strictly read-only and never modifies financial rows', async () => {
    const paymentBefore = (await server.db.get<{
      status: string;
      tax_status: string;
      amount_paise: number;
    }>(
      `SELECT status, tax_status, amount_paise FROM payments WHERE id = 'pay_hist_real_paid'`,
    ))!;

    // Call report several times
    await finance.request('GET', '/api/finance/reports/historical-payments');
    await superAdmin.request(
      'GET',
      '/api/finance/reports/historical-payments?format=csv',
    );

    const paymentAfter = (await server.db.get<{
      status: string;
      tax_status: string;
      amount_paise: number;
    }>(
      `SELECT status, tax_status, amount_paise FROM payments WHERE id = 'pay_hist_real_paid'`,
    ))!;

    assert.deepEqual(paymentBefore, paymentAfter);
    assert.equal(paymentAfter.tax_status, 'LEGACY_UNREVIEWED');
  });

  it('neutralises spreadsheet formulas, including tab and carriage-return prefixes', () => {
    assert.equal(escapeCsvField('=1+1'), "'=1+1");
    assert.equal(escapeCsvField('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(escapeCsvField('\t=1+1'), "'\t=1+1");
    assert.equal(escapeCsvField('\r=1+1'), `"'\r=1+1"`);
    assert.equal(escapeCsvField('Asha Verma'), 'Asha Verma');
  });

  it('refuses a period larger than one report can hold instead of loading it all', async () => {
    await assert.rejects(
      generateHistoricalPaymentsReport(
        server.db,
        () => new Date('2026-11-01T00:00:00Z'),
        new Date('2026-06-01T00:00:00Z'),
        2,
      ),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 422 &&
        /at most 2/.test(error.message),
    );
  });
});

describe('historical report arithmetic with every kind of refund (N1)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let report: HistoricalPaymentsReportResponse;
  let csv: string;
  const at = '2026-07-10T10:00:00+05:30';

  // One payment for a topic pre-registration, inserted as it would be at
  // that status, with the refunds Razorpay reported for it
  const payment = async (
    id: string,
    status: 'PAID' | 'AUTHORIZED' | 'CREATED',
    amountPaise: number,
    refunds: Array<{ amountPaise: number; status: string }> = [],
    billingName = 'Report Buyer',
  ) => {
    const topic = (await server.db.get<{ id: string }>(
      'SELECT id FROM topics LIMIT 1',
    ))!;
    await server.db.run(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, 'hash', 'STUDENT', $3, $3)`,
      [`usr_${id}`, `${id}@example.com`, at],
    );
    await server.db.run(
      `INSERT INTO pre_registrations (id, user_id, topic_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [
        `pre_${id}`,
        `usr_${id}`,
        topic.id,
        status === 'PAID' ? 'CONFIRMED' : 'PENDING_PAYMENT',
        at,
      ],
    );
    await server.db.run(
      `INSERT INTO payments (
         id, user_id, pre_registration_id, amount_paise, currency, provider,
         provider_order_id, provider_payment_id, status, billing_name, billing_email,
         billing_mobile, billing_state, billing_city, created_at, updated_at,
         paid_at, tax_status
       ) VALUES ($1, $2, $3, $4, 'INR', 'RAZORPAY', $5, $6, $7, $8, $9,
         '+91 98765 00009', 'Rajasthan', 'Jaipur', $10, $10, $11, 'LEGACY_UNREVIEWED')`,
      [
        id,
        `usr_${id}`,
        `pre_${id}`,
        amountPaise,
        `order_${id}`,
        status === 'CREATED' ? null : `pay_rzp_${id}`,
        status,
        billingName,
        `${id}@example.com`,
        at,
        status === 'PAID' ? at : null,
      ],
    );
    for (const [index, refund] of refunds.entries()) {
      await server.db.run(
        `INSERT INTO payment_refunds (
           id, payment_id, provider, provider_refund_id, receipt, amount_paise,
           currency, status, source, created_at, updated_at, processed_at
         ) VALUES ($1, $2, 'RAZORPAY', $3, $4, $5, 'INR', $6, 'PROVIDER_DASHBOARD',
           $7, $7, $8)`,
        [
          `rf_${id}_${index}`,
          id,
          `rfnd_${id}_${index}`,
          `rcpt_${id}_${index}`,
          refund.amountPaise,
          refund.status,
          at,
          refund.status === 'PROCESSED' ? at : null,
        ],
      );
    }
  };

  before(async () => {
    server = await startTestServer({ financeAdminEmails: [FINANCE_EMAIL] });
    // Fully refunded
    await payment('full', 'PAID', 10000, [
      { amountPaise: 10000, status: 'PROCESSED' },
    ]);
    // Two partial refunds, one pending, one under review, one failed
    await payment('partial', 'PAID', 20000, [
      { amountPaise: 3000, status: 'PROCESSED' },
      { amountPaise: 2000, status: 'PROCESSED' },
      { amountPaise: 1000, status: 'PENDING' },
      { amountPaise: 500, status: 'REQUIRES_REVIEW' },
      { amountPaise: 4000, status: 'FAILED' },
    ]);
    // The audit's case: only authorised here, refunded at Razorpay (₹279)
    await payment('uncaptured', 'AUTHORIZED', 27900, [
      { amountPaise: 27900, status: 'PROCESSED' },
    ]);
    // An unpaid checkout, whose buyer name is a formula
    await payment('unpaid', 'CREATED', 5000, [], '\n=HYPERLINK("http://evil")');

    const finance = await server.signInStaff(FINANCE_EMAIL);
    report = (
      await finance.request<HistoricalPaymentsReportResponse>(
        'GET',
        '/api/finance/reports/historical-payments',
      )
    ).body;
    csv = String(
      (
        await finance.request(
          'GET',
          '/api/finance/reports/historical-payments?format=csv',
        )
      ).body,
    );
  });
  after(async () => {
    await server.close();
  });

  it('deducts only processed refunds on captured payments, so the totals reconcile', () => {
    const summary = report.summary;
    assert.equal(summary.realCapturedPaise, 30000);
    assert.equal(summary.realRefundedPaise, 10000 + 3000 + 2000);
    assert.equal(summary.realNetCollectedPaise, 15000);
    assert.equal(
      summary.realCapturedPaise - summary.realRefundedPaise,
      summary.realNetCollectedPaise,
    );
    assert.equal(
      summary.realNetCollectedPaise,
      report.payments.reduce(
        (total, item) => total + item.netCollectedPaise,
        0,
      ),
    );
  });

  it('keeps pending, under-review and failed refunds apart, and never deducts them', () => {
    assert.equal(report.summary.realRefundPendingPaise, 1000);
    assert.equal(report.summary.realRefundUnderReviewPaise, 500);
    assert.equal(report.summary.realRefundFailedPaise, 4000);
    const partial = report.payments.find(item => item.paymentId === 'partial')!;
    assert.equal(partial.refundedAmountPaise, 5000);
    assert.equal(partial.refundPendingPaise, 1000);
    assert.equal(partial.refundUnderReviewPaise, 500);
    assert.equal(partial.refundFailedPaise, 4000);
    assert.equal(partial.netCollectedPaise, 15000);
  });

  it('reports a refund on a payment never captured here as an exception, not a deduction', () => {
    const uncaptured = report.payments.find(
      item => item.paymentId === 'uncaptured',
    )!;
    assert.equal(uncaptured.netCollectedPaise, 0);
    assert.equal(uncaptured.refundExceptionPaise, 27900);
    assert.equal(report.summary.realRefundExceptionCount, 1);
    assert.equal(report.summary.realRefundExceptionPaise, 27900);
    assert.equal(report.summary.realNotCollectedCount, 2);
    assert.equal(report.summary.realNotCollectedPaise, 27900 + 5000);
    assert.equal(report.scope.dateBasis, 'PAYMENT_CREATED_AT_IST');
  });

  it('writes the same figures to CSV and neutralises a formula behind a line feed', () => {
    // Rows end with CRLF; the line feed inside the quoted cell stays part
    // of that cell, which now starts with the neutralising quote
    const header = csv.split('\r\n')[0];
    assert.ok(header.includes('Refund Exception (Paise)'));
    assert.ok(csv.includes(`,"'\n=HYPERLINK(""http://evil"")",`));
    assert.ok(!csv.includes(',=HYPERLINK'));
    assert.ok(!csv.includes(',"\n=HYPERLINK'));
    const uncapturedRow = csv
      .split('\r\n')
      .find(line => line.startsWith('uncaptured,'))!;
    assert.ok(uncapturedRow.endsWith(',0,0,0,27900,0,LEGACY_UNREVIEWED'));
  });

  it('lists the open exceptions for finance staff only', async () => {
    const anonymous = await server
      .createClient()
      .request('GET', '/api/finance/refund-exceptions');
    assert.equal(anonymous.status, 401);
    const finance = await server.signInStaff(FINANCE_EMAIL);
    const listed = await finance.request(
      'GET',
      '/api/finance/refund-exceptions',
    );
    assert.equal(listed.status, 200);
    const kinds = listed.body.open.map(
      (item: { refundId: string; kind: string }) => [item.refundId, item.kind],
    );
    assert.deepEqual(kinds.sort(), [
      ['rf_partial_3', 'REQUIRES_REVIEW'],
      ['rf_uncaptured_0', 'REFUND_ON_UNCAPTURED_PAYMENT'],
    ]);
  });
});

describe('historical report date basis (N8)', () => {
  it('selects payments by their IST creation date, from 00:00 on 1 July 2026', async () => {
    const server = await startTestServer();
    try {
      const topic = (await server.db.get<{ id: string }>(
        'SELECT id FROM topics LIMIT 1',
      ))!;
      for (const [id, createdAt] of [
        ['before_midnight', '2026-06-30T18:29:59.999Z'],
        ['at_midnight', '2026-06-30T18:30:00.000Z'],
      ]) {
        await server.db.run(
          `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
           VALUES ($1, $2, 'hash', 'STUDENT', $3, $3)`,
          [`usr_${id}`, `${id}@example.com`, createdAt],
        );
        await server.db.run(
          `INSERT INTO pre_registrations (id, user_id, topic_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'PENDING_PAYMENT', $4, $4)`,
          [`pre_${id}`, `usr_${id}`, topic.id, createdAt],
        );
        await server.db.run(
          `INSERT INTO payments (id, user_id, pre_registration_id, amount_paise, currency,
             provider, provider_order_id, status, billing_name, billing_email,
             billing_mobile, created_at, updated_at, tax_status)
           VALUES ($1, $2, $3, 100, 'INR', 'RAZORPAY', $4, 'CREATED', 'Buyer', $5,
             '+91 98765 00010', $6, $6, 'LEGACY_UNREVIEWED')`,
          [
            id,
            `usr_${id}`,
            `pre_${id}`,
            `order_${id}`,
            `${id}@example.com`,
            createdAt,
          ],
        );
      }
      const report = await generateHistoricalPaymentsReport(
        server.db,
        () => new Date('2026-11-01T00:00:00Z'),
      );
      assert.deepEqual(
        report.payments.map(item => item.paymentId),
        ['at_midnight'],
      );
      assert.equal(report.payments[0].createdAtIst, '2026-07-01 00:00:00 IST');
      assert.equal(report.scope.since, '2026-07-01T00:00:00+05:30');
      assert.match(report.scope.disclaimer, /awaits CA confirmation/);
    } finally {
      await server.close();
    }
  });
});

describe('CSV formula neutralising (B)', () => {
  it('neutralises formulas behind whitespace or control characters', () => {
    for (const value of [
      '=1+1',
      '+1',
      '-1+1',
      '@SUM(A1)',
      '\t=1',
      '\r=1',
      '\n=1',
      ' =1',
      '\u0000=1',
      '\n',
    ]) {
      assert.ok(
        escapeCsvField(value).replace(/^"/, '').startsWith("'"),
        JSON.stringify(value),
      );
    }
  });

  it('leaves ordinary values and numbers exactly as they are', () => {
    assert.equal(escapeCsvField('Asha Verma'), 'Asha Verma');
    assert.equal(escapeCsvField('INV/26-27/000001'), 'INV/26-27/000001');
    assert.equal(escapeCsvField('pay_RZP123'), 'pay_RZP123');
    assert.equal(escapeCsvField('129.00'), '129.00');
    assert.equal(escapeCsvField(12900), '12900');
    assert.equal(escapeCsvField(-500), '-500');
    assert.equal(
      escapeCsvField('2026-07-01 00:00:00 IST'),
      '2026-07-01 00:00:00 IST',
    );
  });
});
