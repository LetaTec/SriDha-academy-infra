import type { AppConfig } from '../config/env.js';
import {
  assertDistinctRoles,
  DatabaseRoleError,
  grantApplicationPrivileges,
  inspectApplicationRole,
} from './applicationRole.js';
import { openDatabase, runMigrations, type Database } from './client.js';
import { roleOfDatabaseUrl } from './connection.js';

// Opens the database the API serves from.
// Two-role mode (MIGRATION_DATABASE_URL set; required in production): the
// owner role migrates and grants, then the API connects as the restricted
// role, which must pass every check or start-up stops.
// Single-role mode (local development only): DATABASE_URL does both.
export const openApplicationDatabase = async (
  config: Pick<
    AppConfig,
    'databaseUrl' | 'migrationDatabaseUrl' | 'databaseTls' | 'pgMaxConnections'
  >,
): Promise<Database> => {
  if (!config.migrationDatabaseUrl || !config.databaseUrl) {
    const db = await openDatabase(
      config.databaseUrl,
      config.pgMaxConnections,
      config.databaseTls,
    );
    await runMigrations(db);
    return db;
  }

  const applicationRole = roleOfDatabaseUrl(config.databaseUrl);
  const migrator = await openDatabase(
    config.migrationDatabaseUrl,
    1,
    config.databaseTls,
  );
  try {
    // Checked before migrating, so a misconfiguration changes nothing
    await assertDistinctRoles(migrator, applicationRole);
    await runMigrations(migrator);
    await grantApplicationPrivileges(migrator, applicationRole);
  } finally {
    await migrator.close();
  }

  const db = await openDatabase(
    config.databaseUrl,
    config.pgMaxConnections,
    config.databaseTls,
  );
  try {
    const report = await inspectApplicationRole(db);
    const problems = [...report.problems];
    if (report.role !== applicationRole) {
      problems.unshift(
        `connected as "${report.role}", not "${applicationRole}"`,
      );
    }
    if (problems.length > 0) {
      throw new DatabaseRoleError(
        `The application database role "${report.role}" is not restricted: ${problems.join('; ')}. See docs/database-roles.md`,
      );
    }
  } catch (error) {
    await db.close();
    throw error;
  }
  return db;
};
