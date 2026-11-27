import { z } from 'zod';

import type {
  PaymentException,
  PaymentExceptionKind,
  PaymentExceptionResolution,
  ResolvePaymentExceptionRequest,
} from '../../contracts/finance.js';
import {
  transaction,
  type Database,
  type DatabaseClient,
  type Row,
} from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { logger } from '../../logging/logger.js';
import { setEnrolmentStatus } from '../enrolments/enrolments.repository.js';
import { ENROLMENT_STATUS } from '../enrolments/enrolments.service.js';
import { AUDIT_ACTION, recordAudit } from './audit.service.js';
import { enqueuePaymentConfirmationEmails } from '../outbox/outbox.service.js';
import {
  BATCH_AVAILABILITY,
  countActiveEnrolmentsForBatch,
  lockBatchRow,
  resolveBatchAvailability,
  toDateOnly,
} from '../catalogue/catalogue.repository.js';
import {
  findBatchIdOfEnrolment,
  findEnrolmentStatusForUpdate,
  findPaymentExceptionForUpdate,
  findPaymentExceptionRow,
  listPaymentExceptionRows,
  lockPayment,
  markPaymentExceptionResolved,
  sumRefunds,
} from './paymentExceptions.repository.js';

// Finance staff resolve each payment exception once, with a note, and the
// resolution is audited. Nothing here moves money: a refund is made with
// the existing refund workflow first, and "REFUNDED" checks that Razorpay
// has processed it in full (the resolution can never be changed, so a
// refund still pending, which could fail, is not enough). "SEAT_CONFIRMED"
// is a deliberate decision to seat a student in a batch that was full when
// the payment arrived: only for that kind, only while the seat is still
// unconfirmed and nothing has been refunded, and it sends the student
// (and finance) the usual confirmation.

const RESOLUTIONS = ['REFUNDED', 'SEAT_CONFIRMED', 'NO_ACTION'] as const;

export const resolvePaymentExceptionSchema = z.strictObject({
  resolution: z.enum(RESOLUTIONS),
  note: z.string().trim().min(3, 'Explain what was done').max(1000),
}) satisfies z.ZodType<ResolvePaymentExceptionRequest>;

export const listPaymentExceptionsQuery = z.strictObject({
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const toIso = (value: unknown) =>
  value === null || value === undefined
    ? null
    : new Date(String(value)).toISOString();

const toPaymentException = (row: Row): PaymentException => ({
  id: String(row.id),
  paymentId: String(row.payment_id),
  providerPaymentId:
    row.provider_payment_id === null ? null : String(row.provider_payment_id),
  kind: String(row.kind) as PaymentExceptionKind,
  status: String(row.status) as PaymentException['status'],
  details: (row.details ?? {}) as Record<string, unknown>,
  createdAt: toIso(row.created_at)!,
  amountPaise: Number(row.amount_paise),
  buyerEmail: row.billing_email === null ? null : String(row.billing_email),
  itemDescription:
    row.item_description === null ? null : String(row.item_description),
  resolution:
    row.resolution === null
      ? null
      : (String(row.resolution) as PaymentExceptionResolution),
  resolutionNote:
    row.resolution_note === null ? null : String(row.resolution_note),
  resolvedBy: row.resolved_by === null ? null : String(row.resolved_by),
  resolvedAt: toIso(row.resolved_at),
});

export const listPaymentExceptions = async (
  db: DatabaseClient,
  query: z.infer<typeof listPaymentExceptionsQuery>,
) =>
  (
    await listPaymentExceptionRows(
      db,
      query.status ?? null,
      query.limit,
      query.offset,
    )
  ).map(toPaymentException);

const invalidResolution = (message: string) =>
  new ApiError(400, ERROR_CODE.paymentExceptionResolutionInvalid, message);

export const resolvePaymentException = async (
  db: Database,
  id: string,
  actor: { userId: string; role: string },
  input: z.infer<typeof resolvePaymentExceptionSchema>,
  now: Date,
  emails: { webOrigin: string; financeEmails: readonly string[] },
): Promise<PaymentException> => {
  const timestamp = now.toISOString();
  await transaction(db, async tx => {
    // Lock the payment before anything else, as capture and refund
    // requests do, so a refund cannot be requested between the checks
    // below and the resolution
    const unlocked = await findPaymentExceptionRow(tx, id);
    if (unlocked) await lockPayment(tx, String(unlocked.payment_id));
    const row = await findPaymentExceptionForUpdate(tx, id);
    if (!row) {
      throw new ApiError(
        404,
        ERROR_CODE.paymentExceptionNotFound,
        'This payment exception does not exist',
      );
    }
    if (String(row.status) !== 'OPEN') {
      throw new ApiError(
        409,
        ERROR_CODE.paymentExceptionNotOpen,
        'This payment exception is already resolved',
      );
    }

    const paymentId = String(row.payment_id);
    const refunds = await sumRefunds(tx, paymentId);

    if (input.resolution === 'REFUNDED') {
      if (refunds.processed < Number(row.amount_paise)) {
        throw invalidResolution(
          'Refund the full payment from the refunds desk first, and resolve this once Razorpay reports the refund processed',
        );
      }
    }

    if (input.resolution === 'SEAT_CONFIRMED') {
      if (
        String(row.kind) !== 'CAPTURED_FOR_FULL_BATCH' ||
        row.enrolment_id === null
      ) {
        throw invalidResolution(
          'Only a payment for a batch that was full can have its seat confirmed',
        );
      }
      // The batch is locked like any seat change, and the seat must fit:
      // seating this student must not take the seat of someone holding
      // one now. To add a seat, raise the batch's capacity first.
      const enrolmentId = String(row.enrolment_id);
      const batchId = await findBatchIdOfEnrolment(tx, enrolmentId);
      const batch = batchId ? await lockBatchRow(tx, batchId) : null;
      const seatStatus = await findEnrolmentStatusForUpdate(tx, enrolmentId);
      if (seatStatus !== ENROLMENT_STATUS.pendingPayment) {
        throw invalidResolution(
          'This seat is no longer waiting for confirmation (another payment may have confirmed it); refund this payment instead',
        );
      }
      if (refunds.active > 0) {
        throw invalidResolution(
          'This payment has a refund; a refunded payment cannot also confirm a seat',
        );
      }
      const taken = batch
        ? await countActiveEnrolmentsForBatch(
            tx,
            String(batch.id),
            now,
            enrolmentId,
          )
        : 0;
      // The same rule as checkout and capture: open, not started, and room
      // for this seat among everyone else's
      const availability = batch
        ? resolveBatchAvailability(batch, taken, toDateOnly(now))
        : BATCH_AVAILABILITY.inactive;
      if (availability === BATCH_AVAILABILITY.full) {
        throw invalidResolution(
          'The batch is still full (confirmed seats and live holds). Raise its capacity first to add a seat',
        );
      }
      if (availability !== BATCH_AVAILABILITY.open) {
        throw invalidResolution(
          'The batch is no longer open (inactive, upcoming or already started); refund this payment instead',
        );
      }
      await setEnrolmentStatus(
        tx,
        String(row.enrolment_id),
        ENROLMENT_STATUS.confirmed,
        timestamp,
      );
      await enqueuePaymentConfirmationEmails(tx, {
        paymentId,
        webOrigin: emails.webOrigin,
        financeEmails: emails.financeEmails,
        timestamp,
      });
    }

    await markPaymentExceptionResolved(tx, {
      id,
      resolution: input.resolution,
      note: input.note,
      resolvedBy: actor.userId,
      resolvedAt: timestamp,
    });
    await recordAudit(tx, {
      actor,
      action: AUDIT_ACTION.paymentExceptionResolved,
      entityType: 'payment_exception',
      entityId: id,
      details: {
        paymentId: String(row.payment_id),
        kind: String(row.kind),
        resolution: input.resolution,
      },
      at: now,
    });
  });

  logger.info('finance.payment_exception_resolved', {
    exceptionId: id,
    resolution: input.resolution,
  });
  const resolved = await findPaymentExceptionRow(db, id);
  return toPaymentException(resolved!);
};
