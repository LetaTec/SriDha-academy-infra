import type { DatabaseClient, Row } from '../../../db/client.js';
import type { Invoice, TaxApproval } from '../../../contracts/finance.js';

export type NewInvoice = {
  id: string;
  invoiceNumber: string;
  paymentId: string;
  fiscalYear: string;
  sequenceNumber: number;
  timeOfSupply: string;
  issuedAt: string;
  status: 'PENDING' | 'ISSUED' | 'FAILED' | 'CANCELLED';
  timestamp: string;
};

// India Standard Time is UTC+05:30 all year (no daylight saving)
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Derives the Indian Financial Year string from an instant, by its calendar
 * date in India (Asia/Kolkata). The FY runs from 1 April to 31 March, so
 * 2027-03-31T18:30:00Z (00:00 on 1 April 2027 in India) is in '27-28'.
 * E.g., November 2026 -> '26-27'
 *       February 2027 -> '26-27'
 *       April 2027    -> '27-28'
 */
export const deriveIndianFiscalYear = (date: Date): string => {
  const indiaDate = new Date(date.getTime() + IST_OFFSET_MS);
  const year = indiaDate.getUTCFullYear();
  const month = indiaDate.getUTCMonth(); // 0-based: 0 = Jan, 3 = Apr, 11 = Dec

  let startYear: number;
  let endYear: number;

  if (month >= 3) {
    // April to December
    startYear = year;
    endYear = year + 1;
  } else {
    // January to March
    startYear = year - 1;
    endYear = year;
  }

  const startYY = String(startYear % 100).padStart(2, '0');
  const endYY = String(endYear % 100).padStart(2, '0');
  return `${startYY}-${endYY}`;
};

export const toInvoice = (row: Row): Invoice => ({
  id: String(row.id),
  invoiceNumber: String(row.invoice_number),
  paymentId: String(row.payment_id),
  fiscalYear: String(row.fiscal_year),
  sequenceNumber: Number(row.sequence_number),
  timeOfSupply: new Date(String(row.time_of_supply)).toISOString(),
  issuedAt: new Date(String(row.issued_at)).toISOString(),
  status: row.status as 'PENDING' | 'ISSUED' | 'FAILED' | 'CANCELLED',
  createdAt: new Date(String(row.created_at)).toISOString(),
  updatedAt: new Date(String(row.updated_at)).toISOString(),
});

/**
 * Allocates a contiguous, non-reusable sequential invoice number atomically
 * at the database level. Conforms strictly to Rule 46(b) of the CGST Rules,
 * 2017 (maximum 16 characters, unique per financial year).
 *
 * Format: `INV/26-27/000001` (16 characters)
 */
export const allocateInvoiceNumber = async (
  db: DatabaseClient,
  date: Date,
): Promise<{
  invoiceNumber: string;
  fiscalYear: string;
  sequenceNumber: number;
}> => {
  const fiscalYear = deriveIndianFiscalYear(date);

  const row = await db.get<{ current_sequence: string | number | bigint }>(
    `INSERT INTO invoice_sequences (fiscal_year, current_sequence)
     VALUES ($1, 1)
     ON CONFLICT (fiscal_year)
     DO UPDATE SET current_sequence = invoice_sequences.current_sequence + 1
     RETURNING current_sequence`,
    [fiscalYear],
  );

  if (!row) {
    throw new Error(`Failed to allocate invoice sequence for FY ${fiscalYear}`);
  }

  const sequenceNumber = Number(row.current_sequence);
  const formattedSeq = String(sequenceNumber).padStart(6, '0');
  const invoiceNumber = `INV/${fiscalYear}/${formattedSeq}`;

  if (invoiceNumber.length > 16) {
    throw new RangeError(
      `Allocated invoice number '${invoiceNumber}' exceeds the statutory 16-character limit of CGST Rule 46(b)`,
    );
  }

  return { invoiceNumber, fiscalYear, sequenceNumber };
};

export const insertInvoice = (db: DatabaseClient, invoice: NewInvoice) =>
  db.query(
    `INSERT INTO invoices (
       id, invoice_number, payment_id, fiscal_year, sequence_number,
       time_of_supply, issued_at, status, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [
      invoice.id,
      invoice.invoiceNumber,
      invoice.paymentId,
      invoice.fiscalYear,
      invoice.sequenceNumber,
      invoice.timeOfSupply,
      invoice.issuedAt,
      invoice.status,
      invoice.timestamp,
    ],
  );

export const findInvoiceByPaymentId = async (
  db: DatabaseClient,
  paymentId: string,
): Promise<Invoice | null> => {
  const row = await db.get('SELECT * FROM invoices WHERE payment_id = $1', [
    paymentId,
  ]);
  return row ? toInvoice(row) : null;
};

// The payment row, locked for the issuing transaction: concurrent issuers
// for the same payment wait here, then see the invoice the first one made
export const findPaymentForInvoiceUpdate = (
  db: DatabaseClient,
  paymentId: string,
) =>
  db.get<Row>('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);

// Paid payments that collected quoted GST on or after the approval took
// effect, and have no tax snapshot yet (with or without an invoice row).
// A payment whose last attempt failed waits until its retry time, and
// never-tried payments come first, so failing payments cannot crowd out
// the rest of the queue.
export const listPaymentIdsAwaitingInvoice = async (
  db: DatabaseClient,
  params: { effectiveFrom: string; now: string; limit: number },
): Promise<string[]> => {
  const rows = await db.all<{ id: string }>(
    `SELECT p.id FROM payments p
     LEFT JOIN payment_tax_snapshots s ON s.payment_id = p.id
     LEFT JOIN invoice_issuance_attempts a ON a.payment_id = p.id
     WHERE p.status = 'PAID'
       AND p.provider <> 'TEST'
       AND p.tax_status = 'QUOTED'
       AND p.tax_quote_id IS NOT NULL
       AND p.paid_at >= $1
       AND s.id IS NULL
       AND (a.payment_id IS NULL OR a.next_attempt_at <= $2)
       -- Owner decision: no invoice while a payment exception is open, nor
       -- after one was resolved without a seat (refunded, or no action):
       -- nothing was supplied, and credit notes do not exist yet
       AND NOT EXISTS (
         SELECT 1 FROM payment_exceptions x
         WHERE x.payment_id = p.id
           AND (x.status = 'OPEN' OR x.resolution IS DISTINCT FROM 'SEAT_CONFIRMED')
       )
     ORDER BY COALESCE(a.attempts, 0) ASC, p.paid_at ASC, p.id ASC
     LIMIT $3`,
    [params.effectiveFrom, params.now, params.limit],
  );
  return rows.map(row => String(row.id));
};

// Records a failed issuance and when to try again, in one atomic
// statement: the attempt count is incremented by the database and the delay
// is computed from that new count (base, doubling, capped), so concurrent
// failures for the same payment never lose a count. The exponent is capped
// before it is used, so the delay cannot overflow.
export const recordIssuanceFailure = (
  db: DatabaseClient,
  failure: {
    paymentId: string;
    reason: string | null;
    error: string;
    at: string;
    baseDelayHours: number;
    maxDelayHours: number;
  },
) =>
  db.get<{ attempts: number; next_attempt_at: string }>(
    `INSERT INTO invoice_issuance_attempts AS a (
       payment_id, attempts, last_reason, last_error, last_attempt_at, next_attempt_at
     )
     VALUES ($1, 1, $2, $3, $4,
       $4::timestamptz + make_interval(hours => LEAST($5::int, $6::int)))
     ON CONFLICT (payment_id) DO UPDATE SET
       attempts = a.attempts + 1,
       last_reason = EXCLUDED.last_reason,
       last_error = EXCLUDED.last_error,
       last_attempt_at = EXCLUDED.last_attempt_at,
       next_attempt_at = EXCLUDED.last_attempt_at + make_interval(hours => LEAST(
         $5::int * (2 ^ LEAST(a.attempts, 20))::int,
         $6::int))
     RETURNING attempts, next_attempt_at`,
    [
      failure.paymentId,
      failure.reason,
      failure.error,
      failure.at,
      failure.baseDelayHours,
      failure.maxDelayHours,
    ],
  );

export const clearIssuanceFailure = (db: DatabaseClient, paymentId: string) =>
  db.query('DELETE FROM invoice_issuance_attempts WHERE payment_id = $1', [
    paymentId,
  ]);

// Payments waiting for a retry after failed issuance attempts
export const countDeferredIssuances = async (db: DatabaseClient, now: string) =>
  Number(
    (
      await db.get<{ n: string | number }>(
        'SELECT COUNT(*) AS n FROM invoice_issuance_attempts WHERE next_attempt_at > $1',
        [now],
      )
    )?.n ?? 0,
  );

// Issued invoices that break the money invariants: their snapshot total
// differs from the amount the payment collected, or the payment never
// collected quoted GST. Only invoices written before migrations 018/019
// could be like this; they need a person, never an automatic change.
export const listInvoicesBreakingInvariants = async (
  db: DatabaseClient,
): Promise<string[]> => {
  const rows = await db.all<{ invoice_number: string }>(
    `SELECT i.invoice_number FROM invoices i
     JOIN payments p ON p.id = i.payment_id
     JOIN payment_tax_snapshots s ON s.invoice_id = i.id
     WHERE s.total_amount_paise <> p.amount_paise
        OR p.tax_status <> 'QUOTED'
        OR s.quote_id IS DISTINCT FROM p.tax_quote_id
     ORDER BY i.fiscal_year, i.sequence_number`,
  );
  return rows.map(row => String(row.invoice_number));
};

// Invoices with no tax snapshot: only possible for rows written before
// migration 018 made the snapshot a commit-time requirement
export const listInvoicesWithoutSnapshot = async (
  db: DatabaseClient,
): Promise<Array<{ invoiceNumber: string; paymentId: string }>> => {
  const rows = await db.all<{ invoice_number: string; payment_id: string }>(
    `SELECT i.invoice_number, i.payment_id FROM invoices i
     LEFT JOIN payment_tax_snapshots s ON s.invoice_id = i.id
     WHERE s.id IS NULL
     ORDER BY i.fiscal_year, i.sequence_number`,
  );
  return rows.map(row => ({
    invoiceNumber: String(row.invoice_number),
    paymentId: String(row.payment_id),
  }));
};

export type TaxConfigurationFingerprint = {
  supplierGstin: string;
  sacCode: string;
  gstRateBasisPoints: number;
  pricingMode: string;
  calculationVersion: string;
  roundingPolicy: string;
};

// The same shape as the API contract
export type TaxConfigurationApproval = TaxApproval;

// node-postgres returns TIMESTAMPTZ as a Date and PGlite as a string;
// String(date) would drop the milliseconds, so convert each exactly
export const toIsoTimestamp = (value: unknown): string =>
  value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();

const toApproval = (row: Row): TaxConfigurationApproval => ({
  id: String(row.id),
  status: row.status as 'APPROVED' | 'REVOKED',
  supplierGstin: String(row.supplier_gstin),
  sacCode: String(row.sac_code),
  gstRateBasisPoints: Number(row.gst_rate_basis_points),
  pricingMode: String(row.pricing_mode),
  calculationVersion: String(row.calculation_version),
  roundingPolicy: String(row.rounding_policy),
  effectiveFrom: toIsoTimestamp(row.effective_from),
  approvedBy: String(row.approved_by),
  approvalReference: String(row.approval_reference),
  recordedBy: String(row.recorded_by),
  recordedAt: toIsoTimestamp(row.recorded_at),
});

// The latest approval record for exactly this tax configuration: the
// newest row by the database-assigned seq wins (never a caller-supplied
// time), so a REVOKED row always withdraws the approvals recorded before it
export const findLatestApprovalForConfiguration = async (
  db: DatabaseClient,
  config: TaxConfigurationFingerprint,
): Promise<TaxConfigurationApproval | null> => {
  const row = await db.get<Row>(
    `SELECT * FROM tax_configuration_approvals
     WHERE supplier_gstin = $1 AND sac_code = $2
       AND gst_rate_basis_points = $3 AND pricing_mode = $4
       AND calculation_version = $5 AND rounding_policy = $6
     ORDER BY seq DESC
     LIMIT 1`,
    [
      config.supplierGstin,
      config.sacCode,
      config.gstRateBasisPoints,
      config.pricingMode,
      config.calculationVersion,
      config.roundingPolicy,
    ],
  );
  return row ? toApproval(row) : null;
};

export const listTaxConfigurationApprovals = async (
  db: DatabaseClient,
): Promise<TaxConfigurationApproval[]> =>
  (
    await db.all<Row>(
      'SELECT * FROM tax_configuration_approvals ORDER BY seq DESC LIMIT 200',
    )
  ).map(toApproval);

export const insertTaxConfigurationApproval = (
  db: DatabaseClient,
  approval: TaxConfigurationApproval,
) =>
  db.query(
    `INSERT INTO tax_configuration_approvals (
       id, status, supplier_gstin, sac_code, gst_rate_basis_points,
       pricing_mode, calculation_version, rounding_policy, effective_from,
       approved_by, approval_reference, recorded_by, recorded_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      approval.id,
      approval.status,
      approval.supplierGstin,
      approval.sacCode,
      approval.gstRateBasisPoints,
      approval.pricingMode,
      approval.calculationVersion,
      approval.roundingPolicy,
      approval.effectiveFrom,
      approval.approvedBy,
      approval.approvalReference,
      approval.recordedBy,
      approval.recordedAt,
    ],
  );

export const findInvoiceByNumber = async (
  db: DatabaseClient,
  invoiceNumber: string,
): Promise<Invoice | null> => {
  const row = await db.get('SELECT * FROM invoices WHERE invoice_number = $1', [
    invoiceNumber,
  ]);
  return row ? toInvoice(row) : null;
};

// Whether a payment has a payment exception that keeps it from being
// invoiced: still open, or resolved without a seat being supplied
export const hasUninvoiceableException = async (
  db: DatabaseClient,
  paymentId: string,
) =>
  Boolean(
    await db.get<{ id: string }>(
      `SELECT id FROM payment_exceptions
       WHERE payment_id = $1
         AND (status = 'OPEN' OR resolution IS DISTINCT FROM 'SEAT_CONFIRMED')
       LIMIT 1`,
      [paymentId],
    ),
  );
