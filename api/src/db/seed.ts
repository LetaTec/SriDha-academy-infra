import { loadConfigFromEnvironment } from '../config/env.js';
import { seedCatalogue } from './catalogueSeed.js';
import { grantApplicationPrivileges } from './applicationRole.js';
import { isInMemoryDatabase, openDatabase, runMigrations } from './client.js';
import { roleOfDatabaseUrl } from './connection.js';

const config = loadConfigFromEnvironment();

// Without DATABASE_URL the API uses an in-memory database that only the
// running server can reach, and the server seeds it on startup.
if (isInMemoryDatabase(config.databaseUrl)) {
  console.log(
    '[db] no DATABASE_URL - nothing to seed; the in-memory API seeds its own catalogue on startup',
  );
} else {
  // Seeding is an operator task: it runs as the migration role when one is
  // configured (the application role may not create tables)
  const db = await openDatabase(
    config.migrationDatabaseUrl ?? config.databaseUrl,
    1,
    config.databaseTls,
  );

  await runMigrations(db);
  await seedCatalogue(db);
  if (config.migrationDatabaseUrl && config.databaseUrl) {
    await grantApplicationPrivileges(db, roleOfDatabaseUrl(config.databaseUrl));
  }
  await db.close();

  console.log('[db] catalogue seeded - PostgreSQL');
}
