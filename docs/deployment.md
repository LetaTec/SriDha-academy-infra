# SriDha Academy (LetEd) — Production Deployment Guide

This guide outlines the exact, verified procedure for provisioning and deploying the SriDha Academy backend API on **Render**, managed **PostgreSQL**, and linking it to the live **Cloudflare Pages** frontend.

---

## 1. Target Infrastructure Topology

```
Frontend (Live)              Backend API (Render)              Managed PostgreSQL
https://sridhaacademy.com ──► https://api.sridhaacademy.com ──► Private Connection
(Cloudflare Pages)           (Node 22 / Express 5)             (PostgreSQL 16+)
```

---

## 2. Phase A: Provisioning Managed PostgreSQL

### Step 1: Create PostgreSQL Database on Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **PostgreSQL**.
3. Fill in the database specifications:
   - **Name**: `sridha-academy-db`
   - **Database**: `sridha_production`
   - **User**: `sridha_user`
   - **Region**: Singapore or Frankfurt (choose the region closest to India/target audience).
   - **PostgreSQL Version**: `16`.
   - **Plan**: **Starter** ($7/month) or higher.
     _(Note: Do not use the Free tier for production because free databases expire after 30 days and lack persistent automated backups)._
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (for services running on Render) and **External Database URL** (for remote admin/migration tools).

---

## 3. Phase B: Deploying the Backend API on Render

### Step 1: Create Web Service

1. In the Render Dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository: **`LetaTec/LetEd`**.
3. Configure service details:
   - **Name**: `sridha-academy-api`
   - **Region**: Same region as your PostgreSQL database.
   - **Branch**: `main` (after merging the reviewed feature branch).
   - **Root Directory**: `.` (leave at repository root for npm workspaces).
   - **Runtime**: `Node`.
   - **Build Command**: `npm run build -w api`
   - **Start Command**: `npm run start -w api`
   - **Instance Type**: **Starter** ($7/month) or higher.
     _(Free web services sleep after 15 minutes of inactivity, causing 50-second cold starts that break student login UX)._

### Step 2: Configure Environment Variables

Under the **Environment** tab of your new Web Service, add:

| Key                  | Value                                                                                                                                       | Notes                                                                                                      |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`           | `production`                                                                                                                                | Enforces secure cookies and validation                                                                     |
| `PORT`               | `4000`                                                                                                                                      | Render assigns port or sets PORT automatically                                                             |
| `DATABASE_URL`       | `<Internal Database URL from Step 2>`                                                                                                       | From Render PostgreSQL service                                                                             |
| `WEB_ORIGIN`         | `https://sridhaacademy.com`                                                                                                                 | Primary production domain                                                                                  |
| `ALLOWED_ORIGINS`    | `https://www.sridhaacademy.com,https://sridha-academy.pages.dev,https://*.sridha-academy.pages.dev,https://*.sridha-academy-site.pages.dev` | Allowed sites. `https://*.<host>` allows that host's preview deployments (one subdomain level, https only) |
| `MAIL_TRANSPORT`     | `resend`                                                                                                                                    | Enables transactional email                                                                                |
| `RESEND_API_KEY`     | `re_...`                                                                                                                                    | From Resend dashboard                                                                                      |
| `EMAIL_FROM`         | `SriDha Academy <noreply@sridhaacademy.com>`                                                                                                | Verified sender address                                                                                    |
| `PG_MAX_CONNECTIONS` | `10`                                                                                                                                        | Pool sizing                                                                                                |

### Step 3: Health Check Endpoint

In the Render Service Settings:

- **Health Check Path**: `/api/health`
  Render will verify this path before routing production traffic. The endpoint verifies active PostgreSQL connectivity.

---

## 4. Phase C: Custom Domain Configuration (`api.sridhaacademy.com`)

1. In Render, open your Web Service → **Settings** → **Custom Domains**.
2. Click **Add Custom Domain** and enter: `api.sridhaacademy.com`.
3. Render will provide a DNS verification target (e.g. `sridha-academy-api.onrender.com`).
4. In your **Cloudflare Dashboard** (where DNS for `sridhaacademy.com` is hosted):
   - Navigate to **DNS** → **Records**.
   - Click **Add record**:
     - **Type**: `CNAME`
     - **Name**: `api`
     - **Target**: `sridha-academy-api.onrender.com`
     - **Proxy status**: **DNS only** (Gray cloud) initially, or **Proxied** (Orange cloud) with SSL mode set to **Full (strict)**.
5. Wait 2–5 minutes for Render to verify DNS and provision the Let's Encrypt SSL/TLS certificate.
6. Verify via terminal:
   ```bash
   curl -I https://api.sridhaacademy.com/api/health
   ```
   Expected response: `200 OK` with JSON `{"status":"ok","database":"connected"}`.

---

## 5. Phase D: Seeding Catalogue Data

Once the backend is live and connected to PostgreSQL:
Run the seed script against the database:

```bash
DATABASE_URL="<External Database URL>" npm run db:seed
```

This populates the initial subject topics, lessons, and batch cohorts into production.

---

## 6. Phase E: Connecting Cloudflare Pages Frontend

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → click your `sridha-academy` Pages project.
2. Navigate to **Settings** → **Environment variables**.
3. Under **Production**, set:
   - `VITE_API_URL` = `https://api.sridhaacademy.com/api`
4. Trigger a fresh deployment:
   - Go to **Deployments** tab → click **Retry deployment** on the latest build, or push a commit to `main`.
5. Once complete, visit `https://sridhaacademy.com/batches` and verify that live topics and batches load seamlessly.

---

## 7. Production Smoke-Test Checklist

Verify each critical path after deployment:

- [ ] **Health Check**: `GET https://api.sridhaacademy.com/api/health` returns `status: ok` and `database: connected`.
- [ ] **CORS Preflight**: `OPTIONS https://api.sridhaacademy.com/api/auth/register` with `Origin: https://sridhaacademy.com` returns `204 No Content` and `Access-Control-Allow-Credentials: true`.
- [ ] **Catalogue Discovery**: Visiting `https://sridhaacademy.com/batches` renders live topics without error alerts.
- [ ] **Student Registration**: Register a test account. Verify `leta_session` cookie is received with `HttpOnly`, `SameSite=Lax`, and `Secure`.
- [ ] **Session Restoration**: Refresh the browser; student name and profile must remain active.
- [ ] **Batch Enrolment**: Enrol in an open batch; verify enrolment appears under `/my-learning`.
- [ ] **Model Paper Waitlist**: Submit waitlist request on `/`; verify successful confirmation toast.
- [ ] **Logout**: Click Sign Out; verify session cookie is cleared.
