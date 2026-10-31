import type { DatabaseClient, Row } from '../../db/client.js';

// Every SQL statement for enrolments (a student's seat in a batch)

// The student's enrolments with their batch, topic and subject, newest
// first; cancelled seats are left out
export const listEnrolmentRows = (
  db: DatabaseClient,
  userId: string,
  enrolmentId: string | null,
) =>
  db.all<Row>(
    `SELECT e.id AS enrolment_id, e.status AS enrolment_status, e.created_at AS enrolment_created_at,
            b.*, t.id AS t_id, t.title AS t_title, t.summary AS t_summary, t.level AS t_level,
            t.short_title AS t_short_title, t.icon AS t_icon, t.featured_rank AS t_featured_rank,
            t.price_paise AS t_price_paise, t.price_tax_label AS t_price_tax_label,
            s.id AS s_id, s.slug AS s_slug, s.name AS s_name
     FROM enrolments e
     JOIN batches b ON b.id = e.batch_id
     JOIN topics t ON t.id = b.topic_id
     JOIN chapters c ON c.id = t.chapter_id
     JOIN subjects s ON s.id = c.subject_id
     WHERE e.user_id = $1 AND e.status <> 'CANCELLED' AND ($2::text IS NULL OR e.id = $2::text)
     ORDER BY e.created_at DESC`,
    [userId, enrolmentId],
  );

export const findEnrolmentForBatch = (
  db: DatabaseClient,
  userId: string,
  batchId: string,
) =>
  db.get<{ id: string; status: string }>(
    'SELECT id, status FROM enrolments WHERE user_id = $1 AND batch_id = $2',
    [userId, batchId],
  );

export const insertEnrolment = (
  db: DatabaseClient,
  enrolment: {
    id: string;
    userId: string;
    batchId: string;
    status: string;
    timestamp: string;
  },
) =>
  db.query(
    `INSERT INTO enrolments (id, user_id, batch_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [
      enrolment.id,
      enrolment.userId,
      enrolment.batchId,
      enrolment.status,
      enrolment.timestamp,
    ],
  );

export const setEnrolmentStatus = (
  db: DatabaseClient,
  enrolmentId: string,
  status: string,
  timestamp: string,
) =>
  db.query('UPDATE enrolments SET status = $1, updated_at = $2 WHERE id = $3', [
    status,
    timestamp,
    enrolmentId,
  ]);

// An unpaid seat's hold runs from updated_at, so touching it renews the hold
export const renewEnrolmentHold = (
  db: DatabaseClient,
  enrolmentId: string,
  timestamp: string,
) =>
  db.query('UPDATE enrolments SET updated_at = $1 WHERE id = $2', [
    timestamp,
    enrolmentId,
  ]);
