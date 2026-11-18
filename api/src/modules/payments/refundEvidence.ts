// The one place that decides whether what a payment provider says about a
// refund is usable evidence. Razorpay JSON is cast, never parsed, at the
// gateway and webhook boundaries, so TypeScript types say nothing about what
// arrives. Nothing may move a refund to FAILED or PROCESSED, or release its
// reserved balance, on evidence this module has not accepted.
//
// Rules:
// - Nothing is guessed. A missing payment id, currency or status is a
//   problem, never a default taken from our own records.
// - Identity is never altered: a provider id with surrounding whitespace is
//   refused, not trimmed, so a stored id is always exactly what the provider
//   sent.
// - Insufficient evidence is not proof of failure. Callers keep the refund
//   reserved and record an exception for a person.

export const REFUND_STATUS = {
  pending: 'pending',
  processed: 'processed',
  failed: 'failed',
} as const;

export type ProviderRefundStatus =
  (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

const SUPPORTED_STATUSES: readonly string[] = Object.values(REFUND_STATUS);

export const REFUND_EVIDENCE_PROBLEM = {
  idInvalid: 'id_invalid',
  idMismatch: 'id_mismatch',
  paymentIdMissing: 'payment_id_missing',
  paymentIdMismatch: 'payment_id_mismatch',
  amountInvalid: 'amount_invalid',
  amountMismatch: 'amount_mismatch',
  currencyMissing: 'currency_missing',
  currencyMismatch: 'currency_mismatch',
  statusInvalid: 'status_invalid',
  statusInconsistent: 'status_inconsistent',
  receiptInvalid: 'receipt_invalid',
  receiptMissing: 'receipt_missing',
  receiptMismatch: 'receipt_mismatch',
} as const;

export type RefundEvidenceProblemCode =
  (typeof REFUND_EVIDENCE_PROBLEM)[keyof typeof REFUND_EVIDENCE_PROBLEM];

export type RefundEvidenceProblem = {
  code: RefundEvidenceProblemCode;
  message: string;
};

// What the provider reported, as received: any field may be absent or of
// the wrong type
export type RawRefundEvidence = {
  id?: unknown;
  status?: unknown;
  amountPaise?: unknown;
  currency?: unknown;
  paymentId?: unknown;
  receipt?: unknown;
};

// What our own records say this evidence must describe. A field that is
// left out is not checked.
export type RefundEvidenceExpectation = {
  providerPaymentId?: string;
  amountPaise?: number;
  currency?: string;
  // Our refund's receipt (the idempotency key sent to Razorpay). When set,
  // the provider's receipt must be present and equal.
  receipt?: string | null;
  // The provider refund id already stored, or supplied by staff
  providerRefundId?: string | null;
  // The status the event type implies (refund.failed -> failed)
  status?: ProviderRefundStatus;
};

export type RefundEvidence = {
  id: string;
  status: ProviderRefundStatus;
  amountPaise: number;
  currency: string;
  paymentId: string;
  receipt: string | null;
};

export type RefundEvidenceResult =
  | { ok: true; evidence: RefundEvidence }
  | { ok: false; problems: RefundEvidenceProblem[] };

const isCleanText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && value === value.trim();

export const validateRefundEvidence = (
  raw: RawRefundEvidence,
  expected: RefundEvidenceExpectation = {},
): RefundEvidenceResult => {
  const problems: RefundEvidenceProblem[] = [];
  const problem = (code: RefundEvidenceProblemCode, message: string) =>
    problems.push({ code, message });

  if (!isCleanText(raw.id)) {
    problem(
      REFUND_EVIDENCE_PROBLEM.idInvalid,
      'Provider refund record is missing an authoritative refund ID',
    );
  } else if (
    expected.providerRefundId !== undefined &&
    expected.providerRefundId !== null &&
    raw.id !== expected.providerRefundId
  ) {
    problem(
      REFUND_EVIDENCE_PROBLEM.idMismatch,
      `Provider refund ID mismatch: expected ${expected.providerRefundId}, got ${raw.id}`,
    );
  }

  if (!isCleanText(raw.paymentId)) {
    problem(
      REFUND_EVIDENCE_PROBLEM.paymentIdMissing,
      'Provider refund has missing payment linkage',
    );
  } else if (
    expected.providerPaymentId !== undefined &&
    raw.paymentId !== expected.providerPaymentId
  ) {
    problem(
      REFUND_EVIDENCE_PROBLEM.paymentIdMismatch,
      `Provider refund belongs to payment ${raw.paymentId}, expected ${expected.providerPaymentId}`,
    );
  }

  if (
    typeof raw.amountPaise !== 'number' ||
    !Number.isSafeInteger(raw.amountPaise) ||
    raw.amountPaise <= 0
  ) {
    problem(
      REFUND_EVIDENCE_PROBLEM.amountInvalid,
      'Provider refund amount is not a whole number of paise',
    );
  } else if (
    expected.amountPaise !== undefined &&
    raw.amountPaise !== expected.amountPaise
  ) {
    problem(
      REFUND_EVIDENCE_PROBLEM.amountMismatch,
      `Provider refund amount (${raw.amountPaise} paise) does not match recorded refund amount (${expected.amountPaise} paise)`,
    );
  }

  if (!isCleanText(raw.currency)) {
    problem(
      REFUND_EVIDENCE_PROBLEM.currencyMissing,
      'Provider refund has no currency',
    );
  } else if (
    expected.currency !== undefined &&
    raw.currency.toUpperCase() !== expected.currency.toUpperCase()
  ) {
    problem(
      REFUND_EVIDENCE_PROBLEM.currencyMismatch,
      `Provider refund currency (${raw.currency}) does not match recorded currency (${expected.currency})`,
    );
  }

  const status =
    typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : null;
  if (status === null || !SUPPORTED_STATUSES.includes(status)) {
    problem(
      REFUND_EVIDENCE_PROBLEM.statusInvalid,
      `Provider refund status is missing or not one of ${SUPPORTED_STATUSES.join(', ')}`,
    );
  } else if (expected.status !== undefined && status !== expected.status) {
    problem(
      REFUND_EVIDENCE_PROBLEM.statusInconsistent,
      `Provider refund status '${status}' does not match the event, which reports '${expected.status}'`,
    );
  }

  let receipt: string | null = null;
  if (raw.receipt !== undefined && raw.receipt !== null) {
    if (typeof raw.receipt !== 'string') {
      problem(
        REFUND_EVIDENCE_PROBLEM.receiptInvalid,
        'Provider refund receipt is not text',
      );
    } else {
      receipt = raw.receipt;
    }
  }
  if (expected.receipt) {
    if (receipt === null) {
      if (raw.receipt === undefined || raw.receipt === null) {
        problem(
          REFUND_EVIDENCE_PROBLEM.receiptMissing,
          'Provider refund has no receipt, so it cannot be tied to this refund',
        );
      }
    } else if (receipt !== expected.receipt) {
      problem(
        REFUND_EVIDENCE_PROBLEM.receiptMismatch,
        'Provider refund receipt does not match this refund',
      );
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    evidence: {
      id: raw.id as string,
      status: status as ProviderRefundStatus,
      amountPaise: raw.amountPaise as number,
      currency: raw.currency as string,
      paymentId: raw.paymentId as string,
      receipt,
    },
  };
};

// A copy of what the provider reported that is safe to keep in an audit
// entry: numbers and short text as sent, anything else by its type
export const describeReported = (raw: RawRefundEvidence) => {
  const show = (value: unknown) =>
    typeof value === 'string'
      ? value.slice(0, 100)
      : typeof value === 'number'
        ? Number.isFinite(value)
          ? value
          : String(value)
        : value === null || value === undefined
          ? null
          : `(${Array.isArray(value) ? 'array' : typeof value})`;
  return {
    providerRefundId: show(raw.id),
    providerPaymentId: show(raw.paymentId),
    amountPaise: show(raw.amountPaise),
    currency: show(raw.currency),
    status: show(raw.status),
    receipt: show(raw.receipt),
  };
};

// The name finance sees for a problem in an exception record
export const exceptionField = (code: RefundEvidenceProblemCode) => {
  if (code.startsWith('currency')) return 'currency';
  if (code.startsWith('amount')) return 'amount';
  if (code.startsWith('payment_id')) return 'payment';
  if (code.startsWith('id_')) return 'provider_refund_id';
  if (code.startsWith('status')) return 'status';
  if (code.startsWith('receipt')) return 'receipt';
  return code;
};
