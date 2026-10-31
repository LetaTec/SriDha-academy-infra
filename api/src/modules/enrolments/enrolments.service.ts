import { randomUUID } from 'node:crypto';

import type { AppContext } from '../../app/context.js';
import type { Enrolment, SeatStatus } from '../../contracts/payments.js';
import { transaction } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import {
  BATCH_AVAILABILITY,
  countActiveEnrolmentsForBatch,
  getBatchRow,
  listTopicLessons,
  resolveBatchAvailability,
  toBatch,
  toDateOnly,
  toLesson,
  toTopicSummary,
} from '../catalogue/catalogue.repository.js';
import {
  findEnrolmentForBatch,
  insertEnrolment,
  listEnrolmentRows,
  setEnrolmentStatus,
} from './enrolments.repository.js';

export const ENROLMENT_STATUS = {
  pendingPayment: 'PENDING_PAYMENT',
  confirmed: 'CONFIRMED',
  cancelled: 'CANCELLED',
} as const satisfies Record<string, SeatStatus>;

export type { Enrolment };

const loadEnrolments = async (
  { db, now }: AppContext,
  userId: string,
  enrolmentId?: string,
): Promise<Enrolment[]> => {
  const today = toDateOnly(now());
  const rows = await listEnrolmentRows(db, userId, enrolmentId ?? null);

  return Promise.all(
    rows.map(async row => {
      const [lessons, taken] = await Promise.all([
        listTopicLessons(db, String(row.t_id)),
        countActiveEnrolmentsForBatch(db, String(row.id), now()),
      ]);

      return {
        id: String(row.enrolment_id),
        status: row.enrolment_status as Enrolment['status'],
        createdAt: String(row.enrolment_created_at),
        subject: {
          id: String(row.s_id),
          slug: String(row.s_slug),
          name: String(row.s_name),
        },
        topic: {
          ...toTopicSummary({
            id: row.t_id,
            title: row.t_title,
            short_title: row.t_short_title,
            summary: row.t_summary,
            level: row.t_level,
            icon: row.t_icon,
            featured_rank: row.t_featured_rank,
            price_paise: row.t_price_paise,
            price_tax_label: row.t_price_tax_label,
          }),
          lessons: lessons.map(toLesson),
        },
        batch: toBatch(row, taken, today),
      };
    }),
  );
};

export const listEnrolments = async (context: AppContext, userId: string) =>
  loadEnrolments(context, userId);

// Starts an unpaid seat for checkout; only the payments module calls this.
export const createEnrolment = async (
  context: AppContext,
  userId: string,
  batchId: string,
): Promise<Enrolment> => {
  const { db } = context;
  const timestamp = context.now().toISOString();

  // Check availability and insert inside one write transaction so two students
  // cannot take the last seat at the same time.
  const enrolmentId = await transaction(db, async tx => {
    const batch = await getBatchRow(tx, batchId);

    if (!batch) {
      throw new ApiError(
        404,
        ERROR_CODE.batchNotFound,
        'This batch no longer exists',
      );
    }

    const existing = await findEnrolmentForBatch(tx, userId, batchId);

    if (existing && existing.status !== ENROLMENT_STATUS.cancelled) {
      throw new ApiError(
        409,
        ERROR_CODE.alreadyEnrolled,
        'You have already selected this batch',
        { enrolmentId: String(existing.id) },
      );
    }

    const activeEnrolments = await countActiveEnrolmentsForBatch(
      tx,
      batchId,
      context.now(),
    );
    const availability = resolveBatchAvailability(
      batch,
      activeEnrolments,
      toDateOnly(context.now()),
    );

    if (availability === BATCH_AVAILABILITY.full) {
      throw new ApiError(409, ERROR_CODE.batchFull, 'This batch is full', {
        availability,
      });
    }

    if (availability !== BATCH_AVAILABILITY.open) {
      throw new ApiError(
        409,
        ERROR_CODE.batchUnavailable,
        'This batch is not open for enrolment',
        { availability },
      );
    }

    if (existing) {
      await setEnrolmentStatus(
        tx,
        String(existing.id),
        ENROLMENT_STATUS.pendingPayment,
        timestamp,
      );
      return String(existing.id);
    }

    const id = randomUUID();
    await insertEnrolment(tx, {
      id,
      userId,
      batchId,
      status: ENROLMENT_STATUS.pendingPayment,
      timestamp,
    });
    return id;
  });

  const [enrolment] = await loadEnrolments(context, userId, enrolmentId);

  if (!enrolment) {
    throw new Error(`Enrolment ${enrolmentId} could not be loaded`);
  }

  return enrolment;
};
