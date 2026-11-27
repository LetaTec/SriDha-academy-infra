# SriDha Academy (LetEd) — Environment Variable Reference

This document provides a comprehensive, authoritative reference for all configuration variables used by the SriDha Academy frontend and backend services.

---

## 1. Backend Runtime Variables (`api/`)

Configure these in the backend hosting environment (e.g. Render Dashboard under **Environment**) or in `api/.env` for local development.

| Variable                    | Scope   | Required / Optional                 | Default Value                                | Description & Security Notes                                                                                                                                                                                                                                                                                                                                                                                                          |
| :-------------------------- | :------ | :---------------------------------- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                  | Backend | Optional                            | `development`                                | Environment mode (`development`, `test`, `production`). In `production`, secure cookies and strict validation are enforced.                                                                                                                                                                                                                                                                                                           |
| `PORT`                      | Backend | Optional                            | `4000`                                       | HTTP port on which the Express server listens.                                                                                                                                                                                                                                                                                                                                                                                        |
| `DATABASE_URL`              | Backend | **Required in production**          | `null` (uses PGlite in-memory)               | PostgreSQL connection URI, e.g. `postgres://user:password@hostname:5432/dbname`. **Confidential — never commit to Git.**                                                                                                                                                                                                                                                                                                              |
| `WEB_ORIGIN`                | Backend | **Required in production**          | `http://localhost:5173`                      | Canonical primary frontend origin (e.g. `https://sridhaacademy.com`). Validated by CORS middleware and OriginGuard.                                                                                                                                                                                                                                                                                                                   |
| `ALLOWED_ORIGINS`           | Backend | Optional                            | `""`                                         | Comma-separated list of additional permitted frontend origins (e.g. `https://www.sridhaacademy.com,https://sridha-academy.pages.dev`).                                                                                                                                                                                                                                                                                                |
| `SESSION_TTL_DAYS`          | Backend | Optional                            | `1`                                          | Session lifetime in days for regular student logins.                                                                                                                                                                                                                                                                                                                                                                                  |
| `SESSION_REMEMBER_TTL_DAYS` | Backend | Optional                            | `30`                                         | Extended session lifetime in days when "Remember me" is checked.                                                                                                                                                                                                                                                                                                                                                                      |
| `COOKIE_SAMESITE`           | Backend | Optional                            | `none` (in prod), `lax` (in dev)             | Cookie SameSite policy (`none`, `lax`, `strict`). Use `none` for cross-origin hosting, `lax` when using `api.sridhaacademy.com`.                                                                                                                                                                                                                                                                                                      |
| `COOKIE_DOMAIN`             | Backend | Optional                            | `undefined`                                  | Explicit cookie domain attribute (e.g. `.sridhaacademy.com`). Leave unset unless sharing cookies across subdomains.                                                                                                                                                                                                                                                                                                                   |
| `MAIL_TRANSPORT`            | Backend | Optional                            | `null`                                       | Mail delivery provider: `console` (development/test only) or `resend`. In production, `console` is forbidden. **Must be `resend` to send real email**: setting only `RESEND_API_KEY` is refused at start-up. Unset (with no key): sign-up answers `SIGN_UP_UNAVAILABLE` (it needs the emailed code), password recovery answers `PASSWORD_RECOVERY_UNAVAILABLE` and payment confirmations wait in the outbox.                          |
| `RESEND_API_KEY`            | Backend | Required if `MAIL_TRANSPORT=resend` | `null`                                       | Resend API key (`re_...`) for sign-up codes, password reset codes, staff sign-in links and payment confirmations. Needs Sending access only. A key without `MAIL_TRANSPORT=resend` stops start-up. **Confidential.**                                                                                                                                                                                                                  |
| `MAIL_CONSOLE_FILE`         | Backend | Optional                            | `null`                                       | Development and browser tests only: with `MAIL_TRANSPORT=console`, each email (including sign-up and reset codes) is also appended to this file as one JSON line. Playwright sets it to `web/e2e-mail.log` (ignored by git). Refused in production and with any other transport.                                                                                                                                                      |
| `EMAIL_FROM`                | Backend | Optional                            | `SriDha Academy <noreply@sridhaacademy.com>` | Sender name and address for transactional emails. Must match verified domain in Resend.                                                                                                                                                                                                                                                                                                                                               |
| `PG_MAX_CONNECTIONS`        | Backend | Optional                            | `10`                                         | Maximum number of concurrent connections in the PostgreSQL pool.                                                                                                                                                                                                                                                                                                                                                                      |
| `SERVE_WEB_DIST`            | Backend | Optional                            | `false`                                      | When `true`, serves compiled static assets from `web/dist` directly. Disabled when frontend is on Cloudflare Pages.                                                                                                                                                                                                                                                                                                                   |
| `SUPER_ADMIN_EMAILS`        | Backend | Optional                            | none                                         | Comma-separated super admin emails, e.g. `samakshmathur25@gmail.com`. They sign in at `/admin-sign-in` with a one-time emailed link (no password), so `MAIL_TRANSPORT=resend` is needed in production. Applied on every start; removing an email removes the role.                                                                                                                                                                    |
| `RAZORPAY_KEY_ID`           | Backend | Optional (set with the secret)      | none                                         | Razorpay public key id. With the secret set, "Enrol now" and "Pre-register now" open Razorpay checkout; without both, checkout runs in test mode and orders stay payment pending.                                                                                                                                                                                                                                                     |
| `RAZORPAY_KEY_SECRET`       | Backend | Optional (set with the key id)      | none                                         | Razorpay key secret, used to create orders and verify payment signatures. Keep it only in the hosting provider's secret settings.                                                                                                                                                                                                                                                                                                     |
| `RAZORPAY_WEBHOOK_SECRET`   | Backend | Recommended with Razorpay keys      | none                                         | Secret chosen in Razorpay → Settings → Webhooks for `https://<api host>/api/payments/webhook` (events `payment.captured`, `order.paid`). Lets Razorpay confirm a paid seat even if the student closes the page before the browser confirms it. Without it the webhook answers 503.                                                                                                                                                    |
| `INVOICING_ENABLED`         | Backend | Optional                            | `false`                                      | GST tax invoices. Off unless exactly `true`. Even when `true`, nothing is issued until an approved tax configuration (SAC, rate, rounding policy, calculation version) is recorded in `tax_configuration_approvals` and a payment actually collected quoted GST. Leave `false` until the CA approval is recorded.                                                                                                                     |
| `MIGRATION_DATABASE_URL`    | Backend | **Required in production**          | none                                         | Connection URL of the role that **owns** the tables, used only for migrations, grants and seeding. When set, `DATABASE_URL` must be a restricted application role (see `docs/database-roles.md`). Unset: `DATABASE_URL` does both (local development and tests only; production refuses to start). Must sign in as a different role from `DATABASE_URL`: start-up checks the actual roles and stops on any problem. **Confidential.** |
| `DATABASE_SSL`              | Backend | Optional                            | `verify` (production), `disable` (otherwise) | `verify`: TLS with server certificate verification. `disable`: no TLS (local only; refused in production). TLS settings inside connection URLs are ignored.                                                                                                                                                                                                                                                                           |
| `DATABASE_SSL_CA`           | Backend | Optional                            | none                                         | PEM certificate of the database provider's CA when it is not publicly trusted (`\n` escapes allowed).                                                                                                                                                                                                                                                                                                                                 |

---

## 2. Frontend Build-Time Variables (`web/`)

Configure these in the Cloudflare Pages Dashboard under **Settings** → **Environment variables**.

> [!IMPORTANT]
> All variables prefixed with `VITE_` are embedded directly into compiled JavaScript assets during `npm run build`. Never put secret keys, database credentials, or private tokens in `VITE_*` variables.

| Variable       | Scope    | Required / Optional        | Default Value | Description                                                                                                                                 |
| :------------- | :------- | :------------------------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_API_URL` | Frontend | **Required in production** | `/api`        | Base URL of the backend API, including `/api` suffix: `https://api.sridhaacademy.com/api` or `https://sridha-academy-api.onrender.com/api`. |
| `NODE_VERSION` | Frontend | Recommended                | `22`          | Directs Cloudflare Pages build container to use Node.js 22 LTS.                                                                             |

---

## 3. Safe Example Files

### Safe `api/.env.example`

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sridha_dev
WEB_ORIGIN=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
MAIL_TRANSPORT=console
# For production email:
# MAIL_TRANSPORT=resend
# RESEND_API_KEY=re_your_api_key_here
# EMAIL_FROM=SriDha Academy <noreply@sridhaacademy.com>
# Optional cookie overrides:
# COOKIE_SAMESITE=none
# COOKIE_DOMAIN=.sridhaacademy.com
```

### Safe `web/.env.example`

```env
# Cloudflare Pages production:
# VITE_API_URL=https://sridha-academy-api.onrender.com/api
# Or with custom domain:
# VITE_API_URL=https://api.sridhaacademy.com/api
# Local development:
VITE_API_URL=http://localhost:4000/api
```
