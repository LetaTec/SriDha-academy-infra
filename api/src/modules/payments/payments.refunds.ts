import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import type { Refund, RefundRequestBody } from '../../contracts/finance.js';
import { transaction, type Row } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { logger } from '../../logging/logger.js';
import type { StaffActor } from '../auth/permissions.js';
import { AUDIT_ACTION, recordAudit } from '../finance/audit.service.js';
import { PAYMENT_PROVIDER, type PaymentGateway } from './gateway.js';
import { PAYMENT_STATUS } from './payments.lifecycle.js';
import {
  findPaymentByIdForUpdate,
  findRefundById,
  findRefundByRequestKey,
  insertRefund,
  sumActiveRefunds,
  lockRefundWithPayment,
  updateRefundFromProvider,
} from './payments.repository.js';
import {
  describeReported,
  REFUND_STATUS,
  validateRefundEvidence,
} from './refundEvidence.js';

// A refund finance staff start. Without an amount, everything not yet
// refunded is refunded. requestKey makes a repeated submission (a double
// click, a retried request) return the first refund instead of a second.
export const refundRequestSchema = z.strictObject({
  amountPaise: z.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(500),
  requestKey: z.uuid().optional(),
}) satisfies z.ZodType<RefundRequestBody>;

export const toRefund = (row: Row): Refund => ({
  id: String(row.id),
  paymentId: String(row.payment_id),
  amountPaise: Number(row.amount_paise),
  currency: String(row.currency),
  status: String(row.status) as Refund['status'],
  source: String(row.source) as Refund['source'],
  providerRefundId:
    row.provider_refund_id === null ? null : String(row.provider_refund_id),
  reason: row.reason === null ? null : String(row.reason),
  failureReason:
    row.failure_reason === null ? null : String(row.failure_reason),
  reviewReason: row.review_reason ? String(row.review_reason) : null,
  createdAt: new Date(String(row.created_at)).toISOString(),
});

// Records the refund (PENDING) with the payment row locked, so concurrent
// requests can never refund more than was captured; then asks Razorpay.
// The provider's answer is recorded truthfully: accepted (with its id),
// refused (FAILED, the amount is free again) or unanswered (still PENDING;
// the refund.created webhook or reconciliation settles it).
export const requestRefund = async (
  context: Pick<AppContext, 'db' | 'now'>,
  gateway: PaymentGateway,
  actor: StaffActor,
  paymentId: string,
  input: z.infer<typeof refundRequestSchema>,
): Promise<{ refund: Refund; created: boolean }> => {
  type Prepared =
    | { created: false; refund: Row }
    | { created: true; refund: Row; providerPaymentId: string };

  const prepared = await transaction<Prepared>(context.db, async tx => {
    if (input.requestKey) {
      const repeated = await findRefundByRequestKey(tx, input.requestKey);
      if (repeated) return { refund: repeated, created: false };
    }

    const payment = await findPaymentByIdForUpdate(tx, paymentId);
    if (!payment) {
      throw new ApiError(
        404,
        ERROR_CODE.paymentNotFound,
        'This payment does not exist',
      );
    }

    if (
      payment.status !== PAYMENT_STATUS.paid ||
      payment.provider !== PAYMENT_PROVIDER.razorpay ||
      payment.provider_payment_id === null
    ) {
      throw new ApiError(
        409,
        ERROR_CODE.paymentNotRefundable,
        'Only payments captured by Razorpay can be refunded',
      );
    }

    const remaining =
      Number(payment.amount_paise) - (await sumActiveRefunds(tx, paymentId));
    const amountPaise = input.amountPaise ?? remaining;
    if (amountPaise <= 0 || amountPaise > remaining) {
      throw new ApiError(
        409,
        ERROR_CODE.refundExceedsRemaining,
        'This refund is more than is left to refund on the payment',
        { remainingPaise: remaining },
      );
    }

    const id = randomUUID();
    const timestamp = context.now().toISOString();
    await insertRefund(tx, {
      id,
      paymentId,
      provider: String(payment.provider),
      providerRefundId: null,
      // Also sent as Razorpay's X-Refund-Idempotency key, so a retried
      // request never creates a second refund
      receipt: id.replace(/-/g, ''),
      requestKey: input.requestKey ?? null,
      amountPaise,
      currency: String(payment.currency),
      status: 'PENDING',
      reason: input.reason,
      source: 'FINANCE_ADMIN',
      requestedBy: actor.userId,
      timestamp,
    });
    await recordAudit(tx, {
      actor,
      action: AUDIT_ACTION.refundRequested,
      entityType: 'refund',
      entityId: id,
      details: { paymentId, amountPaise },
      at: context.now(),
    });

    const refund = await findRefundById(tx, id);
    return {
      refund: refund!,
      created: true,
      providerPaymentId: String(payment.provider_payment_id),
    };
  });

  if (!prepared.created) {
    return { refund: toRefund(prepared.refund), created: false };
  }

  const refundId = String(prepared.refund.id);
  const result = await gateway.createRefund({
    providerPaymentId: prepared.providerPaymentId,
    amountPaise: Number(prepared.refund.amount_paise),
    receipt: String(prepared.refund.receipt),
    notes: { refund_id: refundId, payment_id: paymentId },
  });

  // A refund Razorpay says it created is only believed when its record is
  // complete and describes this refund; otherwise it is treated as no answer
  // (reconciliation finds it by receipt) and recorded for a person
  const created =
    result.outcome === 'created'
      ? validateRefundEvidence(result.refund, {
          providerPaymentId: prepared.providerPaymentId,
          amountPaise: Number(prepared.refund.amount_paise),
          currency: String(prepared.refund.currency),
          receipt: String(prepared.refund.receipt),
        })
      : null;

  if (result.outcome === 'created' && created && !created.ok) {
    logger.error('payments.refund_creation_evidence_invalid', {
      refundId,
      paymentId,
      problems: created.problems.map(item => item.code),
    });
    await recordAudit(context.db, {
      actor,
      action: AUDIT_ACTION.refundException,
      entityType: 'refund',
      entityId: refundId,
      details: {
        field: created.problems[0].code,
        source: 'refund_creation',
        problems: created.problems.map(item => item.code),
        recorded: {
          paymentId,
          providerPaymentId: prepared.providerPaymentId,
          receipt: String(prepared.refund.receipt),
          amountPaise: Number(prepared.refund.amount_paise),
          currency: String(prepared.refund.currency),
        },
        reported: describeReported(result.refund),
      },
      at: context.now(),
    });
  } else if (result.outcome !== 'unknown') {
    // Payment row, then refund row: the same lock order as the webhook and
    // reconciliation paths
    await transaction(context.db, async tx => {
      await lockRefundWithPayment(tx, paymentId, refundId);
      await updateRefundFromProvider(
        tx,
        created?.ok
          ? {
              id: refundId,
              providerRefundId: created.evidence.id,
              status:
                created.evidence.status === REFUND_STATUS.processed
                  ? 'PROCESSED'
                  : created.evidence.status === REFUND_STATUS.failed
                    ? 'FAILED'
                    : 'PENDING',
              failureReason: null,
            }
          : {
              id: refundId,
              providerRefundId: null,
              status: 'FAILED',
              failureReason:
                result.outcome === 'rejected' ? result.reason : null,
            },
        context.now().toISOString(),
      );
    });
  }

  const current = await findRefundById(context.db, refundId);
  return { refund: toRefund(current!), created: true };
};
