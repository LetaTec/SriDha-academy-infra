# SriDha Academy (LetEd) — Production Security Audit Report

**Date of Audit**: October 22, 2026  
**Repository**: LetaTec/LetEd  
**Current Branch**: `feat/production-security-hardening`  
**Target Environment**:

- Frontend: Cloudflare Pages (`https://sridhaacademy.com`, `https://www.sridhaacademy.com`)
- Backend: Render Web Service (`https://sridha-academy-api.onrender.com`)
- Database: Render PostgreSQL
- Session Cookie: `leta_session` (`SameSite=None; Secure; Partitioned; HttpOnly`)

---

## 1. Executive Summary

This security audit and verification evaluates the production readiness and resilience of the SriDha Academy platform across authentication, session management, password recovery, API abuse prevention, database durability, and HTTP transport security.

The application core exhibits sound fundamental design: passwords are encrypted with Argon2id, session tokens are 256-bit high-entropy cryptographic strings hashed with SHA-256 before database storage, request bodies are validated with strict Zod schemas, SQL queries use parameterized prepared statements, and session cookies are protected with `HttpOnly` and `Secure` attributes.

However, the audit identified critical operational and configuration vulnerabilities—most notably the **Render free-tier PostgreSQL 30-day lifecycle expiration and lack of automated backups**, **unbounded enquiry waitlist submissions**, **lack of session rotation on re-authentication**, and **missing API security headers**. All code-level vulnerabilities have been hardened and verified with automated tests on `feat/production-security-hardening`.

---

## 2. Prioritized Vulnerability & Finding Matrix

| ID          | Priority  | Category            | Finding Summary                                                                  | Status in Code       | Production Action Required                                      |
| :---------- | :-------- | :------------------ | :------------------------------------------------------------------------------- | :------------------- | :-------------------------------------------------------------- |
| **SEC-001** | 🔴 **P0** | Database Durability | Render Free PostgreSQL expires after 30 days and lacks automated backups         | Documented           | Upgrade to Starter ($7/mo) or schedule daily off-site `pg_dump` |
| **SEC-002** | 🔴 **P0** | Session Security    | Missing session rotation on re-login (orphaned session accumulation)             | **Remediated**       | None (deploys with API build)                                   |
| **SEC-003** | 🔴 **P0** | Password Recovery   | Production email delivery inactive (unconfigured `RESEND_API_KEY`)               | Safely Handled (503) | Set `MAIL_TRANSPORT=resend` and `RESEND_API_KEY`                |
| **SEC-004** | 🟠 **P1** | Abuse Prevention    | Missing granular rate limiting on enquiries and authentication endpoints         | **Remediated**       | None (deploys with API build)                                   |
| **SEC-005** | 🟠 **P1** | Transport & Headers | Missing strict security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy) | **Remediated**       | None (deploys with API build)                                   |
| **SEC-006** | 🟠 **P1** | Origin Validation   | Potential whitespace or trailing slash discrepancy in `OriginGuard`              | **Remediated**       | None (deploys with API build)                                   |
| **SEC-007** | 🟡 **P2** | Scalability         | In-memory rate limiting is process-local (resets on restart / multi-instance)    | Documented           | Add Redis store if horizontally scaling to >1 instance          |
| **SEC-008** | 🟡 **P2** | Cookie Topology     | Third-party cookie dependency (`SameSite=None`) pending custom API domain        | Resilient            | Configure `api.sridhaacademy.com` CNAME when ready              |

---

## 3. Detailed Audit Findings & Code Evidence

### SEC-001: Render Free PostgreSQL Expiration & Backup Absence

- **Severity**: 🔴 **P0 (Critical Operational Vulnerability)**
- **Evidence**:
  - Render free-tier PostgreSQL instances are ephemeral and automatically marked for deletion after 30 days (documented expiration date: November 18, 2026).
  - The Render free tier does not provide automated daily physical snapshots or Point-In-Time-Recovery (PITR).
- **Impact**: Complete data loss of student user accounts, hashed credentials, and course enrolment records if the 30-day boundary is reached without migration or upgrade.
- **Existing Protection**: Logical migration scripts (`api/src/db/migrateSqliteToPostgres.ts`) exist, but cannot restore data if the live database vanishes.
- **Recommended Correction**:
  1. Upgrade the Render PostgreSQL instance to a persistent tier (e.g. Starter tier at $7/month), which automatically guarantees automated daily physical snapshots, continuous retention, and prevents the 30-day instance termination.
  2. Implement an immediate off-site backup procedure using `pg_dump` with custom format (`--format=custom`), encrypted and stored in secure cloud storage.
- **Verification**: Documented in `docs/database-backup-and-recovery.md`.

---

### SEC-002: Session Rotation on Re-Authentication

- **Severity**: 🔴 **P0 (High)**
- **Evidence**:
  - In `api/src/modules/auth/auth.routes.ts`: When a student logged in via `POST /api/auth/login`, `createSession` generated a new session token, set a new cookie, and inserted a new session row.
  - However, if the client already presented an active `req.auth.sessionId`, the old session was not explicitly revoked in the database.
- **Impact**: While not directly exploitable without a stolen cookie, failing to revoke prior sessions on explicit re-login leads to credential accumulation in the database and violates session fixation defense best practices.
- **Correction Implemented**:
  - In `api/src/modules/auth/auth.routes.ts`: Prior to generating the new session upon successful password verification, `authService.deleteSession(context, req.auth.sessionId)` is executed if an existing active session was attached to the request.
- **Regression Risk**: Low. If no session is present, the call is skipped.
- **Verification**: Verified via test case in `api/src/modules/auth/auth.test.ts`.

---

### SEC-003: Password Recovery Email Delivery

- **Severity**: 🔴 **P0 (High for Feature Availability, Low for Token Leakage)**
- **Evidence**:
  - In `api/src/modules/auth/email.ts`, `createEmailService` checks `env.mailTransport`.
  - In production (`NODE_ENV === 'production'`), if `MAIL_TRANSPORT` is not set or set to `console`, the service safely throws `SERVICE_UNAVAILABLE` (HTTP 503) rather than dumping tokens into production container stdout or failing silently.
  - Reset tokens are cryptographically generated using `crypto.randomBytes(32).toString('hex')` (256-bit entropy) and hashed with SHA-256 (`hashToken`) before being stored in the `password_reset_tokens` table.
  - Tokens expire in 60 minutes, are strictly single-use (`used_at IS NOT NULL`), and all active tokens for a user are marked as used upon password reset completion.
- **Existing Protection**: Architecture is fully secure against enumeration and token interception; generic success responses are returned (`{ success: true }`) even if the email does not exist.
- **Recommended Correction**:
  - To enable live recovery in production, configure Resend API credentials:
    - Set `MAIL_TRANSPORT=resend`
    - Set `RESEND_API_KEY=re_...`
    - Set `EMAIL_FROM=SriDha Academy <noreply@sridhaacademy.com>`
  - No code modifications required.

---

### SEC-004: Granular Rate Limiting & Abuse Prevention

- **Severity**: 🟠 **P1 (High)**
- **Evidence**:
  - Prior to this hardening phase, general rate limiting was applied to `/api/auth/login` (10 req / 15 min), `/api/auth/register` (5 req / 15 min), and `/api/auth/password-reset` (5 req / 15 min).
  - However, `/api/enquiries` (the public waitlist enquiry form) had no rate limiting, leaving it open to automated spam and database row bloating.
  - Furthermore, `/api/auth/password-reset/confirm` did not have an independent limiter attached directly to its POST handler.
- **Correction Implemented**:
  - In `api/src/app/app.ts`:
    - Added dedicated `enquiryLimiter` enforcing 10 submissions per 15 minutes per IP on `POST /api/enquiries`.
    - Bound `passwordResetConfirmLimiter` (10 attempts per 15 minutes per IP) to `POST /api/auth/password-reset/confirm` to prevent brute-force token guessing.
    - Rate limit responses return standardized JSON: `{ message: "Too many requests. Please try again later.", code: "TOO_MANY_REQUESTS", details: null }` with HTTP 429.
- **Verification**: Verified via HTTP tests in `api/src/modules/auth/auth.test.ts` and `api/src/test/database.test.ts`.

---

### SEC-005: HTTP Security Headers

- **Severity**: 🟠 **P1 (Medium-High)**
- **Evidence**:
  - The API relied on default Express headers. While the Cloudflare Pages frontend configured headers via `_headers`, direct API requests to `https://sridha-academy-api.onrender.com` lacked defensive headers.
- **Correction Implemented**:
  - In `api/src/app/app.ts`, implemented global defensive security headers:
    - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none';` (API never renders HTML; prevents framing and script injection).
    - `X-Content-Type-Options: nosniff` (prevents MIME sniffing).
    - `X-Frame-Options: DENY` (prevents clickjacking).
    - `Referrer-Policy: strict-origin-when-cross-origin` (protects referrer privacy).
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()` (restricts sensitive device capabilities).
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforced when `NODE_ENV === 'production'`).
- **Verification**: Verified via test suite in `api/src/modules/auth/auth.test.ts`.

---

### SEC-006: Origin Guard Normalization

- **Severity**: 🟠 **P1 (Medium)**
- **Evidence**:
  - `OriginGuard` (`api/src/http/originGuard.ts`) compared incoming `origin` and `referer` headers against `env.allowedOrigins`.
  - If a client or browser sent an origin with trailing slashes or varying whitespace in configuration, string set matching could fail or produce inconsistent results.
- **Correction Implemented**:
  - In `api/src/http/originGuard.ts`, normalized all incoming origin strings (`origin.trim().replace(/\/+$/, '')`) before comparing against normalized permitted origins.
- **Verification**: Zero regressions in CORS and CSRF origin protection tests.

---

### SEC-007: In-Memory Rate Limiting Boundaries

- **Severity**: 🟡 **P2 (Operational Limitation)**
- **Evidence**:
  - `express-rate-limit` utilizes an in-memory `MemoryStore` by default.
  - On Render, if the API service restarts or sleeps (on free tier), in-memory counters reset.
  - If horizontal autoscaling is enabled (running >1 container instances), each instance maintains its own separate memory counters.
- **Status**: Acceptable for current single-instance Render Web Service deployment. Documented requirement to adopt Redis store (`rate-limit-redis`) if horizontal autoscaling is deployed in the future.

---

### SEC-008: Cross-Site Cookie Policy & Domain Topology

- **Severity**: 🟡 **P2 (Architectural Recommendation)**
- **Evidence**:
  - Session cookies use `SameSite=None; Secure; Partitioned` to support cross-origin authentication between `sridhaacademy.com` (Cloudflare Pages) and `sridha-academy-api.onrender.com` (Render).
  - Modern browsers require `Partitioned` (CHIPS) and HTTPS for cross-site cookie retention.
- **Status**: Production-verified and working. Long-term recommendation remains creating `api.sridhaacademy.com` pointing to Render via CNAME to make the API same-site (`.sridhaacademy.com`), allowing `SameSite=Lax`.

---

## 4. Verification & Automated Test Results

The full test suite was executed locally in the repository:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

### Results Summary

- **TypeScript Typecheck**: Passed cleanly with **0 errors** across both `api` and `web`.
- **ESLint & Style Validation**: Passed cleanly with **0 errors and 0 warnings**.
- **Automated Tests**: **67 passing tests (37 API tests, 30 Web tests)**:
  - Auth registration, duplicate account rejection, password hashing verification.
  - Session creation, retrieval, invalidation on logout.
  - **Session rotation on re-login**.
  - Rate-limit enforcement on `/api/auth/login`, `/api/auth/register`, `/api/auth/password-reset`, `/api/auth/password-reset/confirm`, and `/api/enquiries`.
  - HTTP Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy`).
  - OriginGuard CORS rejection for unapproved origins.
  - Enrolment access control and transactional integrity.
- **Production Builds**:
  - `api/dist`: 100% compiled via `tsc`.
  - `web/dist`: 100% optimized production bundle via `vite build`.

---

## 5. Security Recommendations & Immediate Actions

1. **Immediate P0 Action**: Contact repository owner / DevOps to verify the Render PostgreSQL database plan. If currently on the free tier, upgrade immediately to Starter ($7/mo) to prevent automatic deletion on November 18, 2026, and enable automated daily snapshots.
2. **Email Provider Configuration**: When ready to enable student self-service password recovery, configure Resend domain verification and set `RESEND_API_KEY` on Render.
3. **Dedicated API Subdomain**: Follow `docs/deployment.md` to add `api.sridhaacademy.com` CNAME in Cloudflare DNS for first-party same-site cookie security.
