# Cloudflare Pages Deployment Guide — letaEd Frontend

This guide documents the production deployment of the **letaEd** frontend to **Cloudflare Pages**, connected to the GitHub repository and configured for a custom domain.

---

## 1. Architecture Overview & Decoupling

The letaEd platform consists of:

- **`web/`**: Vite + React 19 + TypeScript Single Page Application (SPA).
- **`api/`**: Express 5 + Node.js API on PostgreSQL, hosted on Render.

### Frontend-First Deployment

We are deploying the **frontend first** to Cloudflare Pages as a high-performance static SPA served from Cloudflare's global edge network.

The Express backend and its PostgreSQL database are **not** hosted on Cloudflare Pages (Pages hosts static assets and Workers); the API runs on Render. It applies new migrations itself on start-up.

### Feature Availability Matrix

| Feature                                                                      | Without Deployed API                           | With Deployed API                       |
| :--------------------------------------------------------------------------- | :--------------------------------------------- | :-------------------------------------- |
| **Homepage & Hero**                                                          | ✅ Fully functional                            | ✅ Fully functional                     |
| **Interactive Book Structure & Controls**                                    | ✅ Interactive (shows retry on catalogue page) | ✅ Live topics & batches loaded         |
| **Client-Side Routing (`/`, `/batches`, `/my-learning`, `/reset-password`)** | ✅ Fully functional (SPA fallback)             | ✅ Fully functional                     |
| **Course Catalogue**                                                         | ⚠️ Displays clean error state with retry       | ✅ Live subjects, topics & pricing      |
| **Student Registration & Login**                                             | ⚠️ Displays connection error via `FieldStatus` | ✅ Session created & stored in cookie   |
| **Seat Reservation / Enrolments**                                            | ⚠️ Requires authentication & catalogue         | ✅ Enrolments saved (`PENDING_PAYMENT`) |
| **AI Model Paper Waitlist**                                                  | ⚠️ Displays connection error                   | ✅ Waitlist entry persisted             |
| **Password Reset**                                                           | ⚠️ Displays connection error                   | ✅ Email sent (requires mail transport) |

---

## 2. Cloudflare Pages Project Configuration

In the [Cloudflare Dashboard](https://dash.cloudflare.com/):

1. Navigate to **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**.
2. Select GitHub account and choose repository: **`LetaTec/LetEd`**.
3. Configure the build settings as follows:

### Exact Build Settings

| Setting               | Value                                  | Rationale                                                                    |
| :-------------------- | :------------------------------------- | :--------------------------------------------------------------------------- |
| **Project Name**      | `letaed` (or your chosen project name) | Generates `https://<project-name>.pages.dev`                                 |
| **Production Branch** | `main`                                 | Production builds trigger on commits to `main`                               |
| **Framework Preset**  | `None` (or `Vite`)                     | We use custom workspace build commands                                       |
| **Root Directory**    | `/` (leave empty / repository root)    | **Crucial:** Monorepo with npm workspaces. Resolves root `package-lock.json` |
| **Build Command**     | `npm run build -w web`                 | Runs `tsc --noEmit && vite build` inside `web/`                              |
| **Output Directory**  | `web/dist`                             | Location where Vite outputs compiled production assets                       |
| **Node.js Version**   | `22` (or set `NODE_VERSION=22`)        | Matches engine requirement `>=22.13.0`                                       |

> [!IMPORTANT]
> **Root Directory Must Be `/` (Repository Root)**:
> This repository uses npm workspaces (`workspaces: ["api", "web"]`). Do not set the Root Directory to `web`, because the lockfile (`package-lock.json`) is at the repository root. Setting Root Directory to `/` allows Cloudflare's build system to run `npm install` from root and link workspaces properly.

---

## 3. Environment Variables

Configure environment variables in Cloudflare Pages under **Settings** → **Environment variables**:

### Production Variables

| Variable Name  | Required             | Example Value                    | Description                                                        |
| :------------- | :------------------- | :------------------------------- | :----------------------------------------------------------------- |
| `NODE_VERSION` | Recommended          | `22`                             | Specifies Node.js 22 LTS for the Cloudflare Pages build container. |
| `VITE_API_URL` | Optional (at launch) | `https://api.yourdomain.com/api` | Full URL of the production API. If unset, defaults to `/api`.      |

### Critical Security Rule: No Secrets in `VITE_*`

All variables prefixed with `VITE_` are baked directly into public client JavaScript bundles during `npm run build`.

- **Never** store secrets (database passwords, private keys, API secrets) in `VITE_*` variables.
- The frontend only needs `VITE_API_URL`.

### Handling Unset Production API URL

If `VITE_API_URL` is not set:

- The frontend defaults to `/api`.
- An explicit console warning is logged in production.
- If `/api` requests return HTML (due to Cloudflare Pages SPA fallback when no API is present), an Axios response interceptor intercepts the HTML and converts it to a standard `API_UNAVAILABLE` error (`503`).
- This prevents `undefined` property crashes in React components (`useCatalogue`, `CoursesSection`, `InteractiveBook`) and cleanly displays error states with retry options.

---

## 4. SPA Routing & Static Asset Handling

### Direct Navigation & Browser Refresh

Client-side routes in `web/src/app/router.tsx`:

- `/` (Home)
- `/batches` (Catalogue & topic batches)
- `/my-learning` (Student enrolments)
- `/reset-password` (Password reset)
- `*` (Branded NotFoundPage)

Cloudflare Pages automatically serves `/index.html` with HTTP 200 for clean URL paths that do not match a physical static asset on disk, allowing React Router to handle direct navigation and page refresh seamlessly.

### Preventing False Image / Asset Responses

A common pitfall with SPA fallbacks is that missing static assets (e.g. `/assets/missing-chunk.js` or broken images) are rewritten to `/index.html` with HTTP 200, returning HTML when the browser expects binary or JavaScript.

To prevent this:

1. **Scoped 404 for Assets**: `web/public/assets/404.html` is deployed into `web/dist/assets/404.html`. Missing requests under `/assets/*` return a real 404 response instead of falling back to the SPA `index.html`.
2. **Security & Cache Headers**: `web/public/_headers` configures:
   - Security headers on all routes: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
   - HTML documents: `Cache-Control: public, max-age=0, must-revalidate` (ensures users always receive the latest deployment immediately).
   - Hashed static assets (`/assets/*`): `Cache-Control: public, max-age=31536000, immutable` (optimal 1-year caching for Vite cache-busted assets).

---

## 5. Security & Authentication Requirements

When the API backend is deployed, the following configurations must align:

### 1. Origins & CORS

- **Frontend Origin**: e.g. `https://yourdomain.com` (or `https://<project>.pages.dev`).
- **API Origin**: e.g. `https://api.yourdomain.com` (or `https://yourdomain.com/api` via reverse proxy).
- If the API is hosted on a separate origin/subdomain:
  - The API must respond to CORS pre-flight requests (`OPTIONS`).
  - The API must return headers:
    - `Access-Control-Allow-Origin: https://yourdomain.com` (must be exact; wildcards `*` are invalid when credentials are used).
    - `Access-Control-Allow-Credentials: true`.
    - `Access-Control-Allow-Headers: Content-Type`.
    - `Access-Control-Allow-Methods: GET, POST, OPTIONS`.

### 2. OriginGuard

The API enforces origin checks on state-changing requests (`POST`, `PUT`, `DELETE`):

- The API's `WEB_ORIGIN` environment variable **must** match the frontend origin:
  ```env
  WEB_ORIGIN=https://yourdomain.com
  ```
- If this does not match, the API rejects requests with `403 ORIGIN_NOT_ALLOWED`.

### 3. Session Cookies & SameSite

- The authentication session token (`leta_session`) is stored in an `httpOnly: true` cookie.
- In production (`NODE_ENV=production`), `secure: true` is enforced by the API.
- Cookie is configured with `SameSite=Lax`:
  - **Recommended Architecture**: Host API on the same parent domain (e.g. Frontend on `yourdomain.com`, API on `api.yourdomain.com`) or use Cloudflare reverse proxy routing `/api/*` to the backend. This ensures the cookie is treated as first-party/same-site.

### 4. Password Reset & Mail

- Password reset emails generate links pointing to `${config.webOrigin}/reset-password?token=...`.
- In production, `MAIL_TRANSPORT=console` is disallowed. A production mail provider (e.g. Resend, Postmark, SendGrid) must be implemented in `api/src/mail/mailer.ts`.

---

## 6. Custom Domain Setup

Once the Cloudflare Pages project is created, connect your custom domain:

### Distinguishing DNS Management

| Scenario                                  | Where DNS is Managed                                                                                   | Actions Required                                                        |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| **Scenario A: DNS on Cloudflare**         | The domain is already active in your Cloudflare account (nameservers point to Cloudflare).             | Cloudflare Pages will automatically configure DNS records with 1 click. |
| **Scenario B: DNS at External Registrar** | Domain is registered at GoDaddy, Namecheap, Google Domains/Squarespace, etc., and DNS is hosted there. | You must manually add a CNAME record at your registrar.                 |

### Steps to Connect Domain in Cloudflare Pages

1. In Cloudflare Dashboard, go to **Workers & Pages** → click on your Pages project.
2. Navigate to the **Custom domains** tab.
3. Click **Set up a custom domain**.
4. Enter your domain or subdomain (e.g., `yourdomain.com` or `www.yourdomain.com`).
5. **If DNS is managed by Cloudflare**:
   - Cloudflare will prompt to activate the domain and automatically insert the required DNS records (`CNAME` pointing to `<project>.pages.dev`).
   - Click **Activate domain**.
6. **If DNS is managed externally**:
   - Cloudflare will display the target hostname, e.g.:
     - **Type**: `CNAME`
     - **Name**: `@` or `www` (or your subdomain)
     - **Target**: `<your-project>.pages.dev`
   - Log in to your DNS provider/registrar and add the specified CNAME record.
   - Return to Cloudflare Pages and click **Check DNS**.
7. **SSL/TLS Certificate**:
   - Cloudflare automatically provisions an SSL/TLS certificate (Universal SSL) once DNS verifies.
   - Status will transition from _Initializing_ → _Active_.

### Verification After DNS Propagation

Check DNS resolution from your terminal:

```bash
dig CNAME yourdomain.com +short
# or
nslookup yourdomain.com
```

Test HTTPS access:

```bash
curl -I https://yourdomain.com
```

Verify that:

- Response status is `200 OK`.
- Header `server: cloudflare` is present.
- Security headers from `_headers` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`) are returned.

---

## 7. Deployment Rollback & Verification Checklist

### Verification Checklist

After Cloudflare Pages finishes the initial deployment:

- [ ] Visit `https://<project>.pages.dev` and your custom domain.
- [ ] Check console: Ensure no JavaScript execution errors.
- [ ] Test SPA routes by refreshing the browser on:
  - `/`
  - `/batches`
  - `/my-learning`
  - `/reset-password`
- [ ] Test unknown route (e.g. `/random-page`): Verify branded `NotFoundPage` displays.
- [ ] Test missing static asset (e.g. `/assets/nonexistent.png`): Verify HTTP 404 is returned (not `index.html`).
- [ ] Interactive Book: Verify pages turn using controls, arrow keys, and click zones.
- [ ] Courses section: If API is not yet connected, verify clean error state with "Retry" button.

### Rollback Strategy

If an issue occurs after deploying to production:

1. In the Cloudflare Dashboard, open the Pages project.
2. Go to the **Deployments** tab.
3. Locate the previous known-good deployment.
4. Click the three dots (`...`) next to that deployment and select **Rollback to this deployment**.
5. Cloudflare Pages immediately points traffic back to that build with zero downtime.
