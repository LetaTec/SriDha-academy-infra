import type { DatabaseClient, Row } from '../../db/client.js';

// A student's attempts at one topic's test (or every topic's), newest first.
// Cancelled attempts were never paid for and are left out.
export const listTestAttemptRows = (
  db: DatabaseClient,
  userId: string,
  topicId: string | null,
) =>
  db.all<Row>(
    `SELECT id, user_id, topic_id, status, started_at, ends_at, created_at
     FROM test_attempts
     WHERE user_id = $1 AND status <> 'CANCELLED'
       AND ($2::text IS NULL OR topic_id = $2::text)
     ORDER BY created_at DESC`,
    [userId, topicId],
  );

export const findTestAttemptRow = (
  db: DatabaseClient,
  attemptId: string,
  userId: string,
) =>
  db.get<Row>(
    `SELECT id, user_id, topic_id, status, started_at, ends_at, created_at
     FROM test_attempts
     WHERE id = $1 AND user_id = $2`,
    [attemptId, userId],
  );

export const insertTestAttempt = (
  db: DatabaseClient,
  attempt: {
    id: string;
    userId: string;
    topicId: string;
    status: string;
    timestamp: string;
  },
) =>
  db.query(
    `INSERT INTO test_attempts (id, user_id, topic_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [
      attempt.id,
      attempt.userId,
      attempt.topicId,
      attempt.status,
      attempt.timestamp,
    ],
  );

export const setTestAttemptStatus = (
  db: DatabaseClient,
  attemptId: string,
  status: string,
  timestamp: string,
) =>
  db.query(
    'UPDATE test_attempts SET status = $2, updated_at = $3 WHERE id = $1',
    [attemptId, status, timestamp],
  );

// Starts a paid attempt that has not been started; returns whether it did
export const markTestAttemptStarted = async (
  db: DatabaseClient,
  attemptId: string,
  startedAt: string,
  endsAt: string,
) => {
  const result = await db.query(
    `UPDATE test_attempts
     SET started_at = $2, ends_at = $3, updated_at = $2
     WHERE id = $1 AND status = 'CONFIRMED' AND started_at IS NULL`,
    [attemptId, startedAt, endsAt],
  );
  return (result.rowCount ?? 0) > 0;
};

// Ends a running attempt early, when the student submits their answers
export const markTestAttemptFinished = (
  db: DatabaseClient,
  attemptId: string,
  finishedAt: string,
) =>
  db.query(
    `UPDATE test_attempts
     SET ends_at = $2, updated_at = $2
     WHERE id = $1 AND started_at IS NOT NULL AND ends_at > $2::timestamptz`,
    [attemptId, finishedAt],
  );
