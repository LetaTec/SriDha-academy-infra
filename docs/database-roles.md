# Database roles and TLS

The API can connect to PostgreSQL as two roles:

| Role                       | Used for                                                       | Connection setting       |
| :------------------------- | :------------------------------------------------------------- | :----------------------- |
| **Migration (owner) role** | Running migrations, granting privileges, seeding the catalogue | `MIGRATION_DATABASE_URL` |
| **Application role**       | Everything the running API does                                | `DATABASE_URL`           |

The application role owns no tables. As a result it cannot:

- alter or drop tables;
- disable or drop triggers;
- `TRUNCATE`;
- create tables;
- switch triggers off with `session_replication_role`, which is superuser-only.

It may read and write rows, within these limits:

- **Append-only records** (`finance_audit_log`, `invoices`, `payment_tax_snapshots`, `tax_configuration_approvals`): insert only.
- **Financial history** (`payments`, `payment_events`, `payment_refunds`): no deletes.

Database triggers (migrations 018–020) also guard these tables for every role, including the owner:

- a payment event is never deleted, and only its outcome is recorded, once;
- refund history is never deleted, its amounts and references never change, and its status only moves forward;
- a PAID payment's amount, currency, Razorpay references, buyer, paid time and status never change, and the row is never deleted;
- `TRUNCATE` is refused on every financial table.

**Production requires both roles.** The configuration refuses to start in production without `MIGRATION_DATABASE_URL`. Without it (local development and tests only), `DATABASE_URL` does both jobs, as before.

## How start-up works

`openApplicationDatabase` in `api/src/db/startup.ts`, used by `server.ts`:

1. **Before anything changes**, with the migration connection, it checks the actual PostgreSQL roles, not the URL text. Start-up stops if:
   - `DATABASE_URL` signs in as the same role as the migration connection;
   - the application role does not exist;
   - the application role is a member of the owner role (it could act as the owner);
   - the owner is a member of the application role.

   The configuration already refuses identical URLs, and two URLs that name the same user.

2. It applies pending migrations as the owner, then runs `grantApplicationPrivileges`. This is idempotent, covers tables added by new migrations, and refuses to run against the owner itself, so it can never revoke what migrations need.
3. It connects with `DATABASE_URL` and inspects the role it actually got. **Any problem stops start-up** (`DatabaseRoleError`). The checks are:
   - superuser, `CREATEROLE`, `CREATEDB`, `REPLICATION` or `BYPASSRLS`;
   - owning any table or sequence;
   - membership of a table owner's role;
   - `CREATE` on schema `public` (on PostgreSQL 14 and older, every role has this unless it was revoked from `PUBLIC`);
   - `TRUNCATE` or `TRIGGER` on any table;
   - `UPDATE`/`DELETE` on append-only tables, or `DELETE` on financial history;
   - write access to `schema_migrations`.
4. `npm run db:seed` uses the migration role when one is set.

The real-PostgreSQL test is `api/src/db/applicationRole.postgres.test.ts`. It exercises every misconfiguration above, every bypass attempt and the whole money path as the restricted role. Run it with `npm run test:postgres -w api`, which requires `TEST_DATABASE_URL`.

## Production setup (one-time, by the database administrator)

The current production user owns the tables and becomes the **migration role**. Do not change its password or ownership.

1. Create the application role on the production database server, with a long random password generated outside any shared document:

   ```sql
   CREATE ROLE sridha_app LOGIN PASSWORD '<generated password>';
   GRANT CONNECT ON DATABASE <database name> TO sridha_app;
   ```

   The role name must be lower-case letters, digits and underscores. Do not grant it `SUPERUSER`, `CREATEROLE`, `CREATEDB`, `REPLICATION`, `BYPASSRLS`, ownership of anything, or membership of the owner role. Start-up refuses any of these.
   On managed PostgreSQL (Render), the default user may lack permission to create roles. If so, create it from the provider's dashboard or support, and record that in `DECISION.md`.
   **On PostgreSQL 14 or older**, every role may create tables in `public`, and start-up will refuse that. As the database owner or administrator:

   ```sql
   GRANT CREATE ON SCHEMA public TO <owner role>;
   REVOKE CREATE ON SCHEMA public FROM PUBLIC;
   ```

2. In the hosting provider's secret settings for the API:
   - `MIGRATION_DATABASE_URL`: the current connection URL (the owner).
   - `DATABASE_URL`: the same host and database, signed in as `sridha_app`.
   - `DATABASE_SSL=verify` (the production default), and `DATABASE_SSL_CA` if the provider's certificate is not signed by a public CA.

3. Deploy (only with explicit approval). On start the API migrates as the owner, grants `sridha_app`, then serves as `sridha_app`. Then:
   - confirm `/api/health` reports `database: connected`;
   - if start-up stops with `DatabaseRoleError`, the message names each problem. Fix the role; never weaken the check.

4. Check from a database console:

   ```sql
   SELECT tableowner, COUNT(*) FROM pg_tables WHERE schemaname = 'public' GROUP BY 1;
   -- every table is owned by the migration role, none by sridha_app
   ```

## Migration procedure (every release)

- Migrations run automatically at start-up as the migration role. They are append-only entries in `api/src/db/migrations.ts`, and each documents its undo.
- Before a release, apply the new migrations to a throwaway copy of production-like data (for example a `pg_dump` restored into a temporary database) and start the API against it. Migrations `019` and `020` were checked this way against a copy of the local development data. For `020`, the documented undo was then run and 020 re-applied.
- After a release, the grants are re-applied on every start, so new tables are covered without a manual step.

## Rollback

- **Role split:** production now requires both roles, so there is no single-role fallback in production. To recover from a role problem, fix the role, or roll back to the previous release.
- **Migrations 020, 019 and 018:** follow the undo comment above each entry, newest first (020, then 019, then 018). Each undo also removes its `schema_migrations` row, so a restart re-applies it.

## TLS

- `DATABASE_SSL=verify` (the production default) uses TLS and verifies the server certificate. Production refuses `DATABASE_SSL=disable`.
- TLS parameters inside a connection URL (`sslmode`, `sslrootcert` and similar) are **ignored**, and a `db.url_tls_parameters_ignored` warning is logged. node-postgres would otherwise let `sslmode=no-verify` silently switch verification off.
- If the provider uses its own certificate authority, put its PEM certificate in `DATABASE_SSL_CA`. `\n` escapes are accepted.
- **Verify the connection in staging before production.** If the provider's certificate is not trusted and no CA is given, the API refuses to connect. That is the intended, safe failure.
