import type {
  HistoricalPaymentItem,
  HistoricalPaymentsReportResponse,
  RefundException,
  RefundExceptionsResponse,
} from '../../contracts/finance.js';
import type { DatabaseClient } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import {
  countHistoricalPayments,
  listHistoricalPaymentRows,
  listOpenRefundExceptions,
  listRefundMismatchReports,
  type HistoricalPaymentRow,
} from './reports.repository.js';

export const HISTORICAL_REPORT_MAX_ROWS = 20000;

// 1 July 2026 00:00:00 IST in UTC
export const DEFAULT_HISTORICAL_SINCE_IST = new Date(
  '2026-06-30T18:30:00.000Z',
);

// Formats a date or timestamp into IST ISO and human-readable string.
// Independent of server local timezone.
export const formatToIst = (
  date: Date | string,
): { iso: string; formatted: string } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istTime = new Date(d.getTime() + istOffsetMs);

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = istTime.getUTCFullYear();
  const month = pad(istTime.getUTCMonth() + 1);
  const day = pad(istTime.getUTCDate());
  const hours = pad(istTime.getUTCHours());
  const minutes = pad(istTime.getUTCMinutes());
  const seconds = pad(istTime.getUTCSeconds());

  return {
    iso: `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`,
    formatted: `${year}-${month}-${day} ${hours}:${minutes}:${seconds} IST`,
  };
};

export const paiseToRupees = (paise: number): string =>
  (paise / 100).toFixed(2);

export const toHistoricalPaymentItem = (
  row: HistoricalPaymentRow,
): HistoricalPaymentItem => {
  const createdAtIst = formatToIst(row.created_at);
  const paidAtIst = row.paid_at ? formatToIst(row.paid_at) : null;
  const amountPaise = Number(row.amount_paise);
  const refundCount = Number(row.refund_count);
  const refundedAmountPaise = Number(row.refunded_amount_paise);
  const refundPendingPaise = Number(row.refund_pending_paise);
  const refundUnderReviewPaise = Number(row.refund_under_review_paise);
  const refundFailedPaise = Number(row.refund_failed_paise);
  const captured = row.status === 'PAID';
  const netCollectedPaise = captured ? amountPaise - refundedAmountPaise : 0;
  // Money Razorpay refunded (or may refund) against a payment that was
  // never captured here cannot come out of collections: it is an exception
  const refundExceptionPaise = captured
    ? 0
    : refundedAmountPaise + refundPendingPaise + refundUnderReviewPaise;

  return {
    paymentId: String(row.payment_id),
    createdAt: new Date(row.created_at).toISOString(),
    createdAtIst: createdAtIst.formatted,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    paidAtIst: paidAtIst ? paidAtIst.formatted : null,
    paidAtEstimated: Boolean(row.paid_at_estimated),
    status: row.status as HistoricalPaymentItem['status'],
    amountPaise,
    amountRupees: paiseToRupees(amountPaise),
    currency: String(row.currency),
    provider: row.provider as HistoricalPaymentItem['provider'],
    providerOrderId: String(row.provider_order_id),
    providerPaymentId: row.provider_payment_id
      ? String(row.provider_payment_id)
      : null,
    billingName: String(row.billing_name),
    billingEmail: String(row.billing_email),
    billingMobile: String(row.billing_mobile),
    billingState: row.billing_state ? String(row.billing_state) : null,
    billingCity: row.billing_city ? String(row.billing_city) : null,
    topicTitleCatalogueCurrent: row.topic_title
      ? String(row.topic_title)
      : null,
    batchNameCatalogueCurrent: row.batch_name ? String(row.batch_name) : null,
    seatStatus: row.seat_status
      ? (row.seat_status as HistoricalPaymentItem['seatStatus'])
      : null,
    refundCount,
    refundedAmountPaise,
    refundedAmountRupees: paiseToRupees(refundedAmountPaise),
    refundPendingPaise,
    refundUnderReviewPaise,
    refundFailedPaise,
    refundExceptionPaise,
    netCollectedPaise,
    taxStatus: row.tax_status as HistoricalPaymentItem['taxStatus'],
  };
};

export const generateHistoricalPaymentsReport = async (
  db: DatabaseClient,
  now: () => Date,
  since: Date = DEFAULT_HISTORICAL_SINCE_IST,
  maxRows = HISTORICAL_REPORT_MAX_ROWS,
): Promise<HistoricalPaymentsReportResponse> => {
  // One request answers at most this many rows; a larger period is
  // refused with a clear message rather than loading everything
  const count = await countHistoricalPayments(db, since);
  if (count > maxRows) {
    throw new ApiError(
      422,
      ERROR_CODE.requestValidationFailed,
      `This period has ${count} payments; the report covers at most ${maxRows}. Choose a later start date`,
    );
  }
  const rows = await listHistoricalPaymentRows(db, since);
  const items = rows.map(toHistoricalPaymentItem);

  const realPayments = items.filter(item => item.provider !== 'TEST');
  const testPayments = items.filter(item => item.provider === 'TEST');

  // Only PAID payments are money collected; anything else is an order
  // that was never captured and is not revenue
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const captured = realPayments.filter(item => item.status === 'PAID');
  const notCollected = realPayments.filter(item => item.status !== 'PAID');
  const realCapturedPaise = sum(captured.map(item => item.amountPaise));
  // Refunds count against collections only on captured payments, so
  // captured - refunded = net always holds
  const realRefundedPaise = sum(captured.map(item => item.refundedAmountPaise));
  const realNetCollectedPaise = realCapturedPaise - realRefundedPaise;
  const exceptions = notCollected.filter(item => item.refundExceptionPaise > 0);

  return {
    scope: {
      since: formatToIst(since).iso,
      generatedAt: formatToIst(now()).iso,
      timezone: 'Asia/Kolkata (IST, UTC+05:30)',
      dateBasis: 'PAYMENT_CREATED_AT_IST',
      disclaimer:
        'Payments are selected by the date they were created (checkout started), in IST; whether accounting periods should use the payment date instead awaits CA confirmation. Topic and batch titles reflect current catalogue names. No GST, SAC, or tax figures are computed for legacy transactions pending CA review. Amounts are captured at Razorpay, not bank receipts: settlement fees, timing and dispute deductions are not included. Only PAID payments count as collected, and only processed refunds on them are deducted; pending and under-review refunds are reserved, not deducted; refunds on payments never captured here are exceptions, never deducted.',
    },
    summary: {
      realPaymentsCount: realPayments.length,
      realCapturedCount: captured.length,
      realCapturedPaise,
      realCapturedRupees: paiseToRupees(realCapturedPaise),
      realRefundedPaise,
      realRefundPendingPaise: sum(
        captured.map(item => item.refundPendingPaise),
      ),
      realRefundUnderReviewPaise: sum(
        captured.map(item => item.refundUnderReviewPaise),
      ),
      realRefundFailedPaise: sum(
        realPayments.map(item => item.refundFailedPaise),
      ),
      realRefundExceptionCount: exceptions.length,
      realRefundExceptionPaise: sum(
        exceptions.map(item => item.refundExceptionPaise),
      ),
      realNetCollectedPaise,
      realNetCollectedRupees: paiseToRupees(realNetCollectedPaise),
      realNotCollectedCount: notCollected.length,
      realNotCollectedPaise: sum(notCollected.map(item => item.amountPaise)),
      testPaymentsCount: testPayments.length,
    },
    payments: realPayments,
    testPayments,
  };
};

export const CSV_HEADERS = [
  'Payment ID',
  'Created At (IST)',
  'Paid At (IST)',
  'Paid Date Estimated',
  'Status',
  'Amount (₹)',
  'Amount (Paise)',
  'Currency',
  'Provider',
  'Razorpay Order ID',
  'Razorpay Payment ID',
  'Billing Name',
  'Billing Email',
  'Billing Mobile',
  'Billing State',
  'Billing City',
  'Topic Title (Catalogue Current)',
  'Batch Name (Catalogue Current)',
  'Seat Status',
  'Refund Count',
  'Refunded Amount (Paise)',
  'Refunded Amount (₹)',
  'Refund Pending (Paise)',
  'Refund Under Review (Paise)',
  'Refund Failed (Paise)',
  'Refund Exception (Paise)',
  'Net Collected (Paise)',
  'Tax Status',
] as const;

// A text cell a spreadsheet could read as a formula: one starting with a
// control character (tab, carriage return, line feed...), or with
// = + - @ after any leading spaces or control characters
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@']);
const isSpaceOrControl = (character: string) =>
  character.charCodeAt(0) <= 0x20 || /\s/.test(character);

const isFormulaLike = (text: string) => {
  if (text.length > 0 && text.charCodeAt(0) < 0x20) return true;
  let index = 0;
  while (index < text.length && isSpaceOrControl(text[index])) index++;
  return FORMULA_PREFIXES.has(text[index]);
};

export const escapeCsvField = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  // Numbers (amounts in paise) are written as they are, so a value such as
  // -100 is never turned into text
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  const str = String(value);
  // Protect against formula injection in spreadsheet software
  const safeStr = isFormulaLike(str) ? `'${str}` : str;
  if (
    safeStr.includes(',') ||
    safeStr.includes('"') ||
    safeStr.includes('\n') ||
    safeStr.includes('\r')
  ) {
    return `"${safeStr.replaceAll('"', '""')}"`;
  }
  return safeStr;
};

export const formatCsvRow = (p: HistoricalPaymentItem): string =>
  [
    escapeCsvField(p.paymentId),
    escapeCsvField(p.createdAtIst),
    escapeCsvField(p.paidAtIst ?? ''),
    escapeCsvField(p.paidAtEstimated ? 'Yes' : 'No'),
    escapeCsvField(p.status),
    escapeCsvField(p.amountRupees),
    escapeCsvField(p.amountPaise),
    escapeCsvField(p.currency),
    escapeCsvField(p.provider),
    escapeCsvField(p.providerOrderId),
    escapeCsvField(p.providerPaymentId ?? ''),
    escapeCsvField(p.billingName),
    escapeCsvField(p.billingEmail),
    escapeCsvField(p.billingMobile),
    escapeCsvField(p.billingState ?? ''),
    escapeCsvField(p.billingCity ?? ''),
    escapeCsvField(p.topicTitleCatalogueCurrent ?? ''),
    escapeCsvField(p.batchNameCatalogueCurrent ?? ''),
    escapeCsvField(p.seatStatus ?? ''),
    escapeCsvField(p.refundCount),
    escapeCsvField(p.refundedAmountPaise),
    escapeCsvField(p.refundedAmountRupees),
    escapeCsvField(p.refundPendingPaise),
    escapeCsvField(p.refundUnderReviewPaise),
    escapeCsvField(p.refundFailedPaise),
    escapeCsvField(p.refundExceptionPaise),
    escapeCsvField(p.netCollectedPaise),
    escapeCsvField(p.taxStatus),
  ].join(',');

export const toHistoricalPaymentsCsv = (
  report: HistoricalPaymentsReportResponse,
  includeTest = true,
): string => {
  const lines: string[] = [
    CSV_HEADERS.join(','),
    ...report.payments.map(formatCsvRow),
  ];

  if (includeTest && report.testPayments.length > 0) {
    lines.push('');
    lines.push(
      `# TEST MODE PAYMENTS (Count: ${report.summary.testPaymentsCount}; no real money)`,
    );
    lines.push(CSV_HEADERS.join(','));
    lines.push(...report.testPayments.map(formatCsvRow));
  }

  return lines.join('\r\n') + '\r\n';
};

export const listRefundExceptions = async (
  db: DatabaseClient,
): Promise<RefundExceptionsResponse> => {
  const open = (await listOpenRefundExceptions(db)).map(row => ({
    refundId: String(row.id),
    paymentId: String(row.payment_id),
    kind:
      row.status === 'REQUIRES_REVIEW' && row.payment_status === 'PAID'
        ? ('REQUIRES_REVIEW' as const)
        : ('REFUND_ON_UNCAPTURED_PAYMENT' as const),
    status: row.status as RefundException['status'],
    paymentStatus: String(row.payment_status),
    amountPaise: Number(row.amount_paise),
    providerRefundId:
      row.provider_refund_id === null ? null : String(row.provider_refund_id),
    providerPaymentId:
      row.provider_payment_id === null ? null : String(row.provider_payment_id),
    receipt: row.receipt === null ? null : String(row.receipt),
    reviewReason: row.review_reason === null ? null : String(row.review_reason),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
  const mismatches = (await listRefundMismatchReports(db)).map(row => ({
    auditId: String(row.id),
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
    refundId: row.entity_id === null ? null : String(row.entity_id),
    details: (row.details ?? {}) as Record<string, unknown>,
  }));
  return { open, mismatches };
};
