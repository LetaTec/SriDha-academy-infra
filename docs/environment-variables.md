# SriDha Academy (LetEd) — Environment Variable Reference

This document provides a comprehensive, authoritative reference for all configuration variables used by the SriDha Academy frontend and backend services.

---

## 1. Backend Runtime Variables (`api/`)

Configure these in the backend hosting environment (e.g. Render Dashboard under **Environment**) or in `api/.env` for local development.

| Variable                    | Scope   | Required / Optional                 | Default Value                                | Description & Security Notes                                                                                                                                                                                                                                                       |
| :-------------------------- | :------ | :---------------------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                  | Backend | Optional                            | `development`                                | Environment mode (`development`, `test`, `production`). In `production`, secure cookies and strict validation are enforced.                                                                                                                                                        |
| `PORT`                      | Backend | Optional                            | `4000`                                       | HTTP port on which the Express server listens.                                                                                                                                                                                                                                     |
| `DATABASE_URL`              | Backend | **Required in production**          | `null` (uses PGlite in-memory)               | PostgreSQL connection URI, e.g. `postgres://user:password@hostname:5432/dbname`. **Confidential — never commit to Git.**                                                                                                                                                           |
| `WEB_ORIGIN`                | Backend | **Required in production**          | `http://localhost:5173`                      | Canonical primary frontend origin (e.g. `https://sridhaacademy.com`). Validated by CORS middleware and OriginGuard.                                                                                                                                                                |
| `ALLOWED_ORIGINS`           | Backend | Optional                            | `""`                                         | Comma-separated list of additional permitted frontend origins (e.g. `https://www.sridhaacademy.com,https://sridha-academy.pages.dev`).                                                                                                                                             |
| `SESSION_TTL_DAYS`          | Backend | Optional                            | `1`                                          | Session lifetime in days for regular student logins.                                                                                                                                                                                                                               |
| `SESSION_REMEMBER_TTL_DAYS` | Backend | Optional                            | `30`                                         | Extended session lifetime in days when "Remember me" is checked.                                                                                                                                                                                                                   |
| `COOKIE_SAMESITE`           | Backend | Optional                            | `none` (in prod), `lax` (in dev)             | Cookie SameSite policy (`none`, `lax`, `strict`). Use `none` for cross-origin hosting, `lax` when using `api.sridhaacademy.com`.                                                                                                                                                   |
| `COOKIE_DOMAIN`             | Backend | Optional                            | `undefined`                                  | Explicit cookie domain attribute (e.g. `.sridhaacademy.com`). Leave unset unless sharing cookies across subdomains.                                                                                                                                                                |
| `MAIL_TRANSPORT`            | Backend | Optional                            | `null`                                       | Mail delivery provider: `console` (development/test only) or `resend`. In production, `console` is forbidden.                                                                                                                                                                      |
| `RESEND_API_KEY`            | Backend | Required if `MAIL_TRANSPORT=resend` | `null`                                       | Resend API key (`re_...`) for transactional password recovery emails. **Confidential.**                                                                                                                                                                                            |
| `EMAIL_FROM`                | Backend | Optional                            | `SriDha Academy <noreply@sridhaacademy.com>` | Sender name and address for transactional emails. Must match verified domain in Resend.                                                                                                                                                                                            |
| `PG_MAX_CONNECTIONS`        | Backend | Optional                            | `10`                                         | Maximum number of concurrent connections in the PostgreSQL pool.                                                                                                                                                                                                                   |
| `SERVE_WEB_DIST`            | Backend | Optional                            | `false`                                      | When `true`, serves compiled static assets from `web/dist` directly. Disabled when frontend is on Cloudflare Pages.                                                                                                                                                                |
| `SUPER_ADMIN_EMAILS`        | Backend | Optional                            | none                                         | Comma-separated super admin emails, e.g. `samakshmathur25@gmail.com`. They sign in at `/admin-sign-in` with a one-time emailed link (no password), so `MAIL_TRANSPORT=resend` is needed in production. Applied on every start; removing an email removes the role.                 |
| `RAZORPAY_KEY_ID`           | Backend | Optional (set with the secret)      | none                                         | Razorpay public key id. With the secret set, "Enrol now" and "Pre-register now" open Razorpay checkout; without both, checkout runs in test mode and orders stay payment pending.                                                                                                  |
| `RAZORPAY_KEY_SECRET`       | Backend | Optional (set with the key id)      | none                                         | Razorpay key secret, used to create orders and verify payment signatures. Keep it only in the hosting provider's secret settings.                                                                                                                                                  |
| `RAZORPAY_WEBHOOK_SECRET`   | Backend | Recommended with Razorpay keys      | none                                         | Secret chosen in Razorpay → Settings → Webhooks for `https://<api host>/api/payments/webhook` (events `payment.captured`, `order.paid`). Lets Razorpay confirm a paid seat even if the student closes the page before the browser confirms it. Without it the webhook answers 503. |
| `RAZORPAY_WEBHOOK_SECRET`   | Backend | Recommended with Razorpay keys      | none                                         | Secret chosen in Razorpay → Settings → Webhooks for `https://<api host>/api/payments/webhook` (events `payment.captured`, `order.paid`). Lets Razorpay confirm a paid seat even if the student closes the page before the browser confirms it. Without it the webhook answers 503. |

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
