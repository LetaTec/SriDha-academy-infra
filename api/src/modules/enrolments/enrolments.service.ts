import { randomUUID } from 'node:crypto';

import type { AppContext } from '../../app/context.js';
import { transaction } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import {
  BATCH_AVAILABILITY,
  countActiveEnrolmentsForBatch,
  getBatchRow,
  resolveBatchAvailability,
  toBatch,
  toDateOnly,
  toLesson,
  toTopicSummary,
  type Batch,
  type Lesson,
  type Price,
  type Row,
} from '../catalogue/catalogue.repository.js';

export const ENROLMENT_STATUS = {
  pendingPayment: 'PENDING_PAYMENT',
  confirmed: 'CONFIRMED',
  cancelled: 'CANCELLED',
} as const;

export type Enrolment = {
  id: string;
  status: (typeof ENROLMENT_STATUS)[keyof typeof ENROLMENT_STATUS];
  createdAt: string;
  subject: { id: string; slug: string; name: string };
  topic: {
    id: string;
    title: string;
    summary: string;
    level: string | null;
    price: Price | null;
    lessons: Lesson[];
  };
  batch: Batch;
};

const loadEnrolments = async (
  { db, now }: AppContext,
  userId: string,
  enrolmentId?: string,
): Promise<Enrolment[]> => {
  const today = toDateOnly(now());
  const rows = await db.all<Row>(
    `SELECT e.id AS enrolment_id, e.status AS enrolment_status, e.created_at AS enrolment_created_at,
            b.*, t.id AS t_id, t.title AS t_title, t.summary AS t_summary, t.level AS t_level,
            t.price_paise AS t_price_paise, t.price_tax_label AS t_price_tax_label,
            s.id AS s_id, s.slug AS s_slug, s.name AS s_name
     FROM enrolments e
     JOIN batches b ON b.id = e.batch_id
     JOIN topics t ON t.id = b.topic_id
     JOIN chapters c ON c.id = t.chapter_id
     JOIN subjects s ON s.id = c.subject_id
     WHERE e.user_id = $1 AND e.status <> 'CANCELLED' AND ($2::text IS NULL OR e.id = $2::text)
     ORDER BY e.created_at DESC`,
    [userId, enrolmentId ?? null],
  );

  return Promise.all(
    rows.map(async row => {
      const [lessons, taken] = await Promise.all([
        db.all('SELECT * FROM lessons WHERE topic_id = $1 ORDER BY position', [
          row.t_id,
        ]),
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
            summary: row.t_summary,
            level: row.t_level,
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

    const existing = await tx.get<{ id: string; status: string }>(
      'SELECT id, status FROM enrolments WHERE user_id = $1 AND batch_id = $2',
      [userId, batchId],
    );

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
      await tx.query(
        'UPDATE enrolments SET status = $1, updated_at = $2 WHERE id = $3',
        [ENROLMENT_STATUS.pendingPayment, timestamp, String(existing.id)],
      );
      return String(existing.id);
    }

    const id = randomUUID();
    await tx.query(
      `INSERT INTO enrolments (id, user_id, batch_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        userId,
        batchId,
        ENROLMENT_STATUS.pendingPayment,
        timestamp,
        timestamp,
      ],
    );
    return id;
  });

  const [enrolment] = await loadEnrolments(context, userId, enrolmentId);

  if (!enrolment) {
    throw new Error(`Enrolment ${enrolmentId} could not be loaded`);
  }

  return enrolment;
};
