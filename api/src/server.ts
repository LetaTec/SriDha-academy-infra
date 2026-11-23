import { createApp } from './app/app.js';
import { loadConfigFromEnvironment } from './config/env.js';
import { seedCatalogue } from './db/catalogueSeed.js';
import { isInMemoryDatabase } from './db/client.js';
import { openApplicationDatabase } from './db/startup.js';
import { startCleanupJobs } from './jobs/cleanup.js';
import { initErrorReporting } from './logging/errorReporting.js';
import { configureLogger, logger } from './logging/logger.js';
import { createMailer } from './mail/mailer.js';
import { syncStaffRoles } from './modules/auth/roles.js';
import { createPaymentGateway } from './modules/payments/gateway.js';
import { startFinanceJobs } from './jobs/finance.js';
import { startOutboxJobs } from './jobs/outbox.js';

const config = loadConfigFromEnvironment();
configureLogger({
  level: config.logLevel,
  pretty: config.env !== 'production',
});
const flushErrorReports = await initErrorReporting({
  dsn: config.sentryDsn,
  environment: config.env,
});

// Anything that escapes a request is still logged (and reported)
process.on('unhandledRejection', reason => {
  logger.error('process.unhandled_rejection', { error: reason });
});

// Two roles in production: the owner migrates and grants, the API serves
// as a restricted role (checked; any problem stops start-up). Locally,
// DATABASE_URL may do both. See docs/database-roles.md.
const db = await openApplicationDatabase(config);

// The staff email lists are the source of truth for staff roles; every
// change is recorded in the finance audit log.
const staffCount = await syncStaffRoles(db, config, new Date());
logger.info('auth.staff_roles_synced', { count: staffCount });

// An in-memory database starts empty on every run and no other process can
// reach it, so the server loads the catalogue itself. The seed is idempotent.
if (isInMemoryDatabase(config.databaseUrl)) {
  await seedCatalogue(db);
  logger.info('db.in_memory_seeded');
}

const mailer = createMailer(config);

if (!mailer) {
  logger.warn('mail.not_configured', {
    effect:
      'password recovery responds PASSWORD_RECOVERY_UNAVAILABLE and payment confirmation emails are not sent',
  });
}

const now = () => new Date();
// One gateway for the routes and the jobs (Razorpay with keys, otherwise
// test mode)
const paymentGateway = createPaymentGateway(config);
const app = createApp({ db, config, mailer, now, paymentGateway });
const stopCleanupJobs = startCleanupJobs({ db, now });
const stopFinanceJobs = startFinanceJobs({ db, now, config }, paymentGateway);
const stopOutboxJobs = startOutboxJobs({ db, mailer, now });

const server = app.listen(config.port, () => {
  logger.info('api.listening', {
    port: config.port,
    env: config.env,
    webOrigin: config.webOrigin,
  });
});

const shutdown = () => {
  stopCleanupJobs();
  stopFinanceJobs();
  stopOutboxJobs();
  server.close(async () => {
    await db.close();
    await flushErrorReports?.();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
