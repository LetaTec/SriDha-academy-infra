# SriDha Academy (LetEd) — Production Security Hardening Reference

This document details the security controls, cryptographic standards, rate limiting mechanisms, and defense-in-depth policies implemented across the SriDha Academy platform.

---

## 1. Authentication & Session Security

### Cryptographic Password Hashing

- **Algorithm**: Argon2id via `@node-rs/argon2`
- **Configuration Parameters**:
  - Memory Cost: 19,456 KiB (19 MiB)
  - Time Cost: 2 iterations
  - Parallelism: 1 thread
  - Output Length: 32 bytes
- **Rationale**: Argon2id provides state-of-the-art resistance against GPU/ASIC cracking and side-channel timing attacks. Passwords are never stored in plaintext, never logged, and never included in error details.

### Cryptographic Session Tokens

- **Entropy**: 256 bits (`crypto.randomBytes(32).toString('hex')`).
- **Database Storage**: Session tokens are hashed using SHA-256 (`crypto.createHash('sha256')`) before storage in the `sessions` table (`token_hash` column). Even in the event of a database compromise or backup leak, active session tokens cannot be recovered or reused.
- **Session Lifetimes**:
  - Standard session: 24 hours (`SESSION_TTL_DAYS=1`).
  - Remembered session: 30 days (`SESSION_REMEMBER_TTL_DAYS=30`).
- **Session Cleanup**: Inactive or expired sessions are excluded during lookup (`expires_at > CURRENT_TIMESTAMP`) and cleaned up on query.

### Session Rotation on Re-Authentication

- **Mechanism**: When an authenticated student or client submits valid credentials to `POST /api/auth/login`, any active session bound to the request (`req.auth.sessionId`) is explicitly revoked in the database before the new session is generated and set.
- **Defense**: Prevents session accumulation and mitigates session fixation attack vectors.

### Production Cookie Policy

- **Cookie Name**: `leta_session`
- **Attributes in Production**:
  - `HttpOnly: true` (prevents JavaScript access via `document.cookie`, mitigating XSS exfiltration).
  - `Secure: true` (ensures cookies are only transmitted over TLS/HTTPS).
  - `SameSite: none` (allows cross-site transmission between Cloudflare Pages and Render).
  - `Partitioned: true` (CHIPS compliance: binds the cookie to the top-level origin `sridhaacademy.com`, ensuring privacy and future-proofing against third-party cookie phase-out).
  - `Path: /`
- **Same-Site Architecture Path**: Once `api.sridhaacademy.com` custom domain is mapped to Render, setting `COOKIE_SAMESITE=lax` in environment variables transitions the cookie to first-party same-site behavior.

---

## 2. Rate Limiting & Abuse Prevention

The API enforces strict rate limits using `express-rate-limit` to prevent brute-force attacks, credential stuffing, account creation flooding, and automated form spam.

### Rate Limit Configuration Matrix

| Endpoint                           | Method | Window     | Max Attempts | Limiter Name                  | Protection Goal                                 |
| :--------------------------------- | :----- | :--------- | :----------- | :---------------------------- | :---------------------------------------------- |
| `/api/auth/login`                  | `POST` | 15 minutes | 10           | `loginLimiter`                | Prevent brute-force password guessing           |
| `/api/auth/register`               | `POST` | 15 minutes | 5            | `registerLimiter`             | Prevent automated bot account creation          |
| `/api/auth/password-reset`         | `POST` | 15 minutes | 5            | `passwordResetRequestLimiter` | Prevent email flooding / spam                   |
| `/api/auth/password-reset/confirm` | `POST` | 15 minutes | 10           | `passwordResetConfirmLimiter` | Prevent brute-force token enumeration           |
| `/api/enquiries`                   | `POST` | 15 minutes | 10           | `enquiryLimiter`              | Prevent waitlist form flooding & table bloating |

### Rate Limit Exceeded Response

When a client exceeds the threshold, the API responds with **HTTP 429 Too Many Requests**:

```json
{
  "message": "Too many requests. Please try again later.",
  "code": "TOO_MANY_REQUESTS",
  "details": null
}
```

### Proxy & IP Attribution

- In `api/src/app/app.ts`, `app.set('trust proxy', 1)` is enabled.
- Render terminates TLS and forwards the client's public IP in the `X-Forwarded-For` header. Trusting exactly 1 proxy hop ensures rate limiting applies to the actual end-user IP rather than Render's internal load balancers.

### Scaling Architecture & In-Memory Store

- The current implementation uses the default in-memory `MemoryStore`.
- This is completely zero-cost and optimal for a single Render Web Service container.
- **Architectural Boundary**: If the API is horizontally autoscaled to multiple instances, rate limit counters will be local to each instance. In a multi-container deployment, migrate to `rate-limit-redis` backed by a managed Redis store.

---

## 3. Password Recovery Security

### Reset Token Lifecycle

1. **Generation**: `crypto.randomBytes(32).toString('hex')` generates a 64-character, 256-bit cryptographically secure token.
2. **Storage**: Stored as SHA-256 hash in `password_reset_tokens` table. The raw token is only transmitted once via email.
3. **Expiration**: Tokens are strictly valid for **60 minutes** (`expires_at`).
4. **Single-Use Invalidation**: When a token is consumed via `POST /api/auth/password-reset/confirm`, `used_at` is set to the current timestamp. Any subsequent attempt to use the same token is rejected.
5. **Session Invalidation**: When a password is reset, all existing active sessions for that user account are revoked immediately, logging out any unauthorized sessions.
6. **Anti-Enumeration**: `POST /api/auth/password-reset` returns `{ success: true }` regardless of whether the submitted email address exists in the database.

### Mail Transport Configuration

- In production, email delivery requires `MAIL_TRANSPORT=resend` and a valid `RESEND_API_KEY`.
- If unconfigured, the endpoint fails safely with HTTP 503 (`SERVICE_UNAVAILABLE`) and logs an operational alert without leaking internal state or credentials.

---

## 4. HTTP Transport Security & Headers

The API enforces strict HTTP headers on every response:

```http
Content-Security-Policy: default-src 'none'; frame-ancestors 'none';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains (production only)
Vary: Origin
```

### OriginGuard & CORS Policy

- CORS is strictly locked down to permitted origins specified in `WEB_ORIGIN` and `ALLOWED_ORIGINS`.
- Allowed origins are normalized (whitespace stripped, trailing slashes removed).
- Wildcard origins (`*`) are strictly forbidden when credentials (`withCredentials: true`) are enabled.
- Sibling domain pairing automatically permits `https://sridhaacademy.com` and `https://www.sridhaacademy.com`.

---

## 5. Input Validation & SQL Injection Prevention

- **Strict Request Validation**: Every endpoint validates request bodies using strict Zod schemas (`z.strictObject`). Unknown or extra parameters are rejected with `REQUEST_VALIDATION_FAILED` (HTTP 400).
- **Parameterized SQL**: All database queries through the PostgreSQL adapter use parameterized values (`$1, $2, ...`). Zero string concatenation is permitted in query construction.
