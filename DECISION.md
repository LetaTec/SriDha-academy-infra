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
