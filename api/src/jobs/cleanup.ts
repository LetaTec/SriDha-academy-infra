import type { DatabaseClient } from '../db/client.js';
import { logger } from '../logging/logger.js';
import { deleteExpiredAuthRecords } from '../modules/auth/auth.repository.js';

const HOUR_MS = 60 * 60 * 1000;
// The first run waits a minute, so it never slows a cold start
const FIRST_RUN_DELAY_MS = 60 * 1000;

// Deletes sessions, password-reset tokens and admin sign-in links that have
// expired. They can no longer be used; keeping them only grows the tables.
//
// Unpaid seats are left alone on purpose: they stop counting against a
// batch after the 30-minute hold (see SEAT_HOLD_MINUTES), and a student can
// still come back to one from My learning to finish paying.
export const runCleanup = async ({
  db,
  now,
}: {
  db: DatabaseClient;
  now: () => Date;
}) => {
  const removed = await deleteExpiredAuthRecords(db, now());
  logger.info('jobs.cleanup_finished', removed);
  return removed;
};

// Runs the clean-up every hour in the API process. Returns a function that
// stops it, for shutdown.
export const startCleanupJobs = (options: {
  db: DatabaseClient;
  now: () => Date;
}) => {
  const run = () => {
    runCleanup(options).catch(error => {
      logger.error('jobs.cleanup_failed', { error });
    });
  };

  const firstRun = setTimeout(run, FIRST_RUN_DELAY_MS);
  const hourly = setInterval(run, HOUR_MS);
  // Neither timer keeps the process alive on its own
  firstRun.unref();
  hourly.unref();

  return () => {
    clearTimeout(firstRun);
    clearInterval(hourly);
  };
};
