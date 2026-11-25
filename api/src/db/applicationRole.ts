import type { DatabaseClient } from './client.js';

// The application's PostgreSQL role, when migrations run as a separate
// owner role (MIGRATION_DATABASE_URL). The application role owns nothing
// and cannot become the owner, so it cannot alter or drop tables, disable
// triggers, truncate, create tables, or switch triggers off with
// session_replication_role (superuser only). It reads and writes rows,
// within the database guards on financial history.
// See docs/database-roles.md.

// Records the application adds and never changes (database triggers also
// refuse changes; this removes the privilege as well)
export const APPEND_ONLY_TABLES = [
  'finance_audit_log',
  'invoices',
  'payment_tax_snapshots',
  'tax_configuration_approvals',
] as const;

// Financial history the application changes only through guarded
// transitions and never deletes
export const NO_DELETE_TABLES = [
  'payments',
  'payment_events',
  'payment_refunds',
] as const;

const ROLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

const quoteRole = (role: string) => {
  if (!ROLE_NAME.test(role)) {
    throw new Error(
      `Database role "${role}" must be lower-case letters, digits and underscores`,
    );
  }
  return `"${role}"`;
};

export class DatabaseRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseRoleError';
  }
}

// Refuses a configuration where the application role is the migration
// role, or can act as it through role membership. Granting would then
// revoke the owner's own privileges (and the next migration would fail),
// and the application would hold the owner's powers.
//
// The migration role must not be able to use or become the application
// role either. On PostgreSQL 16 and later, a role that creates another
// is automatically given an ADMIN-only membership of it (no INHERIT, no
// SET), which managed hosts such as Render cannot remove. That membership
// grants no privileges of the application role and cannot SET ROLE to it,
// so it is allowed; any membership that can use or become the role is not.
export const assertDistinctRoles = async (
  migrator: DatabaseClient,
  applicationRole: string,
) => {
  const version = await migrator.get<{ server_version_num: string }>(
    `SELECT current_setting('server_version_num') AS server_version_num`,
  );
  // pg_has_role(..., 'SET') exists from PostgreSQL 16; before that, any
  // membership could SET ROLE, so MEMBER is the right test
  const ownerActsAsApp =
    Number(version?.server_version_num ?? 0) >= 160000
      ? `pg_has_role(current_user, $1, 'USAGE')
           OR pg_has_role(current_user, $1, 'SET')`
      : `pg_has_role(current_user, $1, 'MEMBER')`;
  const row = await migrator.get<{
    owner: string;
    app_exists: boolean;
    app_is_owner_member: boolean;
    owner_is_app_member: boolean;
  }>(
    `SELECT current_user AS owner,
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS app_exists,
       COALESCE((SELECT pg_has_role($1, current_user, 'MEMBER')
         WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)), false)
         AS app_is_owner_member,
       COALESCE((SELECT ${ownerActsAsApp}
         WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)), false)
         AS owner_is_app_member`,
    [applicationRole],
  );
  if (!row?.app_exists) {
    throw new DatabaseRoleError(
      `The application role "${applicationRole}" (DATABASE_URL) does not exist`,
    );
  }
  if (row.owner === applicationRole) {
    throw new DatabaseRoleError(
      `MIGRATION_DATABASE_URL and DATABASE_URL both sign in as "${applicationRole}"; the application must use a separate, restricted role`,
    );
  }
  if (row.app_is_owner_member) {
    throw new DatabaseRoleError(
      `The application role "${applicationRole}" is a member of the migration role "${row.owner}" and could act as it; remove that membership`,
    );
  }
  if (row.owner_is_app_member) {
    throw new DatabaseRoleError(
      `The migration role "${row.owner}" can use or become the application role "${applicationRole}"; keep the two roles unrelated`,
    );
  }
};

// Run by the migration (owner) role after migrations, on every start, so
// tables added by new migrations are covered. Idempotent. Refuses to run
// against the owner itself.
export const grantApplicationPrivileges = async (
  db: DatabaseClient,
  role: string,
) => {
  const app = quoteRole(role);
  await assertDistinctRoles(db, role);
  await db.exec(`
    GRANT USAGE ON SCHEMA public TO ${app};
    REVOKE CREATE ON SCHEMA public FROM ${app};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${app};
    REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM ${app};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${app};
    REVOKE UPDATE, DELETE ON ${APPEND_ONLY_TABLES.join(', ')} FROM ${app};
    REVOKE DELETE ON ${NO_DELETE_TABLES.join(', ')} FROM ${app};
    REVOKE INSERT, UPDATE, DELETE ON schema_migrations FROM ${app};
  `);
};

export type ApplicationRoleReport = {
  role: string;
  serverVersion: number;
  problems: string[];
};

// Everything the connected role can do that the application role must
// not. Checked at start-up in two-role mode; any problem stops start-up.
export const inspectApplicationRole = async (
  db: DatabaseClient,
): Promise<ApplicationRoleReport> => {
  const role = await db.get<{
    role: string;
    server_version: string | number;
    superuser: boolean;
    create_role: boolean;
    create_db: boolean;
    replication: boolean;
    bypass_rls: boolean;
    owned_relations: string | number;
    owner_member_of: string | null;
    can_create_in_public: boolean;
    truncate_or_trigger_on: string | null;
    changes_append_only: string | null;
    deletes_history: string | null;
    writes_migrations: boolean;
  }>(
    `SELECT current_user AS role,
       current_setting('server_version_num') AS server_version,
       r.rolsuper AS superuser, r.rolcreaterole AS create_role,
       r.rolcreatedb AS create_db, r.rolreplication AS replication,
       r.rolbypassrls AS bypass_rls,
       (SELECT COUNT(*) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relowner = r.oid
           AND n.nspname NOT IN ('pg_catalog', 'information_schema')
           AND n.nspname NOT LIKE 'pg_toast%') AS owned_relations,
       (SELECT string_agg(DISTINCT t.tableowner, ', ') FROM pg_tables t
         WHERE t.schemaname = 'public'
           AND pg_has_role(current_user, t.tableowner, 'MEMBER'))
         AS owner_member_of,
       has_schema_privilege(current_user, 'public', 'CREATE')
         AS can_create_in_public,
       -- Privilege checks use table OIDs, never names, so the planner can
       -- evaluate them in any order without touching other schemas
       (SELECT string_agg(c.relname, ', ' ORDER BY c.relname) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
           AND (has_table_privilege(current_user, c.oid, 'TRUNCATE')
             OR has_table_privilege(current_user, c.oid, 'TRIGGER')))
         AS truncate_or_trigger_on,
       (SELECT string_agg(c.relname, ', ' ORDER BY c.relname) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
           AND (has_table_privilege(current_user, c.oid, 'UPDATE')
             OR has_table_privilege(current_user, c.oid, 'DELETE')))
         AS changes_append_only,
       (SELECT string_agg(c.relname, ', ' ORDER BY c.relname) FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = ANY($2::text[])
           AND has_table_privilege(current_user, c.oid, 'DELETE'))
         AS deletes_history,
       COALESCE((SELECT has_table_privilege(current_user, c.oid, 'INSERT')
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'schema_migrations'), false)
         AS writes_migrations
     FROM pg_roles r WHERE r.rolname = current_user`,
    [[...APPEND_ONLY_TABLES], [...NO_DELETE_TABLES]],
  );

  const problems: string[] = [];
  if (!role) {
    return { role: '', serverVersion: 0, problems: ['role not found'] };
  }
  if (role.superuser) problems.push('is a superuser');
  if (role.create_role) problems.push('can create roles');
  if (role.create_db) problems.push('can create databases');
  if (role.replication) problems.push('has the replication attribute');
  if (role.bypass_rls) problems.push('bypasses row security');
  if (Number(role.owned_relations) > 0) {
    problems.push(`owns ${Number(role.owned_relations)} tables or sequences`);
  }
  if (role.owner_member_of) {
    problems.push(`can act as the table owner (${role.owner_member_of})`);
  }
  // On PostgreSQL 14 and older every role may create in public unless
  // CREATE was revoked from PUBLIC; this catches that too
  if (role.can_create_in_public) {
    problems.push('can create tables in schema public');
  }
  if (role.truncate_or_trigger_on) {
    problems.push(`has TRUNCATE or TRIGGER on ${role.truncate_or_trigger_on}`);
  }
  if (role.changes_append_only) {
    problems.push(`can change append-only ${role.changes_append_only}`);
  }
  if (role.deletes_history) {
    problems.push(`can delete ${role.deletes_history}`);
  }
  if (role.writes_migrations) problems.push('can write schema_migrations');

  return {
    role: role.role,
    serverVersion: Number(role.server_version),
    problems,
  };
};
