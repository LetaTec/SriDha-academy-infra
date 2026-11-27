import { randomUUID } from 'node:crypto';

import type { AppContext } from '../../app/context.js';
import type { DatabaseClient } from '../../db/client.js';
import { logger } from '../../logging/logger.js';
import type {
  Mailer,
  PaymentConfirmation,
  PaymentFinanceCopy,
} from '../../mail/mailer.js';
import { findPaymentConfirmationRow } from '../payments/payments.repository.js';
import {
  claimOutboxEmails,
  failAbandonedOutboxEmails,
  insertOutboxEmail,
  markOutboxFailed,
  markOutboxRetry,
  markOutboxSent,
  type OutboxRow,
} from './outbox.repository.js';

export const MAX_OUTBOX_ATTEMPTS = 5;

// Claim timeout: if a worker stays in PROCESSING longer than 5 minutes
// (e.g. process was killed or network hung), another worker reclaims it
export const STALE_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

// Exponential retry delays: 15s, 1m, 5m, 15m, 1h
export const BACKOFF_DELAYS_MS = [
  15 * 1000,
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
] as const;

export const DEFAULT_BATCH_SIZE = 20;

export const TEMPLATE_PAYMENT_CONFIRMATION = 'payment_confirmation';
// The finance team's copy: its own template, subject and content
export const TEMPLATE_PAYMENT_FINANCE_COPY = 'payment_finance_copy';

const FINANCE_KEY_MARKER = ':finance:';

// Sends one outbox row with the mailer method its template names. Finance
// copies queued before they had their own template were stored as payment
// confirmations; their idempotency key (…:finance:<email>) identifies them,
// so they too go out as finance copies, never as the student's email.
const sendOutboxRow = (
  mailer: Mailer,
  row: Pick<OutboxRow, 'template' | 'recipient' | 'payload'> & {
    idempotencyKey: string;
  },
) => {
  const options = { idempotencyKey: row.idempotencyKey };
  const isLegacyFinanceCopy =
    row.template === TEMPLATE_PAYMENT_CONFIRMATION &&
    row.idempotencyKey.includes(FINANCE_KEY_MARKER);
  if (row.template === TEMPLATE_PAYMENT_FINANCE_COPY || isLegacyFinanceCopy) {
    const payload = row.payload as unknown as PaymentFinanceCopy;
    return mailer.sendPaymentFinanceCopy(
      row.recipient,
      {
        fullName: payload.fullName,
        topic: payload.topic,
        batch: payload.batch,
        amount: payload.amount,
        paymentReference: payload.paymentReference,
      },
      options,
    );
  }
  if (row.template === TEMPLATE_PAYMENT_CONFIRMATION) {
    return mailer.sendPaymentConfirmation(
      row.recipient,
      row.payload as unknown as PaymentConfirmation,
      options,
    );
  }
  throw new Error(`Unknown email template: "${row.template}"`);
};

const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Sanitizes error messages for storing in outbox table and logging:
// removes bearer tokens, passwords, and truncates to 500 characters
// Logs keep the domain and first letter only: enough to trace a delivery,
// not a list of customers' addresses
export const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return domain ? `${local.slice(0, 1)}***@${domain}` : '***';
};

export const sanitizeErrorMessage = (error: unknown): string => {
  if (!error) return 'Unknown error';
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  return raw
    .replace(/bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/key=[A-Za-z0-9._~+/-]+=*/gi, 'key=[REDACTED]')
    .slice(0, 500);
};

// Enqueues payment confirmation emails within the caller's active database
// transaction. Customer confirmation and company finance-copy deliveries
// are configured separately. Idempotency keys prevent duplicate rows.
export const enqueuePaymentConfirmationEmails = async (
  tx: DatabaseClient,
  params: {
    paymentId: string;
    webOrigin: string;
    financeEmails?: readonly string[];
    timestamp: string;
  },
): Promise<{ customerEnqueued: boolean; financeEnqueuedCount: number }> => {
  const row = await findPaymentConfirmationRow(tx, params.paymentId);
  if (!row) return { customerEnqueued: false, financeEnqueuedCount: 0 };

  const payload: PaymentConfirmation = {
    fullName: String(row.billing_name),
    topic: String(row.topic_title),
    batch: row.batch_name === null ? null : String(row.batch_name),
    amount: formatRupees(Number(row.amount_paise)),
    paymentReference: String(row.provider_payment_id ?? row.id),
    topicsUrl: `${params.webOrigin}/topics`,
  };

  const subject = `Payment received: ${row.topic_title}`;
  // The finance copy carries no student-facing link
  const financeCopy: PaymentFinanceCopy = {
    fullName: payload.fullName,
    topic: payload.topic,
    batch: payload.batch,
    amount: payload.amount,
    paymentReference: payload.paymentReference,
  };
  const now = new Date(params.timestamp);

  // 1. Customer confirmation email
  const customerId = await insertOutboxEmail(tx, {
    id: `outbox_${randomUUID()}`,
    recipient: String(row.billing_email),
    subject,
    template: TEMPLATE_PAYMENT_CONFIRMATION,
    payload: payload as unknown as Record<string, unknown>,
    idempotencyKey: `payment_confirmation:${params.paymentId}:customer`,
    createdAt: now,
    nextAttemptAt: now,
  });

  // 2. Company finance-copy deliveries (if configured)
  let financeCount = 0;
  const financeEmails = params.financeEmails ?? [];
  for (const financeEmail of financeEmails) {
    const normalised = financeEmail.trim().toLowerCase();
    if (!normalised) continue;
    const inserted = await insertOutboxEmail(tx, {
      id: `outbox_${randomUUID()}`,
      recipient: normalised,
      subject: `[Finance] ${subject} (${financeCopy.amount})`,
      template: TEMPLATE_PAYMENT_FINANCE_COPY,
      payload: financeCopy as unknown as Record<string, unknown>,
      idempotencyKey: `payment_confirmation:${params.paymentId}:finance:${normalised}`,
      createdAt: now,
      nextAttemptAt: now,
    });
    if (inserted) financeCount += 1;
  }

  return {
    customerEnqueued: Boolean(customerId),
    financeEnqueuedCount: financeCount,
  };
};

export type ProcessOutboxResult = {
  claimed: number;
  sent: number;
  failed: number;
  retried: number;
};

// Claims and dispatches pending outbox emails. Atomic claim mechanism
// ensures safety across concurrent workers.
export const processEmailOutbox = async (
  context: Pick<AppContext, 'db' | 'mailer' | 'now'>,
  options: {
    limit?: number;
    staleTimeoutMs?: number;
  } = {},
): Promise<ProcessOutboxResult> => {
  const result: ProcessOutboxResult = {
    claimed: 0,
    sent: 0,
    failed: 0,
    retried: 0,
  };

  if (!context.mailer) {
    logger.warn('mail.not_configured', {
      context: 'outbox_worker',
      effect: 'pending emails remain in outbox until mailer is configured',
    });
    return result;
  }

  const limit = options.limit ?? DEFAULT_BATCH_SIZE;
  const staleTimeoutMs = options.staleTimeoutMs ?? STALE_PROCESSING_TIMEOUT_MS;

  const abandoned = await failAbandonedOutboxEmails(
    context.db,
    context.now(),
    staleTimeoutMs,
    MAX_OUTBOX_ATTEMPTS,
  );
  if (abandoned > 0) {
    logger.error('mail.outbox_abandoned', { count: abandoned });
  }

  const rows: OutboxRow[] = await claimOutboxEmails(
    context.db,
    context.now(),
    limit,
    staleTimeoutMs,
    MAX_OUTBOX_ATTEMPTS,
  );
  result.claimed = rows.length;

  for (const row of rows) {
    const claimToken = String(row.claim_token);
    const recipient = maskEmail(row.recipient);

    try {
      // The same key on every attempt: if an earlier attempt reached the
      // provider, it delivers nothing new
      await sendOutboxRow(context.mailer, {
        template: row.template,
        recipient: row.recipient,
        payload: row.payload,
        idempotencyKey: row.idempotency_key ?? row.id,
      });
    } catch (error) {
      const sanitizedError = sanitizeErrorMessage(error);
      const isExhausted = row.attempts >= MAX_OUTBOX_ATTEMPTS;

      if (isExhausted) {
        await markOutboxFailed(
          context.db,
          row.id,
          claimToken,
          sanitizedError,
          context.now(),
        );
        result.failed += 1;
        logger.error('mail.outbox_exhausted', {
          id: row.id,
          recipient,
          template: row.template,
          attempts: row.attempts,
          error: sanitizedError,
        });
      } else {
        const backoffMs =
          BACKOFF_DELAYS_MS[
            Math.min(row.attempts - 1, BACKOFF_DELAYS_MS.length - 1)
          ];
        const nextAttemptAt = new Date(context.now().getTime() + backoffMs);
        await markOutboxRetry(
          context.db,
          row.id,
          claimToken,
          nextAttemptAt,
          sanitizedError,
          context.now(),
        );
        result.retried += 1;
        logger.warn('mail.outbox_retry_scheduled', {
          id: row.id,
          recipient,
          attempts: row.attempts,
          nextAttemptAt: nextAttemptAt.toISOString(),
          error: sanitizedError,
        });
      }
      continue;
    }

    // The provider accepted it. If recording that fails, the email stays
    // claimed; after the stale timeout it is sent again with the same key,
    // which the provider recognises, so the customer gets it once.
    try {
      const recorded = await markOutboxSent(
        context.db,
        row.id,
        claimToken,
        context.now(),
      );
      if (recorded) {
        result.sent += 1;
        logger.info('mail.outbox_sent', {
          id: row.id,
          recipient,
          template: row.template,
          attempts: row.attempts,
        });
      } else {
        logger.warn('mail.outbox_claim_lost', { id: row.id });
      }
    } catch (error) {
      logger.error('mail.outbox_record_sent_failed', {
        id: row.id,
        error: sanitizeErrorMessage(error),
      });
    }
  }

  return result;
};
