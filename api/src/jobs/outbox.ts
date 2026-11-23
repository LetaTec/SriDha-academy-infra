import type { AppContext } from '../app/context.js';
import { logger } from '../logging/logger.js';
import { processEmailOutbox } from '../modules/outbox/outbox.service.js';

// The outbox worker runs every 15 seconds to dispatch pending emails
// and retry temporary failures.
export const OUTBOX_POLL_INTERVAL_MS = 15 * 1000;

export const startOutboxJobs = (
  context: Pick<AppContext, 'db' | 'mailer' | 'now'>,
  intervalMs = OUTBOX_POLL_INTERVAL_MS,
) => {
  let isRunning = false;
  let isStopped = false;

  const run = async () => {
    if (isRunning || isStopped) return;
    isRunning = true;
    try {
      await processEmailOutbox(context);
    } catch (error) {
      logger.error('jobs.outbox_worker_failed', { error });
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(run, intervalMs);
  timer.unref();

  return () => {
    isStopped = true;
    clearInterval(timer);
  };
};
