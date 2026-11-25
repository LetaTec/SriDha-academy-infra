import type { AppContext } from '../../app/context.js';
import type { TestAttempt } from '../../contracts/payments.js';
import type { Row } from '../../db/client.js';
import { TOPIC_TEST_DURATION_MINUTES } from '../../db/topicTests.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { ENROLMENT_STATUS } from '../enrolments/enrolments.service.js';
import {
  findTestAttemptRow,
  listTestAttemptRows,
  markTestAttemptFinished,
  markTestAttemptStarted,
} from './testAttempts.repository.js';

// An attempt is paid for like a seat, so it shares the seat statuses
export const TEST_ATTEMPT_STATUS = ENROLMENT_STATUS;

const MINUTE_MS = 60 * 1000;

const toIso = (value: unknown) =>
  value === null || value === undefined
    ? null
    : new Date(value as string | Date).toISOString();

export const toTestAttempt = (row: Row): TestAttempt => ({
  id: String(row.id),
  topicId: String(row.topic_id),
  status: String(row.status) as TestAttempt['status'],
  startedAt: toIso(row.started_at),
  endsAt: toIso(row.ends_at),
});

// Paid, and not started yet or still running
export const isAttemptAvailable = (row: Row, now: Date) =>
  row.status === TEST_ATTEMPT_STATUS.confirmed &&
  (row.started_at === null ||
    new Date(row.ends_at as string | Date).getTime() > now.getTime());

const notFound = () =>
  new ApiError(
    404,
    ERROR_CODE.testAttemptNotFound,
    'This test attempt does not exist',
  );

// The signed-in student's paid attempts, newest first, for one topic or all
export const listTestAttempts = async (
  { db }: AppContext,
  userId: string,
  topicId: string | null,
): Promise<TestAttempt[]> =>
  (await listTestAttemptRows(db, userId, topicId))
    .filter(row => row.status === TEST_ATTEMPT_STATUS.confirmed)
    .map(toTestAttempt);

// Starts a paid attempt: its clock runs from now. Starting one already
// running returns it unchanged, so a student who comes back carries on;
// an attempt whose time is over cannot be started again.
export const startTestAttempt = async (
  context: AppContext,
  userId: string,
  attemptId: string,
): Promise<TestAttempt> => {
  const { db } = context;
  const now = context.now();
  const row = await findTestAttemptRow(db, attemptId, userId);

  if (!row || row.status !== TEST_ATTEMPT_STATUS.confirmed) throw notFound();

  if (row.started_at === null) {
    const endsAt = new Date(
      now.getTime() + TOPIC_TEST_DURATION_MINUTES * MINUTE_MS,
    );
    await markTestAttemptStarted(
      db,
      attemptId,
      now.toISOString(),
      endsAt.toISOString(),
    );
  } else if (!isAttemptAvailable(row, now)) {
    throw new ApiError(
      409,
      ERROR_CODE.testAttemptUsed,
      'This attempt is over. Buy another attempt to take the test again',
    );
  }

  const current = await findTestAttemptRow(db, attemptId, userId);
  if (!current) throw notFound();
  return toTestAttempt(current);
};

// Ends a running attempt when the student submits, so it cannot be taken
// again for the rest of its time
export const finishTestAttempt = async (
  context: AppContext,
  userId: string,
  attemptId: string,
): Promise<TestAttempt> => {
  const { db } = context;
  const row = await findTestAttemptRow(db, attemptId, userId);
  if (!row || row.status !== TEST_ATTEMPT_STATUS.confirmed) throw notFound();

  await markTestAttemptFinished(db, attemptId, context.now().toISOString());
  const current = await findTestAttemptRow(db, attemptId, userId);
  if (!current) throw notFound();
  return toTestAttempt(current);
};
