import { createApp } from './app/app.js';
import { loadConfigFromEnvironment } from './config/env.js';
import { seedCatalogue } from './db/catalogueSeed.js';
import {
  isInMemoryDatabase,
  openDatabase,
  runMigrations,
} from './db/client.js';
import { startCleanupJobs } from './jobs/cleanup.js';
import { initErrorReporting } from './logging/errorReporting.js';
import { configureLogger, logger } from './logging/logger.js';
import { createMailer } from './mail/mailer.js';
import { syncSuperAdmins } from './modules/auth/roles.js';

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

const db = await openDatabase(config.databaseUrl, config.pgMaxConnections);
await runMigrations(db);

// SUPER_ADMIN_EMAILS is the source of truth for who is a super admin.
const superAdminCount = await syncSuperAdmins(
  db,
  config.superAdminEmails,
  new Date(),
);
logger.info('auth.super_admins_synced', { count: superAdminCount });

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
const app = createApp({ db, config, mailer, now });
const stopCleanupJobs = startCleanupJobs({ db, now });

const server = app.listen(config.port, () => {
  logger.info('api.listening', {
    port: config.port,
    env: config.env,
    webOrigin: config.webOrigin,
  });
});

const shutdown = () => {
  stopCleanupJobs();
  server.close(async () => {
    await db.close();
    await flushErrorReports?.();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
