import type { AppContext } from '../../app/context.js';
import { transaction } from '../../db/client.js';
import { logger } from '../../logging/logger.js';
import { AUDIT_ACTION, recordAudit } from '../finance/audit.service.js';
import {
  PAYMENT_PROVIDER,
  type PaymentGateway,
  type ProviderRefund,
} from './gateway.js';
import {
  describeReported,
  exceptionField,
  REFUND_STATUS,
  validateRefundEvidence,
  type RefundEvidenceProblem,
} from './refundEvidence.js';
import {
  hasRefundExceptionFromSource,
  listPendingRefundsBefore,
  lockRefundWithPayment,
  markRefundRequiresReview,
  updateRefundFromProvider,
} from './payments.repository.js';

// Default threshold: pending refunds older than 30 minutes are polled
export const DEFAULT_PENDING_REFUND_THRESHOLD_MINUTES = 30;

// How long a refund may be missing from Razorpay's list before a person is
// asked to check. Absence never fails a refund: Razorpay's list can lag,
// and a refund marked failed while Razorpay processed it would free its
// amount for a second refund.
export const REFUND_ABSENCE_REVIEW_AFTER_MS = 24 * 60 * 60 * 1000;

const UNRESOLVED = ['PENDING', 'REQUIRES_REVIEW'];

// The same rule as migration 023: no leading or trailing whitespace, not blank
const CLEAN_PROVIDER_ID = /^\S([\s\S]*\S)?$/;
const LEGACY_INVALID_ID_SOURCE = 'legacy_invalid_provider_id';

export type ReconcileRefundsOptions = {
  olderThanMinutes?: number;
};

export type ReconcileRefundsResult = {
  processed: number;
  failed: number;
  pending: number;
  // Newly flagged for a person to check (not found at Razorpay)
  needsReview: number;
  skipped: number;
};

/**
 * Reconciles refunds that have stayed in PENDING status.
 * Queries Razorpay for their authoritative state and settles them
 * as PROCESSED or FAILED, with immutable audit logging.
 */
export const reconcilePendingRefunds = async (
  context: Pick<AppContext, 'db' | 'now'>,
  gateway: PaymentGateway,
  options: ReconcileRefundsOptions = {},
): Promise<ReconcileRefundsResult> => {
  if (gateway.provider !== PAYMENT_PROVIDER.razorpay) {
    return { processed: 0, failed: 0, pending: 0, needsReview: 0, skipped: 0 };
  }

  const olderThanMinutes =
    options.olderThanMinutes ?? DEFAULT_PENDING_REFUND_THRESHOLD_MINUTES;
  const now = context.now();
  const cutoff = new Date(now.getTime() - olderThanMinutes * 60 * 1000);

  const pendingRefunds = await listPendingRefundsBefore(
    context.db,
    cutoff.toISOString(),
  );

  const result: ReconcileRefundsResult = {
    processed: 0,
    failed: 0,
    pending: 0,
    needsReview: 0,
    skipped: 0,
  };

  for (const candidate of pendingRefunds) {
    const refundId = String(candidate.id);
    const paymentId = String(candidate.payment_id);
    const providerRefundId =
      candidate.provider_refund_id === null
        ? null
        : String(candidate.provider_refund_id);
    const receipt =
      candidate.receipt === null ? null : String(candidate.receipt);
    const providerPaymentId =
      candidate.provider_payment_id === null
        ? null
        : String(candidate.provider_payment_id);

    // A provider id stored before migration 023 may be blank or padded. The
    // database now refuses any change to such a row, so it can never be
    // settled here. It is never rewritten or guessed at: it is recorded once
    // for finance, and its amount stays reserved.
    if (
      providerRefundId !== null &&
      !CLEAN_PROVIDER_ID.test(providerRefundId)
    ) {
      try {
        const recorded = await transaction(context.db, async tx => {
          const locked = await lockRefundWithPayment(tx, paymentId, refundId);
          if (
            !locked ||
            (await hasRefundExceptionFromSource(
              tx,
              refundId,
              LEGACY_INVALID_ID_SOURCE,
            ))
          ) {
            return false;
          }
          await recordAudit(tx, {
            actor: null,
            action: AUDIT_ACTION.refundException,
            entityType: 'refund',
            entityId: refundId,
            details: {
              field: 'provider_refund_id',
              source: LEGACY_INVALID_ID_SOURCE,
              reason:
                'This refund has a blank or padded provider refund ID from before it was refused. It cannot be settled automatically and its amount stays reserved. Check the Razorpay dashboard and resolve it by hand.',
              recorded: {
                paymentId,
                providerRefundId: describeReported({ id: providerRefundId })
                  .providerRefundId,
                status: String(locked.status),
                amountPaise: Number(candidate.amount_paise),
              },
            },
            at: now,
          });
          return true;
        });
        if (recorded) {
          logger.error('payments.refund_legacy_invalid_provider_id', {
            refundId,
            paymentId,
          });
        }
      } catch (error) {
        logger.error('payments.refund_reconcile_item_failed', {
          refundId,
          error,
        });
      }
      result.skipped += 1;
      continue;
    }

    try {
      let providerRefund: ProviderRefund | null = null;
      let notFoundOnProvider = false;
      let ambiguousMatches: ProviderRefund[] | null = null;

      if (providerRefundId) {
        // Known provider refund id: fetch directly
        providerRefund = await gateway.fetchRefund(providerRefundId);
        if (!providerRefund) {
          logger.warn('payments.refund_reconcile_fetch_failed', {
            refundId,
            providerRefundId,
          });
          result.skipped += 1;
          continue;
        }
      } else if (providerPaymentId) {
        // Unknown provider refund id (e.g. timeout on creation):
        // fetch all refunds on the payment and locate by unique receipt
        const providerRefunds =
          await gateway.fetchPaymentRefunds(providerPaymentId);
        if (providerRefunds === null) {
          logger.warn(
            'payments.refund_reconcile_payment_refunds_fetch_failed',
            {
              refundId,
              providerPaymentId,
            },
          );
          result.skipped += 1;
          continue;
        }

        const matches = receipt
          ? providerRefunds.filter(item => item.receipt === receipt)
          : [];

        if (matches.length > 1) {
          // Our receipt is an idempotency key: two refunds under it cannot be
          // told apart, so neither is trusted
          ambiguousMatches = matches;
        } else if (matches.length === 1) {
          providerRefund = matches[0];
        } else {
          // Provider answered with the full list of refunds for this payment,
          // and this refund is not present. It was never created on Razorpay.
          notFoundOnProvider = true;
        }
      } else {
        result.skipped += 1;
        continue;
      }

      const fieldOf = (code: string) =>
        exceptionField(code as RefundEvidenceProblem['code']);
      const flagForReview = async (
        problems: Array<{ code: string; message: string }>,
        reportedRefunds: ProviderRefund[],
      ) => {
        const flagged = await transaction(context.db, async tx => {
          const locked = await lockRefundWithPayment(tx, paymentId, refundId);
          // Already waiting for a person: recorded when it was flagged, and
          // not recorded again every hour
          if (!locked || locked.status !== 'PENDING') return false;
          await markRefundRequiresReview(
            tx,
            {
              id: refundId,
              reason: `Razorpay's record of this refund cannot be trusted: ${problems.map(item => item.message).join('; ')}. Check the Razorpay dashboard; the amount stays reserved.`,
            },
            now.toISOString(),
          );
          await recordAudit(tx, {
            actor: null,
            action: AUDIT_ACTION.refundException,
            entityType: 'refund',
            entityId: refundId,
            details: {
              field: fieldOf(problems[0].code),
              source: 'reconciliation',
              problems: problems.map(item => item.code),
              recorded: {
                paymentId,
                providerPaymentId,
                providerRefundId,
                receipt,
                amountPaise: Number(candidate.amount_paise),
                currency: String(candidate.currency),
              },
              reported: reportedRefunds.slice(0, 5).map(describeReported),
            },
            at: now,
          });
          return true;
        });
        if (flagged) {
          result.needsReview += 1;
          logger.error('payments.refund_mismatch', {
            refundId,
            paymentId,
            field: fieldOf(problems[0].code),
          });
        } else {
          result.skipped += 1;
        }
      };

      if (ambiguousMatches) {
        await flagForReview(
          [
            {
              code: 'receipt_ambiguous',
              message: 'More than one Razorpay refund carries this receipt',
            },
          ],
          ambiguousMatches,
        );
        continue;
      }

      if (notFoundOnProvider) {
        const age =
          now.getTime() - new Date(String(candidate.created_at)).getTime();
        if (age < REFUND_ABSENCE_REVIEW_AFTER_MS) {
          result.pending += 1;
          continue;
        }

        const flagged = await transaction(context.db, async tx => {
          const locked = await lockRefundWithPayment(tx, paymentId, refundId);
          if (!locked || locked.status !== 'PENDING') return false;

          await markRefundRequiresReview(
            tx,
            {
              id: refundId,
              reason:
                'Not found at Razorpay a day after the request. Check the Razorpay dashboard before refunding again; the amount stays reserved.',
            },
            now.toISOString(),
          );
          await recordAudit(tx, {
            actor: null,
            action: AUDIT_ACTION.refundRecorded,
            entityType: 'refund',
            entityId: refundId,
            details: {
              paymentId,
              providerRefundId: null,
              amountPaise: Number(candidate.amount_paise),
              status: 'REQUIRES_REVIEW',
              reconciled: true,
              reason: 'Not found on payment provider',
            },
            at: now,
          });
          return true;
        });

        if (flagged) {
          result.needsReview += 1;
          logger.error('payments.refund_requires_review', {
            refundId,
            paymentId,
          });
        } else {
          result.pending += 1;
        }
        continue;
      }

      if (!providerRefund) {
        result.skipped += 1;
        continue;
      }

      // Nothing settles a refund on evidence that is incomplete or does not
      // describe this refund exactly: the provider's ids, payment, amount,
      // currency, status and receipt must all check out. Anything else keeps
      // the amount reserved and goes to a person, once.
      const checked = validateRefundEvidence(providerRefund, {
        // Without our own provider payment id the linkage cannot be proven
        providerPaymentId: providerPaymentId ?? '',
        amountPaise: Number(candidate.amount_paise),
        currency: String(candidate.currency),
        receipt,
        providerRefundId,
      });
      if (!checked.ok) {
        await flagForReview(checked.problems, [providerRefund]);
        continue;
      }
      const evidence = checked.evidence;
      const status = evidence.status;

      if (status === REFUND_STATUS.processed) {
        const updated = await transaction(context.db, async tx => {
          const locked = await lockRefundWithPayment(tx, paymentId, refundId);
          if (!locked || !UNRESOLVED.includes(String(locked.status)))
            return false;
          // Another path may have stored an id meanwhile; it must be this one
          if (
            locked.provider_refund_id !== null &&
            String(locked.provider_refund_id) !== evidence.id
          ) {
            return false;
          }

          const timestamp = now.toISOString();
          await updateRefundFromProvider(
            tx,
            {
              id: refundId,
              providerRefundId: evidence.id,
              status: 'PROCESSED',
              failureReason: null,
            },
            timestamp,
          );

          await recordAudit(tx, {
            actor: null,
            action: AUDIT_ACTION.refundRecorded,
            entityType: 'refund',
            entityId: refundId,
            details: {
              paymentId,
              providerRefundId: evidence.id,
              amountPaise: Number(candidate.amount_paise),
              status: 'PROCESSED',
              reconciled: true,
            },
            at: now,
          });

          return true;
        });

        if (updated) {
          result.processed += 1;
        } else {
          result.skipped += 1;
        }
      } else if (status === REFUND_STATUS.failed) {
        const updated = await transaction(context.db, async tx => {
          const locked = await lockRefundWithPayment(tx, paymentId, refundId);
          if (!locked || !UNRESOLVED.includes(String(locked.status)))
            return false;
          // Another path may have stored an id meanwhile; it must be this one
          if (
            locked.provider_refund_id !== null &&
            String(locked.provider_refund_id) !== evidence.id
          ) {
            return false;
          }

          const timestamp = now.toISOString();
          await updateRefundFromProvider(
            tx,
            {
              id: refundId,
              providerRefundId: evidence.id,
              status: 'FAILED',
              failureReason: 'Payment provider reported refund failed',
            },
            timestamp,
          );

          await recordAudit(tx, {
            actor: null,
            action: AUDIT_ACTION.refundRecorded,
            entityType: 'refund',
            entityId: refundId,
            details: {
              paymentId,
              providerRefundId: evidence.id,
              amountPaise: Number(candidate.amount_paise),
              status: 'FAILED',
              reconciled: true,
            },
            at: now,
          });

          return true;
        });

        if (updated) {
          result.failed += 1;
        } else {
          result.skipped += 1;
        }
      } else if (status === REFUND_STATUS.pending) {
        // If provider refund ID was missing, persist it
        if (!providerRefundId) {
          await transaction(context.db, async tx => {
            const locked = await lockRefundWithPayment(tx, paymentId, refundId);
            if (!locked || !UNRESOLVED.includes(String(locked.status))) return;
            await updateRefundFromProvider(
              tx,
              {
                id: refundId,
                providerRefundId: evidence.id,
                status: 'PENDING',
                failureReason: null,
              },
              now.toISOString(),
            );
          });
        }
        result.pending += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      logger.error('payments.refund_reconcile_item_failed', {
        refundId,
        error,
      });
      result.skipped += 1;
    }
  }

  logger.info('jobs.refund_reconciliation_finished', result);
  return result;
};
