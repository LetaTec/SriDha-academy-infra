import { z } from 'zod';

import type {
  RefundDeskItem,
  RefundDetailResponse,
  RefundsListResponse,
  ResolveRefundExceptionRequestBody,
  ResolveRefundExceptionResponse,
} from '../../contracts/finance.js';
import {
  transaction,
  type Database,
  type DatabaseClient,
  type Row,
} from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import type { StaffActor } from '../auth/permissions.js';
import type { PaymentGateway, ProviderRefund } from '../payments/gateway.js';
import { toRefund } from '../payments/payments.refunds.js';
import {
  REFUND_STATUS,
  validateRefundEvidence,
} from '../payments/refundEvidence.js';
import { AUDIT_ACTION, recordAudit } from './audit.service.js';

export const resolveRefundExceptionSchema = z.strictObject({
  action: z.enum(['CONFIRM_PROCESSED', 'MARK_FAILED']),
  evidenceReference: z.string().trim().min(3).max(200),
  notes: z.string().trim().min(3).max(1000),
  providerRefundId: z.string().trim().min(5).max(100).optional(),
}) satisfies z.ZodType<ResolveRefundExceptionRequestBody>;

export const listRefundsDesk = async (
  db: DatabaseClient,
  options: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<RefundsListResponse> => {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const status = options.status?.trim() || undefined;
  const search = options.search?.trim() || undefined;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const searchIdx = params.length;
    conditions.push(`(
      r.id ILIKE $${searchIdx}
      OR r.payment_id ILIKE $${searchIdx}
      OR COALESCE(r.provider_refund_id, '') ILIKE $${searchIdx}
      OR COALESCE(r.receipt, '') ILIKE $${searchIdx}
      OR COALESCE(p.provider_payment_id, '') ILIKE $${searchIdx}
      OR COALESCE(p.billing_email, '') ILIKE $${searchIdx}
      OR COALESCE(p.billing_name, '') ILIKE $${searchIdx}
    )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const countRow = await db.get<{ total: string | number }>(
    `SELECT COUNT(*) AS total
     FROM payment_refunds r
     LEFT JOIN payments p ON p.id = r.payment_id
     ${whereClause}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const summaryRow = await db.get<Row>(
    `SELECT
       COUNT(*) AS total_count,
       COALESCE(COUNT(*) FILTER (WHERE status = 'PENDING'), 0) AS pending_count,
       COALESCE(COUNT(*) FILTER (WHERE status = 'REQUIRES_REVIEW'), 0) AS requires_review_count,
       COALESCE(COUNT(*) FILTER (WHERE status = 'PROCESSED'), 0) AS processed_count,
       COALESCE(COUNT(*) FILTER (WHERE status = 'FAILED'), 0) AS failed_count,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'REQUIRES_REVIEW'), 0) AS requires_review_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'PROCESSED'), 0) AS processed_paise
     FROM payment_refunds`,
  );

  const summary = {
    totalCount: Number(summaryRow?.total_count ?? 0),
    pendingCount: Number(summaryRow?.pending_count ?? 0),
    requiresReviewCount: Number(summaryRow?.requires_review_count ?? 0),
    processedCount: Number(summaryRow?.processed_count ?? 0),
    failedCount: Number(summaryRow?.failed_count ?? 0),
    requiresReviewPaise: Number(summaryRow?.requires_review_paise ?? 0),
    processedPaise: Number(summaryRow?.processed_paise ?? 0),
  };

  const queryParams = [...params, limit, offset];
  const rows = await db.all<Row>(
    `SELECT
       r.id, r.payment_id, r.amount_paise, r.currency, r.status, r.source,
       r.provider_refund_id, r.reason, r.failure_reason, r.review_reason,
       r.created_at, r.processed_at,
       p.status AS payment_status,
       p.amount_paise AS payment_amount_paise,
       p.provider_payment_id,
       p.provider_order_id,
       p.billing_email,
       p.billing_name
     FROM payment_refunds r
     LEFT JOIN payments p ON p.id = r.payment_id
     ${whereClause}
     ORDER BY
       CASE WHEN r.status = 'REQUIRES_REVIEW' THEN 0
            WHEN r.status = 'PENDING' THEN 1
            ELSE 2 END,
       r.created_at DESC
     LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
    queryParams,
  );

  const refunds: RefundDeskItem[] = rows.map(row => ({
    ...toRefund(row),
    paymentStatus: String(row.payment_status ?? 'UNKNOWN'),
    paymentAmountPaise: Number(row.payment_amount_paise ?? 0),
    providerPaymentId: row.provider_payment_id
      ? String(row.provider_payment_id)
      : null,
    providerOrderId: row.provider_order_id
      ? String(row.provider_order_id)
      : null,
    customerEmail: row.billing_email ? String(row.billing_email) : null,
    customerName: row.billing_name ? String(row.billing_name) : null,
  }));

  return {
    refunds,
    total,
    limit,
    offset,
    summary,
  };
};

export const getRefundDetail = async (
  db: DatabaseClient,
  refundId: string,
): Promise<RefundDetailResponse> => {
  const refundRow = await db.get<Row>(
    `SELECT * FROM payment_refunds WHERE id = $1`,
    [refundId],
  );
  if (!refundRow) {
    throw new ApiError(
      404,
      ERROR_CODE.notFound,
      `Refund ${refundId} not found`,
    );
  }

  const refund = toRefund(refundRow);

  const paymentRow = await db.get<Row>(
    `SELECT id, status, amount_paise, currency, provider, provider_payment_id,
            provider_order_id, paid_at, created_at, billing_email, billing_name
     FROM payments WHERE id = $1`,
    [refund.paymentId],
  );

  const payment = paymentRow
    ? {
        id: String(paymentRow.id),
        status: String(paymentRow.status),
        amountPaise: Number(paymentRow.amount_paise),
        currency: String(paymentRow.currency),
        provider: String(paymentRow.provider),
        providerPaymentId: paymentRow.provider_payment_id
          ? String(paymentRow.provider_payment_id)
          : null,
        providerOrderId: paymentRow.provider_order_id
          ? String(paymentRow.provider_order_id)
          : null,
        paidAt: paymentRow.paid_at
          ? new Date(String(paymentRow.paid_at)).toISOString()
          : null,
        createdAt: new Date(String(paymentRow.created_at)).toISOString(),
        customerEmail: paymentRow.billing_email
          ? String(paymentRow.billing_email)
          : null,
        customerName: paymentRow.billing_name
          ? String(paymentRow.billing_name)
          : null,
      }
    : null;

  const auditRows = await db.all<Row>(
    `SELECT id, occurred_at, actor_user_id, actor_role, action, entity_type, entity_id, details, request_id
     FROM finance_audit_log
     WHERE entity_id = $1 OR entity_id = $2
     ORDER BY id DESC LIMIT 50`,
    [refund.id, refund.paymentId],
  );

  const auditEntries = auditRows.map(row => ({
    id: String(row.id),
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorRole: row.actor_role ? String(row.actor_role) : null,
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: row.entity_id ? String(row.entity_id) : null,
    details: (row.details ?? {}) as Record<string, unknown>,
    requestId: row.request_id ? String(row.request_id) : null,
  }));

  const mismatchRows = await db.all<Row>(
    `SELECT id, occurred_at, entity_id, details FROM finance_audit_log
     WHERE action = 'REFUND_EXCEPTION_RECORDED' AND entity_id = $1
     ORDER BY id DESC`,
    [refund.id],
  );

  const mismatches = mismatchRows.map(row => ({
    auditId: String(row.id),
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
    refundId: row.entity_id ? String(row.entity_id) : null,
    details: (row.details ?? {}) as Record<string, unknown>,
  }));

  return {
    refund,
    payment,
    auditEntries,
    mismatches,
  };
};

export const resolveRefundException = async (
  db: Database,
  gateway: PaymentGateway,
  refundId: string,
  actor: StaffActor,
  input: z.infer<typeof resolveRefundExceptionSchema>,
  now: Date,
): Promise<ResolveRefundExceptionResponse> => {
  // Step 1: Read initial refund and payment data (outside transaction; no lock held)
  const initialData = await db.get<Row>(
    `SELECT
       r.id, r.payment_id, r.amount_paise, r.currency, r.status,
       r.provider_refund_id, r.created_at, r.receipt,
       p.id AS payment_record_id,
       p.status AS payment_status,
       p.amount_paise AS payment_amount_paise,
       p.currency AS payment_currency,
       p.provider AS payment_provider,
       p.provider_payment_id
     FROM payment_refunds r
     JOIN payments p ON p.id = r.payment_id
     WHERE r.id = $1`,
    [refundId],
  );

  if (!initialData) {
    throw new ApiError(
      404,
      ERROR_CODE.notFound,
      `Refund ${refundId} not found`,
    );
  }

  if (initialData.status !== 'REQUIRES_REVIEW') {
    throw new ApiError(
      409,
      ERROR_CODE.paymentNotRefundable,
      `Refund ${refundId} is in status ${initialData.status}; only refunds in REQUIRES_REVIEW can be resolved`,
    );
  }

  const paymentProviderId = initialData.provider_payment_id
    ? String(initialData.provider_payment_id)
    : null;

  if (initialData.payment_provider !== 'RAZORPAY' || !paymentProviderId) {
    throw new ApiError(
      409,
      ERROR_CODE.paymentNotRefundable,
      `Refund ${refundId} is not associated with a captured Razorpay payment`,
    );
  }

  const expectedAmountPaise = Number(initialData.amount_paise);
  const expectedCurrency = String(initialData.currency);

  let verifiedProviderRefundId: string | null = null;
  let verifiedProviderStatus: string = '';
  let verifiedProviderAmountPaise: number = 0;

  const storedProviderRefundId = initialData.provider_refund_id
    ? String(initialData.provider_refund_id)
    : null;
  const internalReceipt = initialData.receipt
    ? String(initialData.receipt)
    : null;

  // A provider id already on record is the only one that can be used: a
  // different one is never accepted, so staff cannot point a refund at
  // another provider refund
  if (
    storedProviderRefundId &&
    input.providerRefundId &&
    input.providerRefundId !== storedProviderRefundId
  ) {
    throw new ApiError(
      409,
      ERROR_CODE.paymentVerificationFailed,
      `Provider refund ID ${input.providerRefundId} does not match the one already recorded for this refund`,
    );
  }
  const knownProviderRefundId =
    storedProviderRefundId ?? input.providerRefundId ?? null;

  // Every provider record is checked as a whole before anything is trusted:
  // its id, payment, amount, currency, status and, when we have a receipt,
  // that receipt. Without a stored id or a receipt there is nothing to tie
  // the provider's refund to this one.
  const verify = (candidate: ProviderRefund) => {
    const checked = validateRefundEvidence(candidate, {
      providerPaymentId: paymentProviderId,
      amountPaise: expectedAmountPaise,
      currency: expectedCurrency,
      receipt: internalReceipt,
      providerRefundId: knownProviderRefundId,
    });
    if (!checked.ok) {
      throw new ApiError(
        409,
        ERROR_CODE.paymentVerificationFailed,
        checked.problems[0].message,
      );
    }
    return checked.evidence;
  };

  const fetchKnown = async (providerRefundId: string) => {
    let found: ProviderRefund | null;
    try {
      found = await gateway.fetchRefund(providerRefundId);
    } catch {
      throw new ApiError(
        502,
        ERROR_CODE.paymentProviderUnavailable,
        'Payment provider is currently unavailable. Cannot verify refund status.',
      );
    }
    return found;
  };

  // A staff-supplied id alone proves nothing: it must be tied by the id on
  // record or by our receipt
  if (!storedProviderRefundId && !internalReceipt) {
    throw new ApiError(
      409,
      ERROR_CODE.paymentVerificationFailed,
      'Cannot verify this refund without a provider refund ID or receipt reference. Unreferenced refunds cannot be verified.',
    );
  }

  // Step 2: Authoritative Gateway Verification (NO DB LOCK HELD)
  if (input.action === 'CONFIRM_PROCESSED') {
    if (!knownProviderRefundId) {
      throw new ApiError(
        400,
        ERROR_CODE.requestValidationFailed,
        'A provider refund ID is required to confirm a refund as processed',
      );
    }

    const providerRefund = await fetchKnown(knownProviderRefundId);
    if (!providerRefund) {
      throw new ApiError(
        502,
        ERROR_CODE.paymentProviderUnavailable,
        `Refund ${knownProviderRefundId} could not be verified on Razorpay. Ensure the refund exists at the provider.`,
      );
    }

    const evidence = verify(providerRefund);
    if (evidence.status !== REFUND_STATUS.processed) {
      throw new ApiError(
        409,
        ERROR_CODE.paymentVerificationFailed,
        `Payment provider reports refund status as '${evidence.status}'. Only refunds confirmed as 'processed' by the provider can be resolved as PROCESSED.`,
      );
    }

    verifiedProviderRefundId = evidence.id;
    verifiedProviderStatus = evidence.status;
    verifiedProviderAmountPaise = evidence.amountPaise;
  } else {
    // Action: MARK_FAILED
    let candidateRefund: ProviderRefund | null = null;

    if (knownProviderRefundId) {
      candidateRefund = await fetchKnown(knownProviderRefundId);
      if (!candidateRefund) {
        throw new ApiError(
          409,
          ERROR_CODE.paymentVerificationFailed,
          `Cannot mark refund failed: provider refund ${knownProviderRefundId} was not found on Razorpay. Absence does not establish failure.`,
        );
      }
    } else {
      // Query refunds for the payment by receipt reference ONLY (never by amount alone)
      let paymentRefunds: ProviderRefund[] | null;
      try {
        paymentRefunds = await gateway.fetchPaymentRefunds(paymentProviderId);
      } catch {
        throw new ApiError(
          502,
          ERROR_CODE.paymentProviderUnavailable,
          'Payment provider is currently unavailable. Cannot verify refund status.',
        );
      }

      if (paymentRefunds === null) {
        throw new ApiError(
          502,
          ERROR_CODE.paymentProviderUnavailable,
          'Unable to read authoritative refund list from payment provider.',
        );
      }

      // Match strictly by receipt idempotency reference; exactly one
      const matches = paymentRefunds.filter(
        pr => typeof pr.receipt === 'string' && pr.receipt === internalReceipt,
      );

      if (matches.length === 0) {
        throw new ApiError(
          409,
          ERROR_CODE.paymentVerificationFailed,
          'Cannot mark refund failed: no matching refund found on provider with receipt. Absence from provider list does not establish failure; refund must remain in REQUIRES_REVIEW.',
        );
      }
      if (matches.length > 1) {
        throw new ApiError(
          409,
          ERROR_CODE.paymentVerificationFailed,
          'Cannot mark refund failed: more than one provider refund carries this receipt, so none can be trusted. Check the Razorpay dashboard.',
        );
      }

      candidateRefund = matches[0];
    }

    const evidence = verify(candidateRefund);
    if (evidence.status === REFUND_STATUS.processed) {
      throw new ApiError(
        409,
        ERROR_CODE.paymentVerificationFailed,
        `Cannot mark refund failed: payment provider reports refund ${evidence.id} is PROCESSED.`,
      );
    }
    if (evidence.status === REFUND_STATUS.pending) {
      throw new ApiError(
        409,
        ERROR_CODE.paymentVerificationFailed,
        `Cannot mark refund failed: payment provider reports refund ${evidence.id} is still PENDING.`,
      );
    }

    verifiedProviderRefundId = evidence.id;
    verifiedProviderStatus = evidence.status;
    verifiedProviderAmountPaise = evidence.amountPaise;
  }

  // A provider refund already tied to another refund record is never
  // accepted here (the unique index enforces the same under concurrency)
  const alreadyUsed = await db.get<Row>(
    'SELECT id FROM payment_refunds WHERE provider_refund_id = $1 AND id <> $2',
    [verifiedProviderRefundId, refundId],
  );
  if (alreadyUsed) {
    throw new ApiError(
      409,
      ERROR_CODE.paymentVerificationFailed,
      'The provider refund ID is already associated with another refund record',
    );
  }

  // Step 3: Database Transaction with Strict Lock Hierarchy (Payment first, Refund second)
  try {
    return await transaction(db, async tx => {
      // 1. Lock payment FIRST
      const paymentRow = await tx.get<Row>(
        `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
        [initialData.payment_id],
      );
      if (!paymentRow) {
        throw new ApiError(
          404,
          ERROR_CODE.notFound,
          'Associated payment not found',
        );
      }

      // 2. Lock refund SECOND
      const refundRow = await tx.get<Row>(
        `SELECT * FROM payment_refunds WHERE id = $1 FOR UPDATE`,
        [refundId],
      );
      if (!refundRow) {
        throw new ApiError(
          404,
          ERROR_CODE.notFound,
          `Refund ${refundId} not found`,
        );
      }

      // 3. Revalidate internal state under lock
      if (refundRow.status !== 'REQUIRES_REVIEW') {
        throw new ApiError(
          409,
          ERROR_CODE.paymentNotRefundable,
          `Refund ${refundId} status was modified to ${refundRow.status} by another process`,
        );
      }

      if (input.action === 'CONFIRM_PROCESSED') {
        const activeRefunds = await tx.get<{ sum: string }>(
          `SELECT COALESCE(SUM(amount_paise), 0) AS sum
           FROM payment_refunds
           WHERE payment_id = $1 AND status <> 'FAILED' AND id <> $2`,
          [initialData.payment_id, refundId],
        );
        const remainingPaise =
          Number(paymentRow.amount_paise) - Number(activeRefunds?.sum ?? 0);
        if (expectedAmountPaise > remainingPaise) {
          throw new ApiError(
            409,
            ERROR_CODE.refundExceedsRemaining,
            `Confirming this refund would exceed remaining captured amount (${remainingPaise} paise remaining)`,
          );
        }

        await tx.query(
          `UPDATE payment_refunds
           SET status = 'PROCESSED',
               processed_at = $2,
               provider_refund_id = $3,
               review_reason = NULL,
               updated_at = $2
           WHERE id = $1`,
          [refundId, now.toISOString(), verifiedProviderRefundId],
        );
      } else {
        // MARK_FAILED
        await tx.query(
          `UPDATE payment_refunds
           SET status = 'FAILED',
               failure_reason = $2,
               provider_refund_id = COALESCE($3, provider_refund_id),
               failed_at = $4,
               review_reason = NULL,
               updated_at = $4
           WHERE id = $1`,
          [refundId, input.notes, verifiedProviderRefundId, now.toISOString()],
        );
      }

      await recordAudit(tx, {
        actor,
        action: AUDIT_ACTION.refundExceptionResolved,
        entityType: 'PAYMENT_REFUND',
        entityId: refundId,
        details: {
          previousStatus: refundRow.status,
          resolutionAction: input.action,
          evidenceReference: input.evidenceReference,
          notes: input.notes,
          providerRefundId: verifiedProviderRefundId,
          verifiedProviderStatus,
          verifiedProviderAmountPaise,
        },
        at: now,
      });

      const updatedRow = await tx.get<Row>(
        `SELECT * FROM payment_refunds WHERE id = $1`,
        [refundId],
      );

      return {
        resolved: true,
        refund: toRefund(updatedRow!),
      };
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      const detail = 'detail' in error ? String(error.detail) : '';
      const message = 'message' in error ? String(error.message) : '';
      if (
        detail.includes('provider_refund_id') ||
        message.includes('provider_refund_id') ||
        message.includes('payment_refunds_provider')
      ) {
        throw new ApiError(
          409,
          ERROR_CODE.paymentVerificationFailed,
          'The provider refund ID is already associated with another refund record',
        );
      }
    }
    throw error;
  }
};
