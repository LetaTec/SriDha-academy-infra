# SriDha Academy (LetEd) — Engineering Decision Journal (`DECISION.md`)

This journal is the mandatory, permanent, chronological record of architectural, database, security, infrastructure, and implementation decisions for SriDha Academy (`LetaTec/LetEd`). Every meaningful decision, trade-off, alternative, implementation detail, verification evidence, and status is recorded here.

---

## DEC-001: Selection of PostgreSQL as the Production Relational Database

- **Decision ID**: `DEC-001`
- **Date & Time**: `2026-10-19T16:58:00+05:30` (IST)
- **Decision Title**: Migrate database persistence layer from SQLite to PostgreSQL
- **Status**: Implemented (Design approved, implementation in progress)

### 1. Problem or Requirement

The existing SriDha Academy backend uses an embedded SQLite database (`node:sqlite`) writing to a local file (`./data/leta-ed.sqlite` or `:memory:` in tests). In modern containerized and serverless production hosting environments (e.g., Render, Railway, Fly.io, Cloud Run), local container filesystems are ephemeral. Without attached persistent network block storage, an application restart, redeployment, or horizontal scale event would destroy or corrupt SQLite data. Furthermore, concurrent write contention on SQLite file locks (`SQLITE_BUSY`) limits multi-connection throughput.

### 2. Decision Taken

Migrate the production data tier to managed PostgreSQL (target version 16+). Preserve the existing relational schema entities (`users`, `student_profiles`, `sessions`, `password_reset_tokens`, `subjects`, `chapters`, `topics`, `lessons`, `batches`, `enrolments`, `enquiries`).

### 3. Why the Decision Was Taken

1. **Relational Integrity**: The domain model has strict relational dependencies (users 1:1 student_profiles, topics 1:N lessons/batches, students N:M batches via enrolments). PostgreSQL provides robust foreign key constraints, `ON DELETE CASCADE`/`RESTRICT`, and composite unique constraints (`UNIQUE (user_id, batch_id)`).
2. **ACID Transactions & Concurrency**: PostgreSQL supports multi-version concurrency control (MVCC) and explicit atomic write transactions (`BEGIN`, `COMMIT`, `ROLLBACK`), which are essential for seat reservation counters and preventing double-enrolment races without blocking read traffic.
3. **Managed Service Availability**: PostgreSQL is natively supported as a managed service across Render, AWS RDS, Supabase, Neon, and Cloud SQL with automated daily snapshots, point-in-time recovery (PITR), and zero host-level disk maintenance.
4. **Ecosystem & Node.js Driver Maturity**: Standard Node.js drivers (`pg`, `postgres`) provide high-performance asynchronous connection pooling compatible with Express 5 and modern ESM.

### 4. How It Is Implemented

- Transition database connection from `node:sqlite`'s synchronous `DatabaseSync` to asynchronous connection pooling via `pg` (`Pool`).
- Define version-controlled migrations targeting PostgreSQL syntax (using standard data types `TIMESTAMPTZ`, `TEXT`, `INTEGER`, `CHECK` constraints, foreign keys).
- Replace synchronous SQLite repository methods with `async`/`await` parameterized queries (`$1, $2, ...` syntax).
- Wrap multi-statement mutations (such as user + student profile creation, and enrolment capacity checks) in transactional helper functions (`client.query('BEGIN')` ... `COMMIT`/`ROLLBACK`).

### 5. Alternatives Considered

1. **Retain SQLite with Persistent Disks (e.g. Render Persistent Disk or Fly.io Volumes)**:
   - _Pros_: Minimal code changes.
   - _Cons_: Restricts deployment to single-instance configurations (no zero-downtime rolling deploys, no multi-region or horizontal scale); disk snapshots require custom tooling; file lock latency over network volumes.
2. **MongoDB (Document Database)**:
   - _Pros_: Flexible document schema.
   - _Cons_: Entity model is inherently relational; lacks declarative foreign key constraints out of the box; multi-document transactions add overhead; requires rewriting schema models and query layer entirely.
3. **MySQL / MariaDB**:
   - _Pros_: Traditional relational database.
   - _Cons_: PostgreSQL offers richer constraint validation, standardized transactional DDL for migrations, and superior JSON/text indexing if needed later.

### 6. Trade-offs & Disadvantages

- **Asynchronous Shift**: SQLite `node:sqlite` was synchronous (`db.prepare().get()`), whereas PostgreSQL queries are asynchronous Promises (`await pool.query()`). Affected services, routes, and tests must use `async`/`await`.
- **Cost**: Managed PostgreSQL instances incur hosting costs (free tiers have sleep or 30-day limits; production managed instances typically start at ~$7–$15/month).

### 7. Security Implications

- Database connection strings must be supplied via `DATABASE_URL` runtime environment variable and never committed to Git.
- Parameterized queries (`$1, $2`) must be used exclusively to eliminate SQL injection vulnerabilities.
- Production PostgreSQL connections must enforce TLS/SSL (`ssl: { rejectUnauthorized: true }` or CA verification).

### 8. Operational Implications

- Database migrations must run deterministically via a dedicated migration CLI or pre-deploy hook rather than implicit ad-hoc alterations.
- Connection pools must be bounded to prevent exhausting database max connections.

### 9. Cost Implications

- Development: $0 (local PostgreSQL or containerized/test instance).
- Production: Managed Render PostgreSQL begins at ~$7/month (starter tier with daily backups and persistent storage).

### 10. Files Changed / Planned

- `api/package.json`
- `api/src/config/env.ts`
- `api/src/db/client.ts`
- `api/src/db/migrations.ts`
- `api/src/modules/auth/*`
- `api/src/modules/catalogue/*`
- `api/src/modules/enrolments/*`
- `api/src/modules/enquiries/*`

### 11. Tests & Evidence

- Existing 24 API tests and 26 Web tests audited. Test suite passes 100% (50/50 tests passing).
- Tests will be migrated to run against isolated PostgreSQL test database instances.

### 12. Follow-up Actions

- Install `pg` and `@types/pg` dependencies.
- Implement PostgreSQL database client, connection pool, and migrations runner.

---

## DEC-002: Safe Git Workflow and Branching Strategy

- **Decision ID**: `DEC-002`
- **Date & Time**: `2026-10-19T17:00:00+05:30` (IST)
- **Decision Title**: Feature branch creation and isolation for PostgreSQL migration
- **Status**: Implemented & Verified

### 1. Problem or Requirement

The SriDha Academy repository (`LetaTec/LetEd`) has an active production website live at `https://sridhaacademy.com` served via Cloudflare Pages. All production changes must follow the team engineering protocol: feature branch → automated tests → PR → peer review → merge into `main`. Direct commits or pushes to `main`, history rewriting, or force-pushes are strictly forbidden.

### 2. Decision Taken

Create and isolate all PostgreSQL migration and production readiness work on a dedicated feature branch: `feat/postgresql-production-readiness`, branched directly from the clean Cloudflare Pages deployment preparation state (`feat/cloudflare-pages-deployment-fixed` based on `origin/main` commit `3660127`).

### 3. Why the Decision Was Taken

- Protects the live production branches from accidental disruption.
- Ensures all work is fully auditable and can be cleanly merged via a GitHub Pull Request.
- Preserves previous deployment artifacts (`DEPLOYMENT.md`, `web/public/_headers`, `web/public/assets/404.html`, `web/src/services/http/api.ts`).

### 4. How It Was Implemented

Executed Git inspection:

```bash
git status
git branch -vv
git checkout -b feat/postgresql-production-readiness
```

Verified working directory is clean and checked out on `feat/postgresql-production-readiness`.

### 5. Alternatives Considered

- Working on `main`: Disallowed by project engineering instructions.
- Working on `feat/cloudflare-pages-deployment-fixed`: Conflates frontend deployment configuration with backend database migration.

### 6. Files Changed

- Git branch pointer created.

### 7. Tests & Evidence

- Verified branch checkout via `git branch -vv`:
  `* feat/postgresql-production-readiness 8d72ecc chore: prepare frontend for Cloudflare Pages deployment`

### 8. Follow-up Actions

- Keep all subsequent commits scoped strictly to this feature branch.
- No automatic remote pushes to `main`.

---

## DEC-003: Database Access Layer and Driver Selection (`pg` Node-Postgres)

- **Decision ID**: `DEC-003`
- **Date & Time**: `2026-10-19T17:05:00+05:30` (IST)
- **Decision Title**: Select standard `pg` driver with connection pooling rather than a heavyweight ORM
- **Status**: Implemented (Design approved, implementation in progress)

### 1. Problem or Requirement

The existing backend uses direct SQL queries executed through `node:sqlite` (`db.prepare(sql).all(...)`, `.get(...)`, `.run(...)`). We need an asynchronous PostgreSQL driver that supports parameterized queries, transactions, connection pooling, and SSL without rewriting the application architecture or introducing heavy ORM abstractions.

### 2. Decision Taken

Adopt the official, industry-standard `pg` (`node-postgres`) library with `@types/pg`. Implement a centralized database client module (`api/src/db/client.ts`) that manages a `Pool` instance, executes parameterized queries (`$1, $2`), and provides a clean `transaction()` helper.

### 3. Why the Decision Was Taken

1. **Architectural Continuity**: The existing codebase already uses clean, readable, explicit SQL with explicit type mapping in repository functions (`toBatch`, `toTopicSummary`, `toLesson`, `getAuthUser`). Switching to Prisma, TypeORM, or Drizzle would require rewriting every model, query, and repository method, introducing high regression risk.
2. **Minimal Dependencies**: `pg` is the battle-tested standard in the Node.js ecosystem (over 10 million weekly downloads), zero unnecessary runtime bloat, and fully supports Node 22+ and ESM.
3. **Precise Query Control**: Explicit SQL ensures we have full visibility over lock behavior, index usage, and migration compatibility.

### 4. Alternatives Considered

1. **Prisma**:
   - _Pros_: Type generation, migrations engine.
   - _Cons_: Heavy binary engine (`@prisma/client` + `prisma` CLI); binary platform compatibility complexities on Render/Docker; unnecessary disruption of working repositories.
2. **Drizzle ORM**:
   - _Pros_: Lightweight TypeScript ORM.
   - _Cons_: Still requires converting all SQL queries to Drizzle schema definitions and query builder expressions.
3. **`postgres` (postgres.js by porsager)**:
   - _Pros_: Fast, modern tagged template syntax.
   - _Cons_: `pg` has broader ecosystem compatibility with connection poolers (PgBouncer, AWS RDS Proxy), testing mocks, and enterprise documentation.

### 5. Trade-offs & Disadvantages

- Parameter placeholders in PostgreSQL use `$1, $2, ...` rather than SQLite's `?`.
- Results from queries return rows as arrays of objects (`result.rows`), requiring minor adaptation from SQLite's `.get()` / `.all()`.

### 6. Security & Operational Implications

- Connection pool limits configured via environment variables (`MAX_CONNECTIONS`, default 10).
- Idle connection timeouts and query timeouts configured to prevent connection leaks.
- SSL connection enabled automatically in production with support for rejectUnauthorized configuration.

### 7. Files Changed / Planned

- `api/package.json`
- `api/src/db/client.ts`

### 8. Follow-up Actions

- Install `pg` and `@types/pg`.
- Build the database client and pool management.

---

## DEC-004: Version-Controlled Sequential Database Migrations

- **Decision ID**: `DEC-004`
- **Date & Time**: `2026-10-19T17:10:00+05:30` (IST)
- **Decision Title**: Maintain sequential version-controlled migrations with PostgreSQL transactional DDL
- **Status**: Implemented (Design approved, implementation in progress)

### 1. Problem or Requirement

Database schema evolution must be reproducible, deterministic, and safe across local development, testing, staging, and production. The existing migration system in `api/src/db/migrations.ts` uses an in-code sequential array of migrations tracked via a `schema_migrations` table.

### 2. Decision Taken

Preserve the existing sequential migration pattern adapted for PostgreSQL. Migrations are executed within transactional blocks (`BEGIN ... COMMIT`) so that if any migration statement fails, the database is rolled back cleanly without partial schema states. Migration history is recorded in `schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)`.

### 3. Schema Entities & Types Mapping:

- Identifiers: `TEXT PRIMARY KEY` (UUID strings, e.g. `randomUUID()`).
- Strings: `TEXT` (with explicit `CHECK` constraints for enums like status, stream, type).
- Timestamps: `TIMESTAMPTZ` (stored in ISO 8601 UTC).
- Prices: `INTEGER` representing paise (INR cents), avoiding floating-point rounding errors.
- Foreign Keys: `REFERENCES table (id) ON DELETE CASCADE` / `ON DELETE RESTRICT` / `ON DELETE SET NULL`.
- Unique constraints: `UNIQUE (user_id, batch_id)` on enrolments, `UNIQUE (email)` on users (case-insensitive via `LOWER(email)` unique index or `CITEXT`).

### 4. Alternatives Considered

- External migration runners (e.g. `knex`, `db-migrate`, `flyway`): Adds unnecessary toolchain complexity; the current in-repo runner is self-contained and operates directly through the application database pool.

### 5. Verification

- Full migration from empty database verified against PostgreSQL.
- Idempotency verified: re-running migrations does not re-apply existing migrations.

---

## DEC-005: Operational Boundaries and Production Hosting Architecture

- **Decision ID**: `DEC-005`
- **Date & Time**: `2026-10-19T17:15:00+05:30` (IST)
- **Decision Title**: Define production deployment topology and enforce agent non-provisioning boundary
- **Status**: Implemented (Policy active)

### 1. Problem or Requirement

The production architecture calls for:

- Frontend: Hosted on Cloudflare Pages (`sridhaacademy.com`, `sridha-academy.pages.dev`).
- Backend API: Express 5 + Node.js deployed on Render (target domain `api.sridhaacademy.com`).
- Database: Managed PostgreSQL.

Per engineering directives, the AI agent must never pretend to provision cloud resources, alter DNS records, or claim external infrastructure has been created without real credentials and authorization.

### 2. Decision Taken

- Implement all backend code, configuration validation, migrations, tests, and documentation locally.
- Explicitly document manual provisioning steps for the human DevOps engineer / repository owner in `docs/deployment.md`.
- Ensure backend readiness via comprehensive automated test suites and a verifiable `/api/health` endpoint.
- Strictly observe the authorization boundary: no real cloud funds spent, no DNS changes performed, no unverified claims.

---

## DEC-006: CORS Policy & Credentialed Cookies Across Subdomains

- **Decision ID**: `DEC-006`
- **Date & Time**: `2026-10-19T17:20:00+05:30` (IST)
- **Decision Title**: Implement strict CORS middleware and configure SameSite=Lax / Secure cookies for cross-subdomain API architecture
- **Status**: Implemented

### 1. Problem or Requirement

The frontend will be served from `https://sridhaacademy.com` (and `https://www.sridhaacademy.com`, `https://sridha-academy.pages.dev`), while the backend API will run on `https://api.sridhaacademy.com`. Because the origins differ by subdomain, browsers treat API requests as cross-origin. Credentialed Axios requests (`withCredentials: true`) require explicit CORS preflight handling (`OPTIONS`), exact origin reflection, and `Access-Control-Allow-Credentials: true`. The existing codebase lacked explicit CORS response headers.

### 2. Decision Taken

1. Implement native, zero-dependency CORS middleware in Express matching configured `WEB_ORIGIN` (and optional list of allowed origins).
2. Explicitly handle HTTP `OPTIONS` preflight requests returning `204 No Content` with appropriate headers:
   - `Access-Control-Allow-Origin: <exact origin>`
   - `Access-Control-Allow-Credentials: true`
   - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   - `Access-Control-Allow-Headers: Content-Type, Accept`
   - `Access-Control-Max-Age: 86400`
3. Never use wildcard `*` with credentials.
4. Cookie configuration: `SameSite=Lax`, `Secure=true` in production, `HttpOnly=true`. Because both domains share the registrable domain `sridhaacademy.com`, modern browsers send `SameSite=Lax` cookies in fetch/XHR with `credentials: 'include'`.

### 3. Alternatives Considered

- `cors` npm package: Adds an extra dependency; native middleware in Express 5 is ~20 lines, fully typesafe, and audited.
- Reverse proxy everything through Cloudflare Workers under single domain `/api`: Viable future option, but dedicated API subdomain `api.sridhaacademy.com` is the chosen architecture.

### 4. Security & Operational Implications

- Origin checks in `OriginGuard` and CORS middleware work in tandem: unauthorized third-party domains are rejected both at CORS preflight and at state-changing request validation.

---

## DEC-007: Production Transactional Email Architecture (Resend Provider)

- **Decision ID**: `DEC-007`
- **Date & Time**: `2026-10-19T17:25:00+05:30` (IST)
- **Decision Title**: Introduce modular transactional email provider with Resend and SMTP support
- **Status**: Implemented

### 1. Problem or Requirement

The existing codebase only supported `MAIL_TRANSPORT=console`, which is forbidden in production (`env.ts` throws an error). For password recovery and future account verification, a production-grade transactional email service is required.

### 2. Decision Taken

Implement a provider-agnostic mailer module in `api/src/mail/mailer.ts`:

1. **Resend Provider (`MAIL_TRANSPORT=resend`)**: Sends transactional emails via Resend's REST API (`https://api.resend.com/emails`) using native Node.js `fetch`. Requires `RESEND_API_KEY` and `EMAIL_FROM`. Resend is reliable, developer-friendly, provides immediate DKIM/SPF domain verification for Indian and international domains, and has a generous free tier (3,000 emails/month).
2. **Console Provider (`MAIL_TRANSPORT=console`)**: Allowed only in `development` and `test` environments.
3. **Null Provider**: If `MAIL_TRANSPORT` is not configured, password reset endpoints return `503 PASSWORD_RECOVERY_UNAVAILABLE` rather than silently failing or throwing unhandled errors.

### 3. Alternatives Considered

- SMTP (`nodemailer`): Requires socket connection management and connection timeouts.
- SendGrid / AWS SES: Requires complex IAM or domain approval. Resend provides instant setup with clean REST APIs.

---

## DEC-008: Rate Limiting on Authentication and Sensitive Endpoints

- **Decision ID**: `DEC-008`
- **Date & Time**: `2026-10-19T17:30:00+05:30` (IST)
- **Decision Title**: Implement targeted rate limiting for registration, login, and password recovery
- **Status**: Implemented

### 1. Problem or Requirement

Public authentication endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/password-reset`, `/api/auth/password-reset/confirm`) are vulnerable to brute-force credential stuffing, password guessing, and denial-of-service email floods.

### 2. Decision Taken

Introduce `express-rate-limit` middleware with custom `ApiError` responses:

1. **Registration & Login**: Maximum 15 attempts per 15-minute window per IP.
2. **Password Reset Requests**: Maximum 5 attempts per 15-minute window per IP.
3. **General Public API**: Sensible threshold to prevent automated scrapers.
4. Returns HTTP 429 with `{ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' }`.
5. Rate limiters are disabled in `test` environment to prevent test-suite flakiness.

---

## DEC-009: Verification of PostgreSQL Schema Migrations and In-Process PGlite Test Harness

- **Decision ID**: `DEC-009`
- **Date & Time**: `2026-10-19T17:35:00+05:30` (IST)
- **Decision Title**: Dual-engine PostgreSQL architecture with PGlite for isolated tests and pg.Pool for production
- **Status**: Implemented & Verified

### 1. Problem or Requirement

Running automated PostgreSQL integration tests during local development and in restricted CI/CD environments frequently requires external PostgreSQL instances or Docker daemons. In sandboxed or developer laptop environments without running Docker, test suites fail to run, leading developers to either skip integration tests or mock database calls.

### 2. Decision Taken

Implement a dual-engine architecture in `api/src/db/client.ts`:

1. **Production & Live Staging**: Uses `pg.Pool` connecting over TLS/SSL to managed PostgreSQL via `DATABASE_URL`.
2. **Automated Testing & In-Memory Dev**: Uses `@electric-sql/pglite` (real PostgreSQL 16 compiled to WebAssembly).
3. Both engines implement the exact same `Database` interface (`query`, `get`, `all`, `run`, `transaction`, `exec`, `close`).
4. Parameterized SQL queries with `$1, $2, ...` and PostgreSQL data types execute identically on both engines.

### 3. Tests & Evidence

- 29 API tests executed and passed (100% PASS), including new dedicated suite `api/src/test/database.test.ts` verifying:
  - Sequential migrations tracking in `schema_migrations`.
  - Case-insensitive email uniqueness.
  - Foreign key cascading deletes (`users` -> `student_profiles`, `sessions`).
  - Transaction rollback atomicity on error.
  - `/api/health` connectivity verification.

---

## DEC-010: Safe SQLite to PostgreSQL Data Migration Utility

- **Decision ID**: `DEC-010`
- **Date & Time**: `2026-10-19T17:40:00+05:30` (IST)
- **Decision Title**: Provide non-destructive SQLite to PostgreSQL export script
- **Status**: Implemented & Verified

### 1. Problem or Requirement

While production has not launched with real student data, local development environments may contain test accounts in `api/data/leta-ed.sqlite`. A safe procedure is needed to transfer records without deleting or corrupting the source SQLite database.

### 2. Decision Taken

Created `api/src/db/migrateSqliteToPostgres.ts` (invocable via `npm run db:migrate:sqlite -w api`):

- Non-destructive: read-only access to the source SQLite file.
- Transactional: wraps inserts in a single PostgreSQL transaction.
- Safe conflict handling: `ON CONFLICT (id) DO NOTHING`.
- Logs migrated record counts for auditability.

---

## DEC-011: Comprehensive Engineering Documentation Suite

- **Decision ID**: `DEC-011`
- **Date & Time**: `2026-10-19T17:45:00+05:30` (IST)
- **Decision Title**: Establish docs/ documentation suite alongside DECISION.md
- **Status**: Implemented & Verified

### 1. Problem or Requirement

A production-ready platform requires clear, actionable, permanent documentation for operations, onboarding, disaster recovery, and architecture.

### 2. Decision Taken

Created the full documentation suite in `docs/`:

1. `docs/architecture.md`: Comprehensive system architecture and edge routing topology.
2. `docs/postgresql-migration-plan.md`: Relational schema mapping, constraint rationale, and migration strategy.
3. `docs/production-readiness.md`: Audited readiness matrix and launch blocker checklist.
4. `docs/development-setup.md`: Local setup, testing, and execution instructions.
5. `docs/environment-variables.md`: Complete reference of backend runtime and frontend build-time variables.
6. `docs/deployment.md`: Step-by-step instructions for provisioning Render PostgreSQL, deploying the API, configuring DNS, and linking Cloudflare Pages.
7. `docs/database-backup-and-recovery.md`: Automated snapshot policies, RPO/RTO definitions, and `pg_dump`/`pg_restore` procedures.

---

## DEC-012: Final Review, Rate Limiting Test Harness, and URL Normalization

- **Decision ID**: `DEC-012`
- **Date & Time**: `2026-10-19T17:47:00+05:30` (IST)
- **Decision Title**: Final Comprehensive Code Review and Verification of Branch feat/postgresql-production-readiness
- **Status**: Implemented, Verified & Ready for Review

### 1. Problem or Requirement

A rigorous final code review was requested across all 31 modified files before pushing or opening a PR to verify:

- Migration idempotency, foreign key cascades, and transactional integrity.
- Authentication, session cookies, CORS headers, and rate limiting behavior.
- Consistency across environment variables (`DATABASE_URL`, `WEB_ORIGIN`, `ALLOWED_ORIGINS`, `VITE_API_URL`, `MAIL_TRANSPORT`, etc.).
- Safe SQLite migration handling with zero data loss.
- Verification of test execution against actual semantics (PostgreSQL via PGlite in tests vs. hosted PostgreSQL in production).

### 2. Findings and Corrections

1. **Environment Variables**:
   - Resolved documentation vs. code variable naming: `ALLOWED_ORIGINS` (comma-delimited list for multi-origin deployments) and `WEB_ORIGIN` (single origin fallback) are both supported in `api/src/config/env.ts` and CORS headers reflect the matching client origin.
   - Verified `VITE_API_URL`: Added `normalizeApiBaseUrl` in `web/src/services/http/api.ts` to prevent missing or duplicated `/api` path segments (e.g. `.../api/api/auth/session`).
2. **Rate Limiting**:
   - In-memory `express-rate-limit` is verified on `/api/auth/register` (5 req / 15 min), `/api/auth/login` (10 req / 15 min), and `/api/auth/password-reset*` (5 req / 15 min).
   - In tests, rate limiting is bypassed via `process.env.TEST_BYPASS_RATE_LIMIT = "true"` so integration test suites are not throttled, while dedicated rate limit tests verify the 429 response when active.
   - Documented architectural limitation: In-memory store is appropriate for a single-instance deployment (e.g. Render Starter); multi-instance horizontal scaling will require a shared Redis store (`rate-limit-redis`).
3. **SQLite Data Preservation**:
   - Verified `api/src/db/migrateSqliteToPostgres.ts` uses read-only SQLite access and `ON CONFLICT (id) DO NOTHING` on PostgreSQL, preventing data loss or overwrites.
4. **Semantics Verification**:
   - Tests run against `@electric-sql/pglite` (WebAssembly Postgres 16+), exercising real Postgres relational constraints, transactions, and syntax.
   - The production deployment on Render will use hosted managed PostgreSQL; this distinction is explicitly documented as a pending production connection.

### 3. Verification Evidence

- API Tests: 31 passed (`api/src/modules/auth/auth.test.ts`, `api/src/modules/enrolments/enrolments.test.ts`, `api/src/test/database.test.ts`).
- Web Tests: 30 passed (`web/src/services/http/api.test.ts`, routing, formatter tests).
- Typecheck: 0 errors across `api` and `web`.
- Production Build: Succeeded cleanly for both `api` (`dist/`) and `web` (`dist/`).

---

## DEC-013: Production Cross-Site Cookie Policy, Origin Normalization, and Safe Auth Lifecycle

- **Decision ID**: `DEC-013`
- **Date & Time**: `2026-10-20T18:12:00+05:30` (IST)
- **Decision Title**: Production Cross-Site Session Cookie Configuration, Origin Normalization, and Safe Diagnostic Logging
- **Status**: Implemented & Locally Verified (Production Verification Pending Deployment)

### 1. Symptoms & Incident Report

During production testing on live environments:

- Frontend: `https://sridhaacademy.com` / `https://www.sridhaacademy.com` (Cloudflare Pages)
- Backend: `https://sridha-academy-api.onrender.com` (Render)
- Observed Symptoms:
  - Registration succeeded (`POST /api/auth/register` returned 201).
  - Immediately afterward, `GET /api/auth/session` and `GET /api/enrolments` returned HTTP 401 Unauthorized.
  - The client displayed "Your session has expired. Please sign in again." and dropped the student back to `/login`.
  - Logging in with valid credentials returned 200, but the session immediately failed on the next API call with 401.
  - Re-registering with the same email returned HTTP 409 Conflict, proving the initial registration record had persisted cleanly in the PostgreSQL database.

### 2. Root Cause Analysis

1. **Cross-Site Cookie Suppression (`SameSite=Lax`)**:
   - The frontend origin (`sridhaacademy.com`) and Render backend origin (`onrender.com`) are cross-site (different eTLD+1).
   - In `api/src/modules/auth/session.ts`, session cookies were configured with `sameSite: 'lax'`.
   - By web standards (RFC 6265bis) and modern browser security policies (Chrome, Safari, Firefox), `SameSite=Lax` cookies are **strictly omitted** on cross-site XHR / Fetch / Axios requests.
   - Consequently, `withCredentials: true` requests to `https://sridha-academy-api.onrender.com` arrived at Render with **no `Cookie` header**, causing `requireAuth` to return 401 Unauthorized on every subsequent call.
2. **Frontend Interceptor Cascade**:
   - In `web/src/context/AuthContext.tsx`, an Axios response interceptor for HTTP 401 on non-auth routes caught the 401 from `/api/enrolments`, invoked `clearSession()`, and showed the session expired toast.
   - On page refresh, `getCurrentSession()` was also called without cookies, failing with 401 and keeping the user in an anonymous state.
3. **CORS Headers and Origin Discrepancies**:
   - CORS middleware required exact match against `originSet`. If `ALLOWED_ORIGINS` had trailing slashes or omitted `www.sridhaacademy.com`, requests from the www subdomain were rejected.

### 3. Decisions & Fixes Implemented

1. **Cross-Site Production Cookie Attributes**:
   - In `api/src/config/env.ts` and `api/src/modules/auth/session.ts`:
     - In production (`NODE_ENV === 'production'` or `secureCookies === true`), cookies default to `sameSite: 'none'`, `secure: true`, and `partitioned: true` (CHIPS).
     - In development/test, cookies default to `sameSite: 'lax'`, `secure: false`, and `partitioned: false` (to support plain HTTP `http://localhost:5173`).
     - Added `COOKIE_SAMESITE` environment variable override (`lax` | `none` | `strict`) and optional `COOKIE_DOMAIN`.
2. **Origin Normalization & Sibling Domain Pairing**:
   - In `api/src/config/env.ts`:
     - Normalizes all origins in `WEB_ORIGIN` and `ALLOWED_ORIGINS` by trimming whitespace and stripping trailing slashes.
     - Automatically ensures that if `https://sridhaacademy.com` is present, `https://www.sridhaacademy.com` is also permitted (and vice versa).
   - In `api/src/app/app.ts`:
     - Added `Vary: Origin` header to prevent CDN/cache origin poisoning.
     - Allowed `X-Requested-With` in CORS preflight headers.
3. **Safe Diagnostic Logging**:
   - In `api/src/modules/auth/session.ts`:
     - Added non-sensitive diagnostic logging in `createSessionMiddleware` reporting booleans (`hasCookie`, `hasSessionRecord`), route path, and method.
     - Never logs raw tokens, hashes, passwords, or PII.
4. **Robust Auth Endpoint Interceptor Exclusion**:
   - In `web/src/context/AuthContext.tsx`:
     - Expanded `isAuthEndpoint` checking to match any path containing `/auth/`, ensuring auth endpoints never falsely trigger the session-expired interceptor.

### 4. Alternatives Considered

1. _Bearer Tokens in JavaScript localStorage / sessionStorage_:
   - Rejected: Storing tokens in client storage exposes students to token theft via Cross-Site Scripting (XSS). HttpOnly cookies provide vastly superior defense-in-depth.
2. _Disabling Authentication or Bypassing requireAuth_:
   - Rejected: Violates core security boundaries and privacy policies.
3. _Same-Site Subdomain Architecture (`api.sridhaacademy.com`)_:
   - Evaluated as the gold-standard permanent architecture. Once `api.sridhaacademy.com` DNS is configured, the request becomes first-party same-site, avoiding third-party cookie restrictions entirely.
   - The code now natively supports both topologies: cross-site on `onrender.com` now via `SameSite=None; Secure; Partitioned`, and same-site on `api.sridhaacademy.com` via `COOKIE_SAMESITE=lax` (or default `none`).

### 5. Verification Evidence

- `npm run typecheck`: 0 errors across `api` and `web`.
- `npm run lint`: 0 errors, 0 warnings across all TypeScript and React files.
- `npm run test`: **64/64 tests passed (34 API, 30 Web)**.
- `npm run build`: Both `api` (tsc) and `web` (vite) built clean production bundles.

---

## DEC-014: Production Security Hardening, Session Rotation, and Abuse Protection

- **Decision ID**: `DEC-014`
- **Date & Time**: `2026-10-22T14:35:00+05:30` (IST)
- **Decision Title**: Production Security Hardening, Session Rotation, and Comprehensive Abuse Protection
- **Status**: Implemented & Locally Verified (Production Verification Pending Deployment)

### 1. Problem or Requirement

A rigorous production security audit was conducted against the SriDha Academy platform (`LetaTec/LetEd`) across authentication, session lifetimes, rate limiting, password recovery, HTTP transport security, and database resilience.

Key concerns identified:

1. **Lack of Session Rotation**: When logging in with valid credentials, if an existing session token was already present in the request (`req.auth.sessionId`), a new session was inserted into the database without revoking the previous session, leading to orphaned active sessions accumulating in PostgreSQL.
2. **Missing Granular Rate Limiting**: The public enquiry waitlist (`POST /api/enquiries`) and password reset confirmation (`POST /api/auth/password-reset/confirm`) lacked dedicated rate limiting, exposing them to automated spam and brute-force token enumeration.
3. **Missing HTTP Security Headers**: API responses on Render lacked defensive security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS).
4. **OriginGuard Normalization Discrepancies**: Subtle differences in trailing slashes or whitespace in permitted origins could trigger false 403 rejections or origin mismatches.
5. **Render Free-Tier Database Lifecycle & Backups**: The free PostgreSQL instance was identified as having a 30-day automatic deletion policy (scheduled expiration: November 18, 2026) and lacks automated daily snapshots.

### 2. Decisions Taken & Changes Implemented

1. **Session Rotation on Re-Authentication**:
   - In `api/src/modules/auth/auth.routes.ts`: Prior to issuing a new session upon successful password authentication in `POST /api/auth/login`, the handler checks for `req.auth?.sessionId` and invokes `authService.deleteSession(context, req.auth.sessionId)` to revoke the previous session.
2. **Granular Rate Limiting**:
   - In `api/src/app/app.ts`:
     - Added `enquiryLimiter` (10 submissions per 15 minutes per IP) to `POST /api/enquiries`.
     - Attached `passwordResetConfirmLimiter` (10 attempts per 15 minutes per IP) to `POST /api/auth/password-reset/confirm`.
     - Standardized rate-limit error responses to return `{ message: "Too many requests. Please try again later.", code: "TOO_MANY_REQUESTS", details: null }` with HTTP 429.
3. **Defensive HTTP Security Headers**:
   - In `api/src/app/app.ts`: Injected security headers on all responses:
     - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none';`
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforced when `NODE_ENV === 'production'`)
4. **OriginGuard Normalization**:
   - In `api/src/http/originGuard.ts`: Normalized all incoming origin and referer values (stripping whitespace and trailing slashes) before validating against permitted origins.
5. **Database Durability & Disaster Recovery Procedure**:
   - Documented Render PostgreSQL lifecycle risks and recovery drill in `docs/database-backup-and-recovery.md`.
   - Outlined manual `pg_dump` export and verification drill, and recommended upgrading to Render Starter ($7/mo) to unlock automated daily physical snapshots and eliminate the 30-day expiration.

### 3. Verification Evidence

- `npm run typecheck`: **0 errors** across both `api` and `web`.
- `npm run lint`: **0 errors, 0 warnings** across all files.
- `npm run test`: **67/67 tests passing (37 API, 30 Web) — 100% PASS**:
  - Validated session rotation revokes old session on re-login.
  - Validated rate limit 429 responses on auth and enquiry endpoints.
  - Validated presence of security headers on API responses.
- `npm run build`: Both `api` and `web` built clean production bundles with zero errors.

---

## DEC-015: Professional Multi-Format Brand Favicon Suite

- **Date & Time**: `2026-10-22T15:25:00+05:30` (IST)
- **Decision Title**: Implement Professional Multi-Format SriDha Academy Favicon Suite
- **Status**: Implemented & Verified

### 1. Problem or Requirement

The website previously relied on a single unoptimized 64x64 PNG (`favicon.png`). Modern web clients, mobile browsers, and desktop bookmarks expect standard multi-format favicon assets:

1. An SVG vector favicon (`favicon.svg`) that scales infinitely and responds cleanly to light and dark browser themes.
2. High-DPI raster icons (`favicon-32x32.png`, `favicon-16x16.png`) for high-resolution desktop browser tabs.
3. A multi-resolution Microsoft Windows ICO file (`favicon.ico`) containing 16x16, 32x32, and 48x48 PNG frames for bookmark bars and legacy desktop clients.
4. An Apple Touch Icon (`apple-touch-icon.png`, 180x180) with appropriate padding and an opaque background for iOS Home Screen shortcuts.
5. HTML link tags in `web/index.html` referencing the full suite with standard MIME types.

### 2. Design & Implementation Details

- **Visual Source**: Extracted the official geometric SriDha Academy symbol from `web/src/assets/brand/sridha-logo.png` (excluding the wordmark and tagline).
- **Brand Colors**:
  - Forest Green: `#1e332c` (light theme / standard)
  - Golden Yellow: `#f9b522` (primary brand accent)
  - Light Ink: `#fbfaf5` (dark mode preference in SVG, matching `--color-text-inverse`)
- **Assets Created**:
  - `web/public/favicon.svg`: Vector SVG with embedded media query `@media (prefers-color-scheme: dark)` adapting the green elements to light cream while preserving the golden-yellow accents.
  - `web/public/favicon-32x32.png`: 32x32 transparent PNG.
  - `web/public/favicon-16x16.png`: 16x16 transparent PNG.
  - `web/public/favicon.ico`: 3-frame Windows ICO resource (16x16, 32x32, 48x48).
  - `web/public/apple-touch-icon.png`: 180x180 PNG with solid white background and 15% safe padding for iOS squircles.
  - `web/public/favicon.png`: Refreshed 64x64 PNG for backward compatibility.
- **HTML & Edge Headers**:
  - Updated `web/index.html` to declare `icon` (SVG, 32x32, 16x16), `apple-touch-icon`, and `shortcut icon`.
  - Updated `web/public/_headers` to enforce Cloudflare Pages caching (`Cache-Control: public, max-age=86400, stale-while-revalidate=604800`) on all favicon assets.

### 3. Verification Evidence

- `npm run typecheck`: Passed (0 errors).
- `npm run lint`: Passed (0 errors, 0 warnings).
- `npm run test`: Passed (67/67 tests).
- `npm run build`: Succeeded. All assets copied to `web/dist/` with correct root paths.

---

## DEC-016: Opaque Pure White Background for Favicon Suite

- **Date & Time**: `2026-10-22T18:45:00+05:30` (IST)
- **Decision Title**: Standardize Favicon Suite on Pure Opaque White (#FFFFFF) Canvas
- **Status**: Implemented & Verified

### 1. Problem or Requirement

The transparent background on browser tab favicons can lead to reduced legibility or visual inconsistency across diverse browser themes (e.g. dark browser tabs, translucent OS title bars, or custom browser skins). A unified, high-contrast, pure solid white (`#FFFFFF`) background was required across all favicon formats so that the geometric brand symbol (forest green `#1e332c` and golden yellow `#f9b522`) is consistently framed and instantly recognizable in all browser environments.

### 2. Implementation Details

1. **SVG Favicon (`web/public/favicon.svg`)**:
   - Added explicit background `<rect width="256" height="256" fill="#ffffff" />`.
   - Removed `@media (prefers-color-scheme: dark)` styling overrides to keep the symbol in its authentic brand colors (`#1e332c` forest green and `#f9b522` golden yellow) on top of the solid white background.
2. **Raster PNG Assets**:
   - Re-rendered all PNG assets (`apple-touch-icon.png` 180×180, `favicon.png` 64×64, `favicon-32x32.png` 32×32, and `favicon-16x16.png` 16×16) with 100% opaque, solid `#FFFFFF` pixel backgrounds.
   - Preserved optical centering and protective padding around the symbol.
3. **Multi-Resolution Windows ICO (`web/public/favicon.ico`)**:
   - Reassembled the 3-frame ICO resource (16×16, 32×32, 48×48) using the new opaque white raster assets.
4. **HTML & Headers**:
   - Verified `web/index.html` link references and `web/public/_headers` cache-control policies.

### 3. Verification Evidence

- `npm run typecheck`: Passed (0 errors across `api` and `web`).
- `npm run lint`: Passed (0 errors, 0 warnings).
- `npm run test`: Passed (67/67 tests).
- `npm run build`: Succeeded. All assets copied to `web/dist/` with opaque white backgrounds verified.
- `git diff --check`: Passed (clean whitespace).

---

## DEC-017: Premium Animated Subject-Card Showcase on Login Page

- **Date & Time**: `2026-10-24T12:35:00+05:30` (IST)
- **Decision Title**: Implement Fast, Continuous FLIP-Animated Academic Subject Deck on Login Page
- **Status**: Implemented & Verified

### 1. Problem or Requirement

The right-hand section of the SriDha Academy login page (`/login`) required an upgraded, premium visual identity to match modern high-end education platforms.
Key requirements:

1. **Continuous Autonomous Motion**: The card deck must continuously rotate through subjects without requiring mouse interaction, and hovering or interacting with the form must never pause or alter the shuffle timing.
2. **Faster, Rhythmic Animation**:
   - Initial delay: ~1,000 ms.
   - Shuffle start interval: 1,850 ms (within the 1,600–2,000 ms specification).
   - Card movement duration: 550 ms (within 500–650 ms) using `cubic-bezier(0.22, 0.61, 0.36, 1)`.
   - Card stagger: 45 ms per slot (within 40–80 ms).
3. **Significantly Larger Cards**:
   - Prominent 2-column desktop layout with minimum 220 px height (within 200–260 px).
   - Generous internal padding (24 px), larger typography (25 px serif `Cormorant Garamond`), 44 px circular icon badges.
   - Visual-only hover effects (fine border highlight and soft box shadow) without CSS hover transforms to avoid interfering with FLIP coordinates.
4. **Expanded Subject Collection (23 Subjects)**:
   - Includes all 11 original subjects (GST, Science, English, Accounts, Economics, Mathematics, Business Studies, Banking Reasoning, Rectification of Errors, Trial Balance, Bank Reconciliation Statement).
   - Plus all 12 requested subjects (Accountancy, Business Mathematics, Statistics, Logical Reasoning, Quantitative Aptitude, English Grammar, Reading Comprehension, Financial Accounting, Partnership Accounts, Cash Flow Statements, Probability, Data Interpretation) with dedicated Lucide icons.
5. **Clean Two-Column AuthPage Composition**:
   - Left side: SriDha Academy logo, student access eyebrow, editorial heading, topic-wise learning description, and prominent login form.
   - Right side: Explore Subjects eyebrow, rotating subjects counter badge with pulsing dot, and the 4-card animated deck.
   - Dynamic `prefers-reduced-motion` compliance.

### 2. Architecture & Decision Taken

1. **First-Last-Invert-Play (FLIP) Animation Architecture**:
   - Standard, in-flow 2-column CSS Grid (`grid-template-columns: repeat(2, minmax(0, 1fr))`).
   - Before React updates visible subjects, `handleBeforeShuffle()` records exact DOM coordinates using `getBoundingClientRect()`.
   - React updates the visible array of 4 subjects with stable `key={subject.id}` props.
   - Synchronously in `useLayoutEffect`:
     - Calculates delta translation `(dx, dy)`.
     - Inverts position with `transform: translate3d(dx, dy, 0)`.
     - Forces reflow (`void el.offsetHeight`).
     - In `requestAnimationFrame`, transitions `transform` to `translate3d(0, 0, 0)` over 550 ms with a 45 ms slot stagger.
     - New incoming cards smoothly glide in with `opacity: 0 -> 1` and `scale(0.96) -> scale(1)`.
     - Cleans up inline transforms after 800 ms.
2. **Continuous Timer & Complete Hover Separation**:
   - The shuffle timer runs strictly in `useSubjectShuffle` via recursive `setTimeout` with `document.hidden` awareness.
   - All hover/focus pause handlers (`onMouseEnter`, `onMouseLeave`, `onFocusCapture`, `onBlurCapture`) were eliminated.
   - Card `:hover` styles use `box-shadow` and `border-color`, completely avoiding `transform` conflicts with active FLIP animations.
3. **Design System & Typography**:
   - Uses SriDha Academy's official design tokens: `#1e332c` (forest green), `#faf9f6` (warm white), `#ffffff` (card background), `#946d50` (warm brown), `#f9b522` (gold accent).
   - Editorial serif `Cormorant Garamond` for headings and subject titles; sans-serif for metadata and labels.

### 3. Verification Evidence

- `npm run typecheck`: Passed (0 errors across `api` and `web`).
- `npm run lint`: Passed (0 errors, 0 warnings across all files).
- `npm run test -w web`: **41/41 tests passed (100% PASS)**, including all tests in `OngoingTopics.test.tsx` verifying continuous shuffling, hover independence, unmount cleanup, and reduced-motion stability.
- `npm run build -w web`: Production Vite build succeeded cleanly in 1.32s.
- `git diff --check`: Clean whitespace, no warnings.

---

## DEC-018: SriDha — The Living Library (Floating Layered Academic Deck Redesign)

- **Date & Time**: `2026-10-24T13:24:00+05:30` (IST)
- **Decision Title**: Implement SriDha — The Living Library Art-Directed Floating Subject Deck
- **Status**: Implemented & Verified

### 1. Problem or Requirement

The previous implementation of the login page showcased four cards in an ordinary 2x2 grid. While the animation was technically functional, the visual composition felt like a conventional SaaS template rather than a bespoke, art-directed editorial experience for an elite academic academy.

Key requirements:

1. **The Living Library Floating Deck**: Replace the uniform 2x2 grid with an intentional, layered arrangement of floating subject cards featuring depth, subtle rotations (`-4.5deg` to `+4deg`), overlapping foreground and background layers, and rich ambient shadows.
2. **Autonomous Continuous Dealing Motion**: Cards physically travel continuously through deck layers:
   - Initial delay: `700 ms`
   - Cycle interval: `1,400 ms`
   - Movement duration: `750 ms` with cubic-bezier easing `cubic-bezier(0.25, 1, 0.5, 1)`
   - Hero card (Slot 0) deals off with a graceful exit glide; background cards step forward through the fan layers (`slot3 -> slot2 -> slot1 -> slot0`); upcoming subjects emerge into the back of the deck (`slot3`).
3. **Controlled Visual Themes for All 23 Subjects**:
   - Each subject belongs to one of 8 bespoke academic themes with distinctive background palettes, typographic weights, and SVG/CSS visual motifs:
     - `tax-ledger`: Forest green (`#1e332c`), gold stamp, fiscal invoice rules (GST, Cash Flow, Bank Reconciliation).
     - `ledger-ivory`: Warm ivory (`#fbfaf6`), double-entry ledger ruling, debit/credit guides (Accountancy, Financial Accounting, Partnership, Rectification, Trial Balance).
     - `terracotta-data`: Muted terracotta (`#b5623d`), vector trend curves, data equilibrium (Economics, Statistics, Data Interpretation).
     - `graphite-geometric`: Deep slate graphite (`#212826`), Cartesian coordinate grid, calculus & matrix notation (Mathematics, Business Math, Probability, Quantitative Aptitude).
     - `sage-molecular`: Pale sage (`#f3f7f1`), concentric orbital concept rings (Science).
     - `ochre-logic`: Muted gold/ochre (`#c99738`), syllogistic deduction matrix (Banking Reasoning, Logical Reasoning).
     - `editorial-serif`: Editorial white (`#ffffff`), prominent quotation ornament, syntax lines (English, English Grammar, Reading Comprehension).
     - `architectural-green`: Classical pine (`#1a342c`), architectural enterprise foundation pillars (Business Studies).
4. **Art-Directed Page Composition**:
   - Left side: Official SriDha Academy `BrandLogo` masthead, `STUDENT ACCESS` kicker, editorial headline ("Big Subjects. Broken Into Small Victories."), lead paragraph, and fully functional authentication form.
   - Right side: `The Living Library` eyebrow, rotating counter badge (`Rotating 23 Subjects`), editorial subhead, and the 3D-perspective floating deck stage (`height: 420px`).
5. **Robustness & Accessibility**:
   - Decoupled from hover: pointer movement never pauses or resets the animation.
   - Dynamic `prefers-reduced-motion` compliance: provides a stable, elegant stacked fan composition without active motion when reduced motion is requested.
   - Bounded visibility listener: pauses when `document.hidden`, resumes when active.

### 2. Verification Evidence

- `npm run typecheck`: Passed (0 errors across `api` and `web`).
- `npm run lint`: Passed (0 errors, 0 warnings).
- `npm run test -w web`: **41/41 tests passed (100% PASS)**, including comprehensive timer and deck cycle tests in `OngoingTopics.test.tsx`.
- `npm run build -w web`: Built clean production bundle in 1.31s.
- `git diff --check`: Clean whitespace, zero warnings.

---

## DEC-019: SriDha Academy — Complete Premium Frontend Redesign (Contemporary Editorial & Academic Atlas)

- **Date & Time**: `2026-10-27T19:08:00+05:30` (IST)
- **Decision Title**: Execute complete premium frontend redesign across design system tokens, `/login`, and the homepage
- **Status**: Implemented & Verified

### 1. Problem & Creative Direction

SriDha Academy required a comprehensive transformation from a generic digital product aesthetic into a distinctive, luxurious, and academically sophisticated educational platform styled around the concept:

> _"An exceptional academic institution, expressed through contemporary editorial design."_

The redesign strictly avoids generic SaaS tropes (no purple-blue gradients, no default glassmorphism, no random floating blobs, no repetitive card clones, and no chaotic card animations). Instead, it elevates composition, whitespace, typography, and architectural restraint.

### 2. Implementation Architecture

1. **Shared Design System Tokens (`web/src/styles/tokens.css`)**:
   - Primary Editorial Canvas: Warm ivory `#F7F5EF` (`--color-bg-page`)
   - Surface Contrast & Sheet: Pure white `#FFFFFF` (`--color-bg-sheet`, `--color-bg-raised`)
   - Primary Brand Ink & Actions: Deep forest green `#20392F` (`--color-bg-inverse`, `--color-border-strong`)
   - Primary Body Ink: Dark charcoal `#252823` (`--color-text-primary`)
   - Accent Moments: Antique gold `#B69A5A` (`--color-accent`, `--color-text-accent`, `--color-border-focus`)
   - Muted Editorial Tint: Muted sage `#DCE4DA` (`--color-illus-sage`)
   - Secondary Text: `#77776F` (`--color-text-muted`)
   - Subtle Architectural Hairline: `#E5E1D7` (`--color-border-base`)
   - Typographic System: Google Fonts `Cormorant Garamond` (editorial serif) + `DM Sans` (legible modern sans) with responsive `clamp()` scaling.

2. **Login Page (`/login`) — Two-Part Art-Directed Experience**:
   - **Left (Authentication Area)**:
     - Official SriDha Academy `BrandLogo` masthead with institutional border divider.
     - Institutional kicker: `STUDENT ACCESS` with fine antique gold rule.
     - Editorial display headline: _"Master one concept at a time."_
     - Focused topic-wise explanation: _"Complex subjects become manageable through structured, topic-wise learning. Complete verifiable concept milestones, test with AI assessment papers, and attend scheduled live batches."_
     - Trustworthy authentication form with crisp hairline borders, pure white card face, antique gold focus states, and deep forest green primary action button.
     - Institutional security footnote: _"INSTITUTIONAL ACCESS · SriDha Academy Academic Delivery Framework · Secure Session Verification"_.
   - **Right (The Academic Atlas Folio)**:
     - Replaced the arcade-style floating card deck with an **Editorial Curriculum Folio Plate**.
     - Institutional Folio Header: `FOLIO SPECIFICATION · REF 2026` and `ACADEMIC PLATE 01`.
     - **Featured Major Subject Plate** (`slot0`):
       - Generous pure white card face with subtle border and elevation.
       - Discipline kicker with antique gold rule: e.g. `SECTION I · FEATURED DISCIPLINE` / `COMMERCE & TAX`.
       - Oversized Cormorant Garamond title (`GST`, `Science`, `Accounts`, `Economics`).
       - Authentic discipline motif stamps and SVG vector seals.
       - Verified curriculum module checklist (`• Live Topic Classes`, `• AI Test Paper Included`, `• Concept Verification`).
       - Clear tuition fee / batch schedule and accessible primary action.
     - **Secondary Curriculum Index Grid** (`slot1`, `slot2`, `slot3`):
       - 3-column ruled index row displaying upcoming subjects with numerical tags (`02`, `03`, `04`), discipline tags, iconography, and semantic status dots.
     - **Controlled Editorial Transition**: The frame, folio header, and layout remain completely stable; the featured subject and index entries transition smoothly with quiet opacity and subtle slide (`--transition-reveal: 800ms`), with zero wild tilting or disorienting movement.
     - Accessible button roles ensuring 100% test compatibility with `OngoingTopics.test.tsx`.

3. **Homepage (`/`) Redesign**:
   - `SiteHeader`: Warm ivory translucent bar (`rgb(247 245 239 / 0.94)`), subtle border, uppercase navigation tracking with antique gold active underline indicator, and deep forest green primary button.
   - `HeroSection`: Generous editorial rhythm, Cormorant Garamond hero headline (_"Big Subjects. Broken Into Small Victories."_), StatList with architectural vertical hairline dividers, and seamless integration with `InteractiveBook`.
   - `TopicPreviewGrid`: Refined white cards on ivory canvas, antique gold focus rings, clear price and batch start indicators.
   - `AiTestSection`: Deep forest green inverse canvas (`#20392F`) with `SampleTestPaper` styled like an authentic university examination manuscript with OMR answer bubbles.
   - `ProgramsSection`: Tiled grid with pure white card faces, Roman numeral discipline tags (`01 / CLASSES`, `02 / ASSESSMENT`, `03 / PREDICTION`), and editorial buttons.
   - `AboutSection` & `TeamSection`: Refined two-column editorial layout and monogrammed faculty cards.
   - `SiteFooter`: Deep forest green institutional base with official stacked light logo, antique gold section headers, and copyright notices.

4. **Preservation of Core Functionality**:
   - All authentication flows (login, register, forgot password, super-admin sign-in), token parameters (`redirect_to`), session restorations, and catalogue API bindings are 100% preserved.

### 3. Verification Evidence

- `npm run typecheck`: Passed (0 errors across `api` and `web`).
- `npm run lint -w web`: Passed (0 errors, 0 warnings).
- `npm run lint -w api`: Passed (0 errors, 0 warnings).
- `npm run test -w web`: **41/41 tests passed (100% PASS)** across all 7 test files (`routing.test.tsx`, `OngoingTopics.test.tsx`, `SampleTestPaper.test.tsx`, `bookPages.test.ts`, `bookState.test.ts`, `api.test.ts`, `formatters.test.ts`).
- `npm run build -w web`: Production Vite build succeeded in 1.28s with 0 warnings.
- `npm run format:check`: Passed (All matched files use Prettier code style).
- `git diff --check`: Passed cleanly with zero whitespace or conflict markers.

---

## DEC-020: Single-Source Topics, Shared API Contracts and Production Internals

- **Decision ID**: `DEC-020`
- **Date & Time**: `2026-10-31T14:30:00+05:30` (IST)
- **Decision Title**: Serve topics only from the API, share request/response types, and add data layers, startup checks, structured logs, clean-up, CI and error alerts
- **Status**: Implemented & Locally Verified (Production Verification Pending Deployment)

### 1. Problem or Requirement

A structural review found gaps that cause real bugs as the platform and team grow:

1. **Two topic lists.** The 156 topics were typed out in `web/src/constants/topics.ts` and copied into `api/src/db/topicLibrary.ts` by a script. Editing one and forgetting the export made them disagree, against the rule that the API is the only source of truth for the catalogue.
2. **Types defined twice.** `Topic`, `Batch`, `Checkout` and the rest were declared separately in the API and the website, so an API change could break the website without failing any build.
3. **Uneven layering.** Only the catalogue had a repository; other services ran SQL directly and enquiries was a routes file.
4. **Home-made server-data handling** (`useCatalogue`'s module cache, `useEffect` fetching in My learning and team orders).
5. **Operations.** Missing Razorpay settings silently fell back to a test gateway in production; logs were unstructured `console` lines with no way to follow one request; expired sessions and tokens were never deleted; nothing ran the tests on GitHub; nobody was alerted to errors.

### 2. Decisions Taken

1. `api/src/db/topicLibrary.ts` is the only hand-edited topic list. Migration `007_topic_card_fields` adds `short_title`, `icon` and `featured_rank` to `topics` (filling existing rows), the seed writes them, and `GET /api/catalogue` returns them. The website builds topic cards from the catalogue (`toTopicPreviews`, `useTopicPreviews`); the export script is removed.
2. `api/src/contracts/*` holds every request and response type. The API checks responses with `satisfies <Response>` and schemas with `satisfies z.ZodType<Request>`; the website imports the same files through the `@contracts/*` alias, type-only.
3. Every SQL statement lives in a module repository (`auth`, `enrolments`, `payments`, `admin`, `enquiries`, `catalogue`).
4. The website reads server data through TanStack Query; the catalogue is persisted in `localStorage` for a day so returning visitors see topics while the API wakes up.
5. Production refuses to start without `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`; `ALLOWED_ORIGINS` and `SUPER_ADMIN_EMAILS` entries are validated.
6. A JSON logger (`api/src/logging/logger.ts`) with request ids (`X-Request-Id`), an hourly clean-up job, a GitHub Actions workflow, and Sentry error reporting that is off until a DSN is set.

### 3. Why the Decision Was Taken

- One list and one set of types turn silent drift into compile errors.
- Repositories keep services readable and SQL reviewable in one place per module.
- TanStack Query is the standard for retries, focus refetch and invalidation, replacing per-page hand-written loading code.
- Failing fast at startup is safer than taking payments that can never be confirmed.
- Request-scoped logs and alerts are the minimum needed to support real payments.

### 4. How It Is Implemented

- API: `contracts/`, `modules/*/*.repository.ts`, `logging/logger.ts`, `logging/errorReporting.ts`, `http/requestContext.ts`, `jobs/cleanup.ts`, migrations `006_cleanup_and_payment_indexes` and `007_topic_card_fields`.
- Website: `services/catalogue/topicPreviews.ts`, `hooks/useTopicPreviews.ts`, `hooks/useMyLearning.ts`, `hooks/useTeamOrders.ts`, `hooks/useRefreshAfterPayment.ts`, `app/queryClient.ts`, `app/errorReporting.ts`.
- CI: `.github/workflows/checks.yml`.
- Removed: `scripts/export-topic-library.ts`, `api/src/db/migrateSqliteToPostgres.ts` (and its test), `DATABASE_PATH`.

### 5. Alternatives Considered

- **OpenAPI with generated clients** for the contracts: more tooling and a generation step for a two-package repository; shared TypeScript types give the same compile-time guarantee today.
- **A separate `packages/contracts` workspace:** the API's `rootDir` build would need project references; keeping the folder inside the API (which owns the shapes) avoids that.
- **Keeping a static topic snapshot in the website** for instant first paint: reintroduces the second list. The persisted query cache covers returning visitors instead.

### 6. Trade-offs & Disadvantages

- A first-time visitor sees a loading state for topics until the API answers; on Render's free tier a cold start can take 30–50 seconds.
- The website type-checks files from `api/src/contracts`, so those files must stay free of runtime and Node-only imports.

### 7. Security Implications

- Error reports exclude user details, cookies, headers, request bodies and query strings. `/api/health` no longer returns database error messages.
- The CSP allows Sentry's ingest hosts.
- `body-parser` and `follow-redirects` were updated for high-severity advisories.

### 8. Operational Implications

- Migrations 006 and 007 run automatically on the next API start; no manual seed is required for the card fields.
- To enable alerts: set `SENTRY_DSN` on Render and `VITE_SENTRY_DSN` in Cloudflare Pages (then redeploy).
- Mark both GitHub Actions jobs as required checks on `main`.

### 9. Cost Implications

- None required. Sentry's free tier covers current volume.

### 10. Tests & Evidence

- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `npm run test`: API 81 passed, website 76 passed (including new config, clean-up, catalogue, migration-backfill, error-reporting and topic-card tests).
- `npm run test:e2e -w web`: 16 passed (desktop and mobile).

### 11. Follow-up Actions

- Upgrade the Render PostgreSQL instance before its free-tier expiry (November 18, 2026, see DEC-014) and set up backups.
- Teacher accounts, once class delivery is decided.

## DEC-021: Finance Audit Remediation — Invoicing Off Until GST Is Collected and Approved

- **Decision ID**: `DEC-021`
- **Date**: `2026-11-17`
- **Decision Title**: Tax invoices are issued only for GST actually collected, behind a recorded CA approval, outside the payment-capture transaction
- **Status**: Implemented & Locally Verified (not committed, not deployed)

### 1. Context / Problem

An independent audit of `feat/finance-platform` (November 2026) proved by execution that:

- an invoice was issued for every captured payment with 18% GST added **on top of** the amount collected (₹129.00 captured, invoice ₹152.22);
- it was issued while the tax configuration was still pending CA approval (`tax_status = PENDING_CONFIGURATION`);
- invoice reconciliation wrote the number, invoice and snapshot as separate commits, leaving a permanent invoice with no snapshot when the last step failed;
- an invoicing error inside the capture transaction aborted it, so Razorpay's capture webhook returned 500 and the payment stayed `CREATED`;
- issued invoices could be edited or deleted, the financial year was computed in UTC, missing addresses were replaced with placeholders (including the supplier's own PIN), and a public quote endpoint produced GST figures that checkout never charged.

### 2. Decision(s)

1. **Two switches activate invoicing**: `INVOICING_ENABLED=true` and an `APPROVED`, effective row in the new append-only `tax_configuration_approvals` table matching the exact configuration in code (supplier GSTIN, SAC, rate, pricing mode, calculation version, rounding policy). A later `REVOKED` row, a changed configuration, an approval dated before GST registration (1 July 2026 IST) or not yet effective all switch it off.
2. **Only GST that was collected is invoiced.** A payment is invoiceable only when `tax_status = 'QUOTED'` with its redeemed quote (`payments.tax_quote_id`, new), the quote's total equals the captured amount, and the payment was made on or after the approval took effect. Today's checkout charges the catalogue price and never sets `QUOTED`, so **no invoice is issued for any payment taken now**, and no historical invoice can be backdated.
3. **Capture never depends on invoicing.** Issuance was removed from `applyPaymentEvent`; the hourly finance job issues invoices afterwards.
4. **One transaction per invoice**: the payment row is locked, then number allocation, invoice and snapshot commit or roll back together.
5. **Database guards (migration `018_invoicing_safeguards`)**: invoices immutable; the sequence starts at 1 and only advances by one; an invoice must take the number just allocated; an invoice cannot commit without its snapshot (deferred constraint trigger); a snapshot must equal the amount collected on a paid, `QUOTED` payment.
6. **No invented details**: incomplete billing details stop issuance with `INCOMPLETE_BILLING_DETAILS`.
7. **Financial year from the Indian calendar date** (UTC+05:30).
8. **The public `POST /api/payments/tax-quotes` route is removed** until checkout charges quotes. `redeemTaxQuote` (locked; ownership, expiry, single use, item, price, billing and configuration checks) is ready for that integration but not wired in.

### 3. Alternatives Considered

- Back-calculating GST out of the amount already collected (treating prices as GST-inclusive): rejected, as it changes the commercial terms and is a CA and owner decision.
- A SAVEPOINT around issuance inside the capture transaction: rejected, because it still couples capture latency and locks to invoicing.
- Disabling payments until invoicing is fixed: rejected, because customers must still be able to pay.

### 4. Reason

An invoice must never state an amount or tax that was not collected. Payment recording is the priority; tax documents follow it and must be correct or absent.

### 5. Consequences / Trade-offs

- Until checkout charges quoted GST and the CA approval is recorded, the platform issues **no tax invoices**. Checkout copy still promises a "tax invoice"; that is an open owner decision.
- Invoices appear up to an hour after payment once active (job cadence).
- Migration 018 undo is documented in `api/src/db/migrations.ts`. It applied cleanly to a throwaway copy of the local development data (migrations 012–018; the existing payment stays `LEGACY_UNREVIEWED`).
- Recording an approval is a manual SQL insert by the owner (no screen yet).

### 6. Tests & Evidence (2026-11-17)

- `npm run typecheck` 0 errors; `npm run lint` 0 problems; `npm run build` passed.
- `npm test -w api`: 233 passed, 0 failed, 0 skipped. This includes 6 tests on a throwaway real PostgreSQL 16 database (`TEST_DATABASE_URL`; concurrent job runs, concurrent issuance of one payment, concurrent quote redemption, rollback without gaps, capture during an invoicing outage).
- `npm test -w web`: 101 passed (14 files).
- Mutation check: each of 17 fixes was reverted one at a time in a scratch copy, and the guarding test failed each time.
- Not run: Playwright e2e. `npx prettier --check .` still reports 37 pre-existing files outside this change.

## DEC-022: Phase 1 Financial Foundation — Ledger Truth, Refund Safety, Role Separation

- **Decision ID**: `DEC-022`
- **Date**: `2026-11-17`
- **Decision Title**: Fix every finding of the independent verification of DEC-021 before any dashboard or BI work
- **Status**: Implemented & Locally Verified (not committed, not deployed; awaiting an independent read-only audit)

### 1. Context / Problem

A fresh-context, read-only audit verified DEC-021. It found C1, C3, C4, H2 and H3 fixed, and C2, H1 and H5 partial. It also found new, reproduced defects:

- the finance report counted unpaid orders as collected;
- a refund missing from Razorpay's list was marked FAILED for good (a later "processed" was ignored), freeing its amount for a second refund;
- the invoice job could starve behind 50 payments that keep failing;
- confirmation emails could be delivered twice;
- immutability could be bypassed with TRUNCATE, by disabling triggers, or with `session_replication_role`;
- production PostgreSQL skipped TLS certificate verification;
- checkout promised a tax invoice that is never issued.

### 2. Decisions

1. **Report:** only PAID payments count as collected. Processed refunds are deducted; pending (and under-review) refunds are shown separately. The summary states it covers captured amounts, not bank receipts. CSV neutralises leading tab and CR formulas. One request covers at most 20,000 rows.
2. **Refunds:**
   - Absence from Razorpay's list never fails a refund. After 24 hours it becomes `REQUIRES_REVIEW`, a new state that keeps its amount reserved.
   - Razorpay reporting a refund processed overrides a locally recorded FAILED. This is audited, and refused if it would exceed the captured amount. PROCESSED stays final.
   - Only definite refusals are failures; 408, 409, 429 and 5xx are "unknown".
   - The refund list is read page by page.
   - `X-Refund-Idempotency` is sent with the refund receipt (Razorpay documents this header for refunds).
3. **Approvals:**
   - The latest record is decided by a database identity (`seq`), never caller timestamps.
   - An approval cannot take effect before it is recorded (checked in the service and the database).
   - Recording and revoking go through `POST /api/finance/tax-approvals`, which is super-admin only, audited (`TAX_APPROVAL_RECORDED`) and always uses the configuration in code. Finance staff can read the state.
   - Issuing an invoice re-checks the approval inside its transaction, under a shared advisory lock that a revocation takes exclusively.
4. **Invoice job:**
   - Failed payments back off (1h, 2h ... 24h) in `invoice_issuance_attempts`, and never-tried payments go first.
   - `processed` counts only invoices created by the run.
   - Older invoices that break the money rules are reported, never changed.
5. **Database (migration `019_finance_integrity_hardening`):**
   - TRUNCATE is refused on every financial table.
   - Invoices are unique per (financial year, sequence), and the number text must be `INV/<year>/<sequence>`.
   - Snapshots must belong to an invoice and match every quoted amount.
   - Only an unused quote's status may change.
   - `email_outbox.claim_token` is added, and the 018 check constraint is validated.
6. **Role separation (owner decision B):** `MIGRATION_DATABASE_URL` (owner) runs migrations and grants a restricted `DATABASE_URL` role that owns nothing and may only insert into append-only records. Single-role mode is unchanged for local development. See `docs/database-roles.md`.
7. **TLS:** production verifies the database certificate (`DATABASE_SSL=verify`, optional `DATABASE_SSL_CA`), refuses `disable`, and ignores TLS settings inside URLs, which node-postgres would otherwise let override verification.
8. **Outbox:**
   - Each email carries its stable key as Resend's `Idempotency-Key` (Resend keeps keys for 24 hours).
   - Only the worker holding the current claim token may record a result.
   - A failed "mark sent" no longer counts as a failed send.
   - An email abandoned on its last attempt is failed, not resent.
   - Log lines mask recipient addresses.
9. **Checkout (owner decision A):** the approved neutral wording replaces every tax-invoice promise. A test keeps "tax invoice" out of checkout copy.

### 3. Alternatives Considered

- Marking absent refunds FAILED after a longer delay: rejected. Any automatic FAILED can free money Razorpay actually refunded, so a person decides instead.
- Requiring `MIGRATION_DATABASE_URL` in production: deferred. It would stop an unprepared deployment, so a loud warning was chosen; it can be made mandatory once production is configured.
- Allowing `DATABASE_SSL=disable` in production for private networks: rejected, per the owner's TLS requirement.

### 4. Reason

Business intelligence built on these records must start from figures that agree with Razorpay and with each other.

### 5. Consequences / Trade-offs

- `REQUIRES_REVIEW` refunds need a person, and there is no screen yet (Phase 2).
- The report's summary fields changed, which is a contract change; no website screen used them.
- Recording an approval is now an API call; a screen comes with the GST centre.
- Production needs the role and TLS configuration in `docs/database-roles.md` before deployment.
- The migration 019 undo is documented in `api/src/db/migrations.ts`.

### 6. Tests & Evidence (2026-11-17)

- Typecheck 0 errors; lint 0 problems; build passed.
- API: 266 passed, 0 failed, 0 skipped. This includes real-PostgreSQL suites run against throwaway databases: invoice concurrency, and the restricted role running the whole money path.
- Web: 103 passed (15 files).
- Each of 25 fixes was reverted one at a time in a scratch copy, and its test failed every time. Two tests were tightened during this check.
- The real API started with split roles on a throwaway copy of the local development data: migrations through 019 applied, health OK, and the application role owned 0 tables. `sridha_dev` was unchanged.
- Not run: Playwright end-to-end.

## DEC-023: Phase 1.6 Financial Integrity Closure

- **Decision ID**: `DEC-023`
- **Date**: `2026-11-17`
- **Decision Title**: Close every finding of the Phase 1.5 independent audit, with database-level guards and real-PostgreSQL proof
- **Status**: Implemented & Locally Verified (not committed, not deployed; awaiting the Phase 1.7 independent audit)

### 1. Context / Problem

The Phase 1.5 independent audit gave Phase 1 a conditional pass. It reproduced:

- refunds on uncaptured payments distorting the report (N1);
- a retry backoff stuck at two hours (N2);
- the application role able to delete refund and event history and rewrite paid payments (N3);
- a same-role configuration that broke migrations (N4);
- a role check that only logged (N5);
- opposite refund lock orders (N6);
- unchecked refund webhook amounts (N7).

It also noted:

- an undocumented report date basis (N8);
- under-review refunds grouped with pending (A);
- a CSV gap for leading line feeds (B);
- the outbox's final-attempt state (C);
- no place for finance to see refund exceptions (D);
- no tests for the invoice approval lock or the Resend header.

### 2. Decisions

1. **Report:**
   - Refunds count against collections only on PAID payments, so captured − refunded = net always holds.
   - Refunds on a payment never captured here are a separate exception category, never deducted and never discarded.
   - Pending, under-review and failed refunds each have their own figure.
   - The date basis (`PAYMENT_CREATED_AT_IST`) is stated in the report.
   - CSV neutralises any text starting with a control character, or with `= + - @` after spaces or control characters. Numbers are written unchanged.
2. **Invoice retries:** the database computes the delay from the stored attempt count in one atomic upsert: 1, 2, 4, 8, 16, then 24 hours, with the exponent capped so it cannot overflow.
3. **Migration `020_financial_history_guards`:**
   - Payment events are append-only (the outcome is recorded once).
   - Refunds are never deleted; their amounts and references never change; their status only moves forward (FAILED → PROCESSED only when Razorpay confirms).
   - A PAID payment's amount, currency, Razorpay references, buyer, paid time and status are fixed, and the row is never deleted. Tax-review columns stay writable.
   - Adds outbox status `UNCONFIRMED`.
   - The application role also loses `DELETE` on payments, events and refunds.
4. **Roles:**
   - Production requires `MIGRATION_DATABASE_URL`.
   - Start-up compares the actual PostgreSQL roles: same role, membership either way, and a missing role all stop it before migrating.
   - Granting refuses to run against the owner.
   - After connecting, a full privilege inspection stops start-up on any problem. This includes CREATE in `public`, which covers the PostgreSQL 14 default.
5. **Refund locks:** one order everywhere (payment row, then refund row), for creation updates, reconciliation and webhooks.
6. **Refund webhooks:** a report whose payment, Razorpay refund id, amount or currency differs from the refund on record changes nothing. It is stored as `REJECTED_MISMATCH` and audited as `REFUND_EXCEPTION_RECORDED`. Reconciliation sends a listed refund with a different amount to review.
7. **Visibility:** `GET /api/finance/refund-exceptions` (finance staff) lists open review and uncaptured-payment refunds, and the mismatch reports.
8. **Outbox:** an email abandoned on its last attempt is `UNCONFIRMED`, never resent automatically. A manual resend within 24 hours carries the same Resend key.
9. **Tests:**
   - Real-PostgreSQL suites now report "NOT RUN" without `TEST_DATABASE_URL`.
   - `npm run test:postgres -w api` (`REQUIRE_POSTGRES_TESTS=1`) fails if the database is missing.

### 3. Alternatives Considered

- Deducting refunds on uncaptured payments: rejected; it breaks the identity and hides unreconciled money.
- A blanket immutability trigger on refunds: rejected; refunds have legitimate status transitions.
- Keeping production single-role with a warning: rejected after the audit; a warning does not protect anything.
- Choosing a new accounting date basis: not done; this is a CA decision.

### 4. Reason

Figures must reconcile, and history must hold at the database level, whatever code or role writes the rows.

### 5. Consequences / Trade-offs

- Production cannot start without the two-role configuration (`docs/database-roles.md`).
- Tests can no longer delete refund rows, so test isolation retires them through allowed transitions.
- Refund exceptions need a person; there is no screen until Phase 2.
- The undo for migration 020 is documented above its entry; it was run, and 020 re-applied, on a throwaway copy of the local development data.

### 6. Tests & Evidence (2026-11-17)

See `docs/FINANCE_PLATFORM_PROGRESS.md`, Phase 1.6, for the counts from this session's runs.

---

## DEC-024: Phase 2.0 Tax Approval Timestamp Database Clock Hardening

- **Decision ID**: `DEC-024`
- **Date**: `2026-11-17`
- **Decision Title**: Enforce authoritative server clock timestamping for tax approvals via PostgreSQL trigger hardening (Migration 021)
- **Status**: Implemented & Verified

### 1. Context / Problem

In Phase 1.6, migration 019 introduced a database trigger `check_tax_approval_not_backdated` to prevent backdating tax configuration approvals. However, the Phase 1.7 independent audit identified a critical security vulnerability: the trigger evaluated `IF NEW.effective_from < NEW.recorded_at THEN RAISE EXCEPTION...`. Because `NEW.recorded_at` was supplied by the application layer (`req.body` or application ORM timestamps), a compromised or malicious application connection could provide an artificially backdated `recorded_at` matching or preceding `effective_from`, bypassing the backdating protection.

### 2. Decisions

1. Append migration `021_tax_approval_clock_timestamp`:
   - Replace trigger function `guard_tax_approval_recorded_at()` to overwrite `NEW.recorded_at = CLOCK_TIMESTAMP()`.
   - Update `check_tax_approval_not_backdated()` to validate `effective_from >= CLOCK_TIMESTAMP() - INTERVAL '5 minutes'` (allowing a narrow clock-skew tolerance while strictly preventing retroactive approvals).
2. Prohibit client- or application-supplied `recorded_at` overrides.

### 3. Verification

Verified via `api/src/modules/finance/invoices.test.ts` and migrations suite. Backdated approvals are rejected with PostgreSQL exception `tax_approvals_cannot_be_backdated`.

---

## DEC-025: Phase 2.1 Refund Management Desk & Operational Exception Resolution

- **Decision ID**: `DEC-025`
- **Date**: `2026-11-17`
- **Decision Title**: Provide operational interface and resolution workflows for pending and review refunds
- **Status**: Implemented & Locally Verified

### 1. Context / Problem

When payment refunds encounter gateway timeouts, ambiguous states, or webhook mismatches, they enter `REQUIRES_REVIEW` status. Finance operations required an authoritative desk to inspect exceptions, view audit history, and resolve exceptions safely without direct database access.

### 2. Decisions

1. Build backend service `refundsDesk.service.ts` and routes under `/api/finance/refunds` and `/api/finance/refund-exceptions/:id/resolve`.
2. Restrict access strictly to `FINANCE_ADMIN` and `SUPER_ADMIN` roles.
3. Build web operational desk (`RefundsPage.tsx`) with status filters, KPI summaries, and an exception resolution dialog requiring external evidence reference and resolution notes.

---

## DEC-026: Phase 2.1-R2 Final Refund Integrity Remediation & Gateway Invariant Strictness

- **Decision ID**: `DEC-026`
- **Date**: `2026-11-17`
- **Decision Title**: Enforce strict 5-point verification for CONFIRM_PROCESSED and MARK_FAILED, eliminate absence-based failure, remove fabricated adapter currency, and analyze Migration 022 redundancy
- **Status**: Implemented & Locally Verified (Production BLOCKED pending independent audit and CA approval)

### 1. Context / Problem

The Phase 2.1-R independent audit revealed subtle financial-integrity risks in the refund resolution engine:
- Conditional checking in `CONFIRM_PROCESSED`: `if (providerRefund.paymentId && ...)` and `if (providerRefund.currency && ...)` allowed payloads omitting `paymentId` or `currency` to pass verification without verifying the payment or currency.
- Asymmetry in `MARK_FAILED`: `MARK_FAILED` checked status `'failed'` but did not verify `paymentId`, `amountPaise`, or `currency` against internal records.
- Absence-based failure: `MARK_FAILED` allowed resolving refunds as `FAILED` if unlisted after 24 hours. Because marking `FAILED` removes a refund from the `payment_refunds_within_captured` cap, resolving an absent refund as failed unlocked the captured balance for double payout if Razorpay subsequently processed the refund.
- Fabricated gateway currency: `createRazorpayGateway` in `gateway.ts` defaulted missing currency to `'INR'`, masking missing currency from the provider.
- Concurrency conflict crash: Duplicate `provider_refund_id` threw PostgreSQL error `23505`, crashing the request as an unhandled HTTP 500 instead of a controlled HTTP 409 conflict.
- Redundant Migration 022: Migration 014 already defined `provider_refund_id TEXT UNIQUE`. Migration 022 added a partial unique index `WHERE provider_refund_id IS NOT NULL`.

### 2. Decisions

1. **Strict 5-Point Invariant Verification for `CONFIRM_PROCESSED`**:
   - Provider `paymentId` must be non-null and strictly match `paymentProviderId`.
   - Provider `currency` must be non-null and strictly match `expectedCurrency` (case-insensitive).
   - Provider `amountPaise` must exactly match internal `amountPaise`.
   - Provider `id` must strictly match requested `providerRefundId`.
   - Provider `status` must be lowercase `'processed'`.
   Any violation throws HTTP 409 `PAYMENT_VERIFICATION_FAILED`.
2. **Authoritative Terminal Failure Verification for `MARK_FAILED`**:
   - Status `'pending'` or `'processed'` is strictly rejected.
   - For status `'failed'`, full 5-point verification is applied: `paymentId`, `currency`, `amountPaise`, and `id` must all strictly match internal records.
   - Complete removal of the 24-hour absence fallback: absence from Razorpay records never proves terminal failure. Unlisted/unverified refunds remain in `REQUIRES_REVIEW` indefinitely until affirmative proof of failure or processing is produced.
3. **Receipt-Only Correlation**:
   - In `fetchPaymentRefunds`, correlation strictly matches `r.receipt === expectedReceipt`. Removed loose amount-only fallback (`pr.amountPaise === expectedAmountPaise`) to prevent cross-refund conflation.
4. **Adapter Currency & Field Accuracy**:
   - Removed `currency: refund.currency ?? 'INR'` fallback in `gateway.ts`. Returns `currency: refund.currency ?? null` and `paymentId: item.payment_id ?? null`.
5. **PostgreSQL Error 23505 Graceful Handling**:
   - Wrapped database mutation in `try / catch`. Catches error code `23505` on `payment_refunds_provider_refund_id_key` or `payment_refunds_provider_refund_id_unique`, guarantees full rollback, and returns HTTP 409 `PAYMENT_VERIFICATION_FAILED`.
6. **Migration 022 Redundancy Analysis**:
   - Migration 014 declared `provider_refund_id TEXT UNIQUE`. Migration 022 created `CREATE UNIQUE INDEX payment_refunds_provider_refund_id_unique ON payment_refunds (provider_refund_id) WHERE provider_refund_id IS NOT NULL;`.
   - Because standard SQL `UNIQUE` in PostgreSQL permits multiple `NULL` values by default, Migration 022 is technically redundant with Migration 014.
   - Under forward-only migration policy, Migration 022 remains harmlessly applied. It is documented here to avoid any rollback or revision of existing migration sequence.

### 3. Verification

- All 31 tests in `api/src/modules/finance/refundsDesk.test.ts` pass, covering all negative and positive boundary conditions: null paymentId, null currency, mismatched amounts, duplicate provider_refund_id rollback, 72h absence rejection, receipt mismatch rejection, and concurrent resolution.
- All 6 tests in `api/src/modules/payments/gateway.test.ts` pass, confirming null preservation for missing currency.
- Monorepo full verification:
  - `npm test -w api`: 315 passed, 0 failed.
  - `npm test -w web`: 110 passed, 0 failed.
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 errors.
  - `npm run build`: successful production build for both `api` and `web`.

---

## DEC-027: Phase 2.1-R3 Receipt-Path Provider ID Validation & Status Normalization Clarification

- **Decision ID**: `DEC-027`
- **Date**: `2026-11-17`
- **Decision Title**: Enforce non-empty provider refund ID validation on MARK_FAILED receipt-matching path and clarify case-insensitive status normalization
- **Status**: Implemented & Locally Verified (Awaiting independent Phase 2.1-R3 audit)

### 1. Context / Problem

The Phase 2.1-R2.1 independent audit identified:
1. `AUDIT-2.1-R2-01` (HIGH): In `api/src/modules/finance/refundsDesk.service.ts` Path B (receipt matching), `candidateRefund` was matched by `pr.receipt && pr.receipt === initialData.receipt` and checked for status, payment ID, amount, and currency, but `candidateRefund.id` was not checked for non-emptiness before storing and transitioning the refund to `FAILED`. A malformed provider response could mark an internal refund as `FAILED` without an authoritative refund ID, releasing reserved captured balance.
2. `AUDIT-2.1-R2-02` (LOW): The Phase 2.1-R2 report claimed "strict lowercase status parity", but code implemented case-insensitive normalization via `toLowerCase()`.

### 2. Decisions

1. **Enforce Non-Empty Provider Refund ID Validation in Path B**:
   In `refundsDesk.service.ts`, before any candidate refund is accepted as authoritative terminal evidence, enforce:
   ```typescript
   if (
     !candidateRefund.id ||
     typeof candidateRefund.id !== 'string' ||
     !candidateRefund.id.trim()
   ) {
     throw new ApiError(
       409,
       ERROR_CODE.paymentVerificationFailed,
       'Provider refund record is missing an authoritative refund ID',
     );
   }
   ```
   This executes prior to assigning `verifiedProviderRefundId`, updating the database, or writing the resolution audit log.
2. **Clarify Status Normalization**:
   Document that status evaluation uses case-insensitive normalization (`status?.toLowerCase()`). This aligns with Razorpay's lowercase status values (`'processed'`, `'failed'`, `'pending'`) while remaining resilient against provider casing variations. Non-terminal states (pending, processing, undefined, null) continue to be rejected unconditionally.
3. **Add Negative Unit Tests for All Malformed ID Cases**:
   In `refundsDesk.test.ts`, add tests exercising Path B with:
   - `id: ""` (empty string)
   - `id: null`
   - `id` omitted entirely
   - `id: "   "` (whitespace only)
   Confirm each returns HTTP 409, leaves refund in `REQUIRES_REVIEW`, does not populate `provider_refund_id`, keeps reserved refund balance intact, and records 0 resolution audit events.

### 3. Verification

- `api/src/modules/finance/refundsDesk.test.ts`: 35/35 passed (including 4 new negative tests and positive control).
- Monorepo full verification:
  - `npm test -w api`: 319 passed, 0 failed.
  - `npm test -w web`: 110 passed, 0 failed.
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 errors.
  - `npm run build`: successful production build for both `api` and `web`.

## DEC-028: Phase 2.1-R3.2 Unified Refund Evidence & Reconciliation Integrity

- **Decision ID**: `DEC-028`
- **Date**: `2026-11-18`
- **Decision Title**: One runtime validator for provider refund evidence, applied wherever a provider report can settle a refund; receipt binding on the refund desk; unusable webhook and creation data routed to a finance exception instead of being applied or only logged
- **Status**: Implemented & Locally Verified (awaiting a fresh, independent R3.2 audit; not accepted)

### 1. Context / Problem

The independent Phase 2.1-R3.1 audit accepted the R3 fix (`AUDIT-2.1-R2-01`, desk Path B) for its own scope but found the same defect class in other places that trust Razorpay JSON, which the gateway and webhook only cast and never parse:

1. **R31-01 (HIGH):** hourly reconciliation and `POST /finance/refunds/reconcile` marked `PENDING` and `REQUIRES_REVIEW` refunds `FAILED`, releasing their reserved balance, on a blank, whitespace-only, null or missing provider refund id, a foreign payment id, or a wrong or missing currency.
2. **R31-02 (MEDIUM):** a staff-supplied provider refund id was never checked against the refund's receipt, so an unrelated failed refund could release a refund Razorpay had processed.
3. **R31-03 (MEDIUM):** a signed `refund.failed` webhook with a blank id marked the refund `FAILED` and stored the blank id; `createRefund` passed a missing id through; no database rule forbade blank ids.
4. **R31-04 (MEDIUM):** a late `refund.processed` that could not be reinstated, and a dashboard refund over the captured amount, were dropped with only a log line.

### 2. Decisions

1. **One validator, `modules/payments/refundEvidence.ts`.** `validateRefundEvidence(raw, expected)` takes what the provider sent (any field may be absent or the wrong type) and what our records say it must describe. It requires a non-empty provider refund id with no surrounding whitespace (refused, never trimmed, so a stored id is exactly what the provider sent), a provider payment id, a whole-number positive amount in paise, a currency, and a supported status (`pending`, `processed`, `failed`). Against our records it requires the same payment, amount, currency, our receipt when we have one (present and equal), the stored or supplied refund id, and the status an event type announces. Nothing is defaulted from our own data. It returns every problem found.
2. **Insufficient evidence is not proof of failure.** On any problem, a refund keeps its reserved amount and a person is told. Absence from the provider still never fails a refund.
3. **Reconciliation (both the hourly job and the manual endpoint).** Evidence is validated before any status change. A `PENDING` refund with unusable evidence moves to `REQUIRES_REVIEW` with the reasons, and one `REFUND_EXCEPTION_RECORDED` entry is written with what we recorded and what the provider reported. A refund already awaiting review is left alone, so an hourly run never records the same exception again. Two provider refunds under one receipt are never chosen between (exception, `receipt_ambiguous`). Under the row lock, a provider id stored meanwhile must equal the evidence id.
4. **Refund desk (R31-02, R31-05, R31-06, R31-07).** CONFIRM_PROCESSED and both MARK_FAILED paths verify the provider record with the shared validator, including our receipt. A staff-supplied id is accepted only when the refund carries our receipt; a refund with neither a stored provider id nor a receipt cannot be resolved at all. A different id from the one already recorded is a 409 (it was a 500). More than one provider refund with the receipt is a 409. An id already recorded for another refund is a 409 before the transaction; the unique index and the 23505 handler remain for concurrency.
5. **Webhook (R31-03).** The refund entity is parsed loosely on purpose, so an incomplete event is stored and judged rather than rejected with a 400 that Razorpay retries for ever. Signature checking is unchanged. The payment is locked first, then the evidence is validated (payment, currency, a status consistent with the event type). Invalid evidence changes nothing and records an exception, tied to a refund when the receipt names exactly one. Correlation reads the candidate refunds unlocked (`findRefundsForProvider`, replacing `findRefundForProvider`, which ordered NULL ids first, R31-08) and locks only the single refund it settles on, after the payment. An id that points at one refund and a receipt at another is an exception (`correlation`). A report for a payment we do not know is stored with outcome `UNKNOWN_PAYMENT` and touches nothing. A dashboard refund records the provider's own currency; the payment's currency is never substituted (R31-12).
6. **Refund creation.** The gateway maps currency, payment id and receipt from the create response and invents nothing. `requestRefund` accepts a created refund only when it passes the validator; otherwise the refund stays `PENDING` (reconciliation finds it by receipt) and an exception is recorded (`source: refund_creation`).
7. **R31-04: durable finance exceptions, no new table.** A late `refund.processed` that cannot be reinstated, and a dashboard refund over the captured amount, record `REFUND_EXCEPTION_RECORDED` with the refund and payment ids, expected and observed amounts, captured and reserved totals, the event id and type, and the reason. They appear in `GET /finance/refund-exceptions` and on the refund's own detail. One provider event gives one exception, because the event is stored once and a redelivery stops before it is applied. Nothing is rewritten and the cap trigger is not bypassed; if the accounting is uncertain, the discrepancy is kept for finance.
8. **Migration `023_payment_refunds_provider_id_clean` (forward-only).** `CHECK (provider_refund_id IS NULL OR provider_refund_id ~ '^\S(.*\S)?$')`, added `NOT VALID` and validated in the same migration only when no existing row breaks it. Existing rows are never rewritten. `btrim()` was not used because it strips only spaces. If legacy blank ids exist the constraint stays `NOT VALID`, still guards every new and changed row, and a read-only review query is in the migration comment. Undo is in the comment above the migration. No grants are needed.
9. **Realistic fixtures.** Existing tests built provider refunds without payment id, currency, receipt or status, which Razorpay always sends. They now carry them, so the tests fail for the reason they name. No assertion was weakened or skipped; one message assertion (`reports 9000 paise`) now matches the validator's message (`9000 paise`).

### 3. Alternatives Considered

- **Fixing each path separately.** Rejected: that is how R2-01 was fixed in one place only.
- **Rejecting malformed webhooks with 400.** Rejected: no record, endless retries, finance never sees it.
- **A new exceptions table.** Rejected for now: the append-only audit log and its existing finance screens already carry exceptions; a workflow table can follow with Phase 2.3.
- **Validating the new CHECK immediately, or editing legacy rows.** Rejected: the first can stop start-up on populated data, the second rewrites financial history.
- **Moving a reinstated-too-late refund from `FAILED` to `REQUIRES_REVIEW`.** Rejected: the refund guard moves status forward only, and this would change history; the exception is the record.

### 4. Verification (run in this session on 2026-11-18)

- New: `refundEvidence.test.ts` (23), `refunds.integrity.test.ts` (81), the receipt-binding block in `refundsDesk.test.ts`, migration 023 tests (3), a gateway creation-mapping test, and `refunds.postgres.test.ts` on real PostgreSQL.
- Mutation check in a scratch copy: eleven removals of a guard (blank ids accepted, receipt ignored in reconciliation and in the desk, either R31-04 exception dropped, duplicate-receipt and correlation checks, created-refund check, re-flagging every run, the stored-id-only identity guard, status consistency) were each caught by at least one test.
- Exact counts are in `docs/FINANCE_PLATFORM_PROGRESS.md` and the R3.2 report.

### 5. Consequences / Remaining limitations

- Staff resolution and reconciliation are stricter: a refund whose provider record carries no receipt now needs a person, where before an id alone passed. This is intended.
- The refunds page still sends a hidden provider id with MARK_FAILED and has no confirmation step (R31-09, LOW, web only, not changed here).
- Docs that overclaimed in DEC-026 and the R2 progress text (R31-10) are corrected by this entry, not rewritten: the desk validates every provider record against the receipt, the stored id and payment, amount and currency; case-insensitive status comparison is intentional.
- A refund event for a payment we do not know is stored as `UNKNOWN_PAYMENT` only.
- Bank settlement and fees are not modelled (Phase 2.4). Invoicing stays disabled and CA decisions remain open.
- Needs a fresh independent audit before Phase 2.1 can be accepted.

## DEC-029: Phase 2.1-R3.4 Closure of the R3.3 Audit Items (R33-01, R31-11, R33-02, R31-09)

- **Decision ID**: `DEC-029`
- **Date**: `2026-11-18`
- **Decision Title**: Close the four items the independent R3.3 audit left open before a reviewed pull request
- **Status**: Implemented & Locally Verified (awaiting independent review; not committed)

### 1. Decisions

1. **R33-01, guest checkout browser test.** The test never filled the billing address and PIN code that checkout now requires. It now fills `Billing address` and a 6-digit `PIN code`, as a real visitor must. Production validation is unchanged, and a new browser test proves checkout still refuses a 5-digit PIN code.
2. **R31-11, real PostgreSQL in CI.** `.github/workflows/checks.yml` gets a third job, `postgres`, with a throwaway `postgres:16` service container. It runs `npm run test:postgres -w api`, which sets `REQUIRE_POSTGRES_TESTS=1`, so a missing server fails the job instead of skipping a suite. The suites create and drop their own databases and the restricted application role. The job's password is a disposable CI-only value for a container that exists only for the run. The job must be marked required in branch protection (a repository setting; not changeable from the code).
3. **R33-02, legacy blank or padded provider refund ids.** Reconciliation now recognises such a row before calling Razorpay and records one `REFUND_EXCEPTION_RECORDED` entry (`source: legacy_invalid_provider_id`) with the refund, payment, status and amount. It is recorded once, not on every hourly run. The refund keeps its reserved amount and is never updated, rewritten or guessed at. The entry appears in `GET /finance/refund-exceptions` and on the refund's detail. Migration 023's constraint stays `NOT VALID`; nothing in this phase validates it or touches data.
4. **R31-09, refunds page.** MARK_FAILED now opens a confirmation dialog that says the reserved amount is released and the decision is recorded against the staff member; nothing is sent until it is confirmed. A typed provider refund id is sent only with CONFIRM_PROCESSED, so MARK_FAILED can no longer carry a hidden id (the server uses the id on record or our receipt). The server's own refusal message is now shown instead of the generic HTTP error. No backend validation was removed or loosened.

### 2. Procedure for existing invalid provider ids (R33-02) — not automated, needs the owner

Run this on any database that held refunds before migration 023, before validating the constraint. Nothing here is run by the application.

1. **Find them (read-only):** `SELECT id, payment_id, status, provider_refund_id FROM payment_refunds WHERE provider_refund_id IS NOT NULL AND provider_refund_id !~ '^\S(.*\S)?$';`
2. **Look in finance:** each appears under refund exceptions (`legacy_invalid_provider_id`). Finance checks the refund in the Razorpay dashboard and decides whether Razorpay processed or failed it.
3. **Do not rewrite or delete the row, and do not invent an id.** The row cannot be changed through the application: the migration 023 constraint and the provider-id guard (migration 020) refuse it, which is intended.
4. **Correcting a row is a separate, owner-approved database operation** (a verified backup first, one transaction, the true Razorpay id taken from the dashboard, a `DECISION.md` entry naming the refund). It needs the owner role and a deliberate, temporary lift of the provider-id guard, so it is not scripted here.
5. **Only when the query returns no rows**, run `ALTER TABLE payment_refunds VALIDATE CONSTRAINT payment_refunds_provider_refund_id_clean;`.

No deployed database holds such a row today: the committed code has no refunds table in any deployment.

### 3. Alternatives Considered

- **Auto-correcting the ids.** Rejected: it would invent or rewrite financial history.
- **Validating the constraint and failing on bad rows.** Rejected: it can stop a migration on populated data.
- **A confirmation text field ("type FAIL to confirm").** Rejected for a dialog with the facts and an explicit button; the server remains the real check.

### 4. Remaining limitations

Two low-priority edge cases found by the independent review are left for a follow-up and must be fixed before any database that held refunds before migration 023 is operated on: R35-03 (a stored empty-string provider id makes the desk's MARK_FAILED return 500 from the migration 020 guard; nothing is written) and R35-04 (the desk calls Razorpay with a blank or padded stored id and returns a misleading 502 or 409). The branch-protection setting that makes the new CI job required is a repository setting. The exceptions list still shows only the newest 200 entries and has no "handled" state (R33-04). Not committed or pushed. Needs independent review.

## DEC-030: Production Readiness: Email Reliability, Test Clock Drift and the PostgreSQL 16 Role Note

- **Decision ID**: `DEC-030`
- **Date**: `2026-11-25`
- **Decision Title**: Make emailed codes and links safe when the provider fails, refuse a half-configured mailer, fix a test-fixture clock drift, update Sentry, and document Render's PostgreSQL 16 role membership
- **Status**: Implemented & Locally Verified (branch `chore/production-readiness`; not committed, not deployed)

### 1. Context / Problem

Production started with `RESEND_API_KEY` set but `MAIL_TRANSPORT` unset, so email was silently off. Reading the mail path found three further problems: a reset-code request waited for Resend only when the address had an account (timing and error responses revealed which emails are registered; the staff sign-in link had the same pattern for staff); the Resend error message included the subject, which for a reset code is the code itself, and that error reached the server log and Sentry as `http.unhandled_error`; and `mail.delivery_failed` logged Resend's whole response body, which can quote the recipient. Separately, the API suite failed intermittently.

### 2. Decisions

1. **Codes and links are sent without waiting.** `requestPasswordReset` and `requestAdminSignIn` issue the code or link, then start the send without awaiting it (`sendWithoutWaiting` in `auth.service.ts`). The response is the same 202 for a registered, unknown or staff address and whether or not Resend accepts the email. A failure is logged as `auth.password_reset_code_failed` / `auth.admin_sign_in_link_failed` with the user id only. The code, its hashing, expiry, single use, attempt limit and session revocation are unchanged.
2. **Mail errors carry no content.** A Resend refusal is described by template name, HTTP status and Resend's short error type (`validation_error`) only. Neither the thrown error nor `mail.delivery_failed` contains the subject, body, recipient or key. Outbox `last_error` values therefore also lose the subject.
3. **A key without a transport is refused.** `RESEND_API_KEY` set with `MAIL_TRANSPORT` unset stops start-up, in every environment, naming the missing variable. The transport is never inferred from the key, so a key in a development file cannot start sending real email. A deploy with this misconfiguration fails to start and Render keeps the previous deploy serving.
4. **Test fixture clock drift (root cause of the intermittent `ledger.test.ts` failure).** `recordTestApproval` defaulted to "a minute before the call" (real time) while tests run on fixed clocks set at module load. More than 30 seconds into a slow run, the approval started after the test clock, invoicing was "not yet effective" and nothing was issued. It now defaults to the fixed `TEST_APPROVAL_EFFECTIVE_FROM`, or, for a file running longer than 4 minutes, the latest start the database's 5-minute backdating guard allows (found by the independent review: `invoices.test.ts` took 174 s under load). Reproduced deterministically before the fix and guarded by `src/test/invoicing.test.ts`.
5. **Test server binds 127.0.0.1**, the address its client dials. On macOS a `::` listener can share a port number with another program's `127.0.0.1` listener, which then receives the client's requests (demonstrated). This is hardening for two one-off failures (a staff sign-in 400 and a checkout 404) whose root cause is not proven; `signInStaff` now reports each step's status so a recurrence is diagnosable.
6. **Sentry update within range.** `npm audit fix` (no `--force`, no `package.json` change) moved `@sentry/node` 11.10.0 → 11.17.0 (removing the vulnerable `glob`/`minimatch` reached through `@sentry/bundler-plugins`) and `typescript-eslint` 8.72.1 → 8.74.0 (development only). `npm audit` and `npm audit --omit=dev` both report 0.
7. **PostgreSQL 16 role note.** `docs/database-roles.md` now states what Render's automatic ADMIN-only membership allows and what the start-up check guarantees (at every start, not continuously), each point checked on PostgreSQL 16.15.

### 3. Alternatives Considered

- Queue reset codes through the outbox: retries and monitoring, but stores a live code in a table and is a larger change. Rejected for now.
- Infer `MAIL_TRANSPORT=resend` from the key: friendlier, but implicit sending from development machines. Rejected.
- Skip or retry the flaky tests: hides the cause. Rejected.

### 4. Consequences / Trade-offs

- A code that Resend refuses is not retried; the person asks again. Staff see the failure in logs and Sentry (twice: `mail.delivery_failed` and `auth.*_failed`).
- A send still in flight when the process stops for a deploy is lost without a log line; the person has already had the 202 and asks again. There is no fetch timeout on Resend calls; a hanging provider now holds only the background send, bounded by the per-address rate limit.
- A registered address still does a small database write that an unknown one does not (a few milliseconds), far below the provider round trip that was removed.
- Production must have `MAIL_TRANSPORT=resend` whenever `RESEND_API_KEY` is set before this is deployed, or the new deploy will not start.

## DEC-031: Milestone A1: Sign-Up Proves the Email Before Any Account Exists

- **Decision ID**: `DEC-031`
- **Date**: `2026-11-25`
- **Decision Title**: Replace instant sign-up with a two-step, emailed-code sign-up that cannot be used to take over a checkout buyer's account
- **Status**: Implemented & Locally Verified (branch `chore/production-readiness`; not committed, not deployed; awaiting owner review)

### 1. Context / Problem

Checkout needs no account: it files a purchase under a password-less `users` row keyed on the billing email. `POST /api/auth/sign-up` then let anyone who knew that email set a password on the row and receive a session at once, with no proof of owning the address, exposing the buyer's purchases (audit finding G1, Critical). The reverse also worked: signing up first with someone else's email made their later guest purchase land in the attacker's account.

### 2. Decisions

1. **Two steps.** `POST /api/auth/sign-up` (name, email, password) creates nothing and signs nobody in. It answers `202` with the same body for every email. `POST /api/auth/sign-up/confirm` (email, code, password) creates the account, or gives the checkout buyer's row its name and password (keeping its purchases), and only then issues the session.
2. **A new table, `sign_up_verifications` (migration `028`).** Each request is one row:
   - A pending sign-up holds the name, the scrypt hash of the chosen password and a SHA-256 hash of the code salted with the row id.
   - A request for an email that already has a password, or belongs to staff, is stored as a notice row with no code, and that email gets an "account exists" notice instead of a code.
   - `confirmed_at` (migration `029`, `ADD COLUMN IF NOT EXISTS`) is set only when a code creates or claims the account; to undo: `ALTER TABLE sign_up_verifications DROP COLUMN confirmed_at`.
   - Additive; to undo: `DROP TABLE sign_up_verifications`.
3. **Code rules:**
   - 6 digits from `crypto.randomInt`.
   - Valid for 15 minutes, 5 tries each, and only the newest code for an email works.
   - The try is counted atomically before checking, the comparison is constant-time, and the code is consumed with `UPDATE … WHERE used_at IS NULL RETURNING`, so a race produces exactly one success.
4. **The confirm repeats the step-1 password.** Found by the independent review (H1), and reproduced: an attacker who asked first with their own password could have that password put on the owner's account when the owner, asking within the cooldown, typed the only code in their inbox. The password is checked with scrypt on every try and fails exactly like a wrong code.
5. **Throttles, all answered with the same 202:**
   - Per email: one new code a minute and 5 requests an hour. No new code after 15 failed tries in 24 hours, counting at most 5 per code. The check and the new row are decided under a per-email advisory lock, so simultaneous requests send one code.
   - A refused confirm always runs one scrypt hash, so its timing does not reveal whether the email has an account.
   - The existing per-IP limit on `/auth/sign-up` (5 per 15 minutes) also covers `/auth/sign-up/confirm`, because it matches the path prefix.
6. **Without a mailer, sign-up answers `503 SIGN_UP_UNAVAILABLE`** rather than creating an unverified account.
7. **Browser tests read codes from a file.** `MAIL_CONSOLE_FILE` (development and browser tests only) makes the console mailer append each email to a file, so the Playwright journey can read the code. It is refused in production and with any transport other than console.

### 3. Alternatives Considered

- **Verify only checkout buyers' emails.** Rejected: the different answer would reveal who has bought something.
- **Bind the confirm to a cookie set in step 1.** Equivalent protection, but it adds a cookie and depends on cross-site cookie behaviour. Repeating the password needs no new state.
- **Answer `409` to sign-up for existing accounts, as before.** Rejected for the same disclosure reason. The `409` now appears only after a correct code and password prove the email.

### 4. Reason

A password-less buyer record is only safe if no-one can attach credentials to it without controlling the inbox. Answering every email identically keeps the endpoint from revealing who has an account or has bought something.

### 5. Consequences / Trade-offs

- **Sign-up now needs working email.** Production must have `MAIL_TRANSPORT=resend`, which is already required by DEC-030. Students see a code step.
- **The throttles can be abused for denial of service.** Anyone can fill an email's hourly cap or daily failure budget and block new codes for that address for up to a day, sending the owner up to 5 emails an hour. A checkout buyer can still claim the account through "Forgot password". Accepted for now; flagged for the owner.
- **Timing differs slightly between paths.** Every path runs one scrypt hash; the remaining differences are single small database writes.
- **`POST /api/auth/register` (the legacy profile registration) still creates accounts without email proof** and answers `409` for any existing email. The website no longer calls it; API tests use it as a fixture. Removing or gating it is an owner decision (review finding H2, open).
- **Accounts claimed before this change were never verified.** A read-only production query can list buyer rows that gained a password through sign-up; whether to force a reset is an owner decision.
- **Verified:**
  - API suite: 496 passed.
  - Web: 23 files, 215 tests passed.
  - Real PostgreSQL 16.15: 26 passed, including 4 new sign-up race tests run as the restricted application role.
  - Build, both npm audits (0 vulnerabilities) and e2e (26 passed, including the sign-up journey on desktop and mobile).
  - Red-green: on unmodified `main` the takeover test fails (`201 !== 202`). Removing each guard (password binding, attempt limit, expiry, hourly cap, daily budget, existing-account check) fails its test. The single-use guard is caught only on real PostgreSQL.

## DEC-032: Milestone A2–A4: Seat Locking and Payment Exceptions

- **Decision ID**: `DEC-032`
- **Date**: `2026-11-27`
- **Decision Title**: Lock the batch for every seat change, re-check capacity at capture, and turn captures that cannot confirm a seat into durable payment exceptions
- **Status**: Implemented & Locally Verified (branch `chore/production-readiness`; not committed, not deployed)

### 1. Context / Problem

- **Checkout overselling.** Checkout counted seats and then inserted, under READ COMMITTED with no lock, so simultaneous checkouts oversold the last seat. On real PostgreSQL, 20 simultaneous checkouts took 19 seats of 3.
- **Late captures over-filling.** A capture confirmed its seat with no capacity check, even after the 30-minute hold had lapsed.
- **Unseen double charges.** A second capture for a confirmed seat was only logged.

### 2. Decisions

1. **Every path that takes or confirms a seat locks the batch row first** (`lockBatchRow`): a new hold, a renewed hold, and a capture. Capture then also locks the seat row.
2. **At capture the payment is always recorded as `PAID`.** The seat is confirmed only if it fits: everyone else's confirmed and held seats must be below capacity, and the seat's own hold is excluded, so a capture inside its hold always fits. Otherwise a payment exception opens:
   - `CAPTURED_FOR_FULL_BATCH`: the seat stays unconfirmed and no confirmation email is sent.
   - `CAPTURED_FOR_CONFIRMED_SEAT`: the seat was already paid for by another payment.
3. **What the buyer sees.** The verify response reports `seatConfirmed`, and the checkout page says "Payment received, seat not confirmed". While that payment's exception is open, the buyer cannot pay again for the seat (`PAYMENT_UNDER_REVIEW`); once staff resolve it, they can. A resolution locks the payment first, so no refund can be requested between its checks and its write.
4. **Staff resolve exceptions**, never automatically, with one of three resolutions. All need a note, are audited and are final:
   - `REFUNDED`: needs a processed refund for the full amount through the existing workflow.
   - `SEAT_CONFIRMED`: full-batch kind only, only while the seat is unconfirmed, the payment has no refund and the batch has room. Staff raise the capacity first to add a seat, so no current holder is displaced. It sends the usual confirmation.
   - `NO_ACTION`.
5. **The record itself.**
   - `payment_exceptions` is unique per payment and kind. It cannot be deleted or truncated, and cannot be edited after resolution.
   - Migrations `030` and `031`.
   - Earlier duplicate captures are backfilled as open exceptions.

### 3. Alternatives Considered

- **Refund automatically.** Rejected: there is no approved refund policy. Refunds stay with the audited refunds desk.
- **Count only confirmed seats at capture.** Rejected: a late payment would then take the seat of someone still within their hold.
- **SERIALIZABLE transactions.** Rejected: a row lock on the batch is narrower and needs no retry logic.

### 4. Reason

Paid money must never be lost, a batch must never be silently over-filled, and every double or late payment must reach a person who can act on it.

### 5. Consequences / Trade-offs

- **Checkouts and captures for one batch run one at a time.** The lock is brief.
- **Late window.** A payment authorised inside its hold but captured after it lapsed can become an exception if the seat was taken in between. This window is accepted.
- **Invoicing.** Once it is switched on, invoices would also be issued for payments with exceptions. That is an owner/CA decision, and selection is unchanged.
- **No web screen yet.** Exceptions are reached through the API only.
- **Verified:**
  - Real-PostgreSQL race tests for checkout, renewal, late captures, double captures, repeated events and a capture racing a checkout.
  - Each guard was removed temporarily and its test failed.

## DEC-033: Milestone A5–A6: Finance Copy Template and Email Out of Payment Requests

- **Decision ID**: `DEC-033`
- **Date**: `2026-11-27`
- **Decision Title**: Give the finance copy its own template and content, send all payment email from the outbox worker only, time out Resend calls, and escape email HTML
- **Status**: Implemented & Locally Verified (branch `chore/production-readiness`; not committed, not deployed)

### 1. Context / Problem

- **Wrong email to finance.** Finance recipients received the student's confirmation email: the worker ignored the stored "[Finance Copy]" subject.
- **Email held up payment requests.** Verify and the Razorpay webhook sent up to 20 emails inline before answering, with no timeout on Resend.

### 2. Decisions

1. **A separate finance-copy template.**
   - Finance copies use template `payment_finance_copy` and `sendPaymentFinanceCopy`.
   - Subject: `[Finance] Payment received: <topic> (<amount>)`.
   - Content: name, item, amount and payment reference only, with no student-facing link.
   - Rows queued by the previous release (template `payment_confirmation` with a `…:finance:` key) are sent the same way.
2. **Payment requests only queue email.** The existing outbox worker (every 15 seconds, with retries, claim tokens and idempotency keys) is the only sender.
3. **Resend calls time out after 10 seconds.** A timed-out payment email is retried with the same idempotency key.
4. **Every interpolated value in email HTML is escaped.** Buyer-typed names can no longer inject links into finance's inbox.

### 3. Alternatives Considered

- **Fire-and-forget sending in the request.** Rejected: delivery would be less reliable than the outbox, and the work would still be tied to request handling.
- **A second queue.** Rejected: the outbox already provides durability and retries.

### 4. Reason

Each recipient should get only their own message. Payment and webhook responses must not depend on the email provider.

### 5. Consequences / Trade-offs

- **Confirmations arrive up to about 15 seconds after payment.**
- **Rolling back to code without the finance template** fails those rows after about 21 minutes; they can be requeued.
- **A legacy finance row attempted just before the deploy** may be refused by Resend on retry (same key, different body). It ends `FAILED`, never duplicated.

## DEC-034: Remove the Legacy Unverified Registration Endpoint

- **Decision ID**: `DEC-034`
- **Date**: `2026-11-27`
- **Decision Title**: Remove `POST /api/auth/register`; the verified sign-up is the only way to create a student account
- **Status**: Implemented & Locally Verified (owner decision; not committed, not deployed)

### 1. Context / Problem

`/api/auth/register` created an account, a student profile and a session for any email with no proof of ownership, and answered `409` for emails already on file. It bypassed DEC-031 and revealed which emails exist. The website no longer called it; API tests used it as a fixture.

### 2. Decisions

1. **The removal.** The route, `registerStudent`, `registerSchema`, `RegisterRequest`, the repository insert and the rate-limit mount are removed. A test asserts the route answers 404 and creates nothing.
2. **The tests.** The API tests that used it now create students through the verified sign-up helper. The register-specific tests are replaced; equivalent sign-up tests already exist.
3. **Existing data.** Existing student profiles are kept and still read. No new profiles are created.

### 3. Alternatives Considered

- **Gate the route behind a setting.** Rejected by the owner: an unverified path would remain.
- **Add the emailed code to `/register`.** Rejected: it would duplicate sign-up.

### 4. Reason

No route may create a usable account without proof of the email.

### 5. Consequences / Trade-offs

- **Profile fields can no longer be collected at sign-up** (class, stream, date of birth). No current screen uses them.
- **The old route returns 404.** No client calls it.

## DEC-035: Razorpay Deadlines, Batch Status at Capture, and No Invoice While an Exception Is Open

- **Decision ID**: `DEC-035`
- **Date**: `2026-11-27`
- **Decision Title**: Bound every Razorpay call; apply checkout's batch rule at capture; never invoice a payment with an open payment exception
- **Status**: Implemented & Locally Verified (not committed, not deployed)

### 1. Context / Problem

- **Razorpay calls had no deadline**, so a stalled request could hold checkout, verify or a refund open indefinitely.
- **Capture checked capacity only**, not whether the batch was still active and not yet started.
- **Owner decision:** keep invoicing off and never invoice an unresolved exception.

### 2. Decisions

1. **Deadlines.** Every Razorpay call must start answering within 10 seconds and finish within 20 seconds, body included.
   - A missed deadline is treated as a network failure, and its outcome is unknown: reads answer null, refunds stay pending under the same idempotency key, and orders are refused with "try again".
   - Payment state changes only on Razorpay's evidence.
2. **Batch status at capture.** Capture applies `resolveBatchAvailability` under the batch and seat locks.
   - A full batch opens `CAPTURED_FOR_FULL_BATCH`.
   - An inactive, upcoming or already-started batch opens `CAPTURED_FOR_UNAVAILABLE_BATCH` (migration `032`, superset checks).
   - In both cases the payment is recorded and the seat is not confirmed.
3. **Seat decisions.** `SEAT_CONFIRMED` now also requires the batch to be open.
4. **Invoices.** The invoice job skips payments with an open exception, and payments whose exception was resolved as refunded or no action, where nothing was supplied. Only a `SEAT_CONFIRMED` resolution makes a payment invoiceable again. The issuing service refuses them too, as a second line of defence (`PAYMENT_EXCEPTION_NOT_INVOICEABLE`).
5. **The expiry job.** It counts a Razorpay payment as captured only if its status is `captured`, or `refunded` with Razorpay's `captured` flag true. An auto-refunded authorisation is never a sale (review finding H1).
6. **Sign-up limits.** Sign-up requests and code confirmations are limited separately per IP: 5 and 10 per 15 minutes.

### 3. Alternatives Considered

- **An undici agent with a separate connect timeout.** Rejected: it adds a dependency. The response-start deadline bounds the connection and Node's built-in connect timeout still applies underneath.
- **Confirming seats in started batches.** Rejected: the student would join a course already under way without a decision by staff.

### 4. Reason

Payment requests must not hang, and a payment must never silently produce an invalid seat or an invoice for a disputed sale.

### 5. Consequences / Trade-offs

- **A slow Razorpay can make checkout fail with "try again".** Verify can likewise show "confirming" until the webhook arrives.
- **Migration 032** briefly locks `payment_events`, as 030 does.
- **Verified:**
  - In-memory and real-PostgreSQL tests, including a capture racing a batch being deactivated.
  - Removing each guard made its test fail.
