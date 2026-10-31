# LetEd

SriDha Academy (repository: LetEd): topic-wise online classes, AI test papers and AI model papers.

## What's built

### Homepage

Sections, in order:

1. **Hero** — "Big Subjects. _Broken Into_ Small Victories", a **Find your topic** search (matches topic names and subtopics; an open topic opens its batches) and the interactive book alongside.
2. **Topics to begin with** — one card per topic, with its own search. Open topics show their fee and next start date; hovering a card shows **What we will teach** with its four subtopics. A topic with batches opens its lessons and batches, the others show "Batches opening soon".
3. **AI Test Paper** — a five-question sample test (Accounts, Physics, Maths, Chemistry) with a five-minute timer and a score out of five.
4. **The three paths** — Online Classes, AI Test Paper and AI Model Paper. "Join waitlist" opens the AI model paper waitlist form.
5. **About**, **Team** and a closing call to action.

### Sign-in page

1. **Sign-in or registration form**, with the four **topics running now** beside it (same hover subtopics).
2. **Our model** — "Big Subjects. Broken Into Small Victories." with four cards: Big Subjects, Broken Into, Small Victories and Test Paper.
3. **How SriDha Academy works**, in three chapters, and the footer.

Student counselling is not offered and has been removed from the site and the API.

### Interactive book

- Pages: an intro, one page per topic (title and lessons), a batch spread, then closing chapters on AI tests, AI model papers and getting started.
- **Batch spread:** two facing pages showing up to four batches, two per page. Each batch shows the topic and price, the schedule, the date, time and number of sessions, its availability, and a **Select batch** link.
- **Explore more batches** at the foot of the spread opens `/batches`.
- **Stable layout:** fixed proportions and a static tilt, with no pointer parallax or hover movement. Page turns are locked so rapid clicks can't break the page state.
- **Controls:** previous and next buttons, arrow keys, clicking either half of the book, and swiping on touch screens. Reduced-motion preferences are respected.

### Choosing a batch

1. A student opens a topic or selects a batch, from the topic cards, the book or the batches page.
2. The chosen batch is kept in the URL, so it survives page refreshes and the sign-in redirect.
3. Once signed in, they see **Review your selection**: the topic, the lessons it includes, the schedule and the price.
4. **Reserve seat** creates a real enrolment with status "payment pending". The student can then see it under **My learning**.

Full, closed, inactive and upcoming batches show their status and cannot be selected.

### Pages

Visitors see only the sign-in screens until they log in or create an account.

| Path               | Who                | What                                                          |
| ------------------ | ------------------ | ------------------------------------------------------------- |
| `/login`           | signed-out         | Sign-in page: form, topics running now, our model             |
| `/register`        | signed-out         | Student registration (10th–12th, CA, CS, NEET, JEE, Bank PO)  |
| `/forgot-password` | signed-out         | Request a password-reset email                                |
| `/reset-password`  | anyone with a link | Choose a new password from a reset email                      |
| `/`                | signed-in students | Homepage, topic details and batch selection                   |
| `/batches`         | signed-in students | Every topic batch with full details                           |
| `/my-learning`     | signed-in students | The student's reserved seats                                  |
| `/about`           | signed-in students | Motive, inspiration, how we teach and the tutors              |
| `/ai-test`         | signed-in students | AI test papers: coming soon, with build progress              |
| `/model-paper`     | signed-in students | AI model papers: coming soon, build progress and the waitlist |

Opening any signed-in page while signed out redirects to `/login?redirect_to=…`. After signing in, the student returns to that page, including any chosen topic and batch. Signed-in students who open `/login` or `/register` go straight to the homepage.

### Tests

- **API:** integration tests cover registration, login, sessions, password reset, the catalogue, enrolment rules and the waitlist.
- **Website:** Vitest covers the book, formatters and the selection-through-sign-in flow.
- **Browser:** Playwright runs the full student journey, the book's stability and the sign-in gate in Chrome at desktop and mobile sizes.

## Photo credits

Student photographs are used under [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), which allows commercial use with credit. Each photo shows its credit on the page. The images are cropped and resized from the originals.

| File (`web/src/assets/photos/`) | Original                                                                                                   | Photographer             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| `student-overwhelmed.webp`      | [Is education really a rat race in India?](https://www.flickr.com/photos/47850033@N08/41403332650)         | Nithi clicks             |
| `student-reading.webp`          | [Indian School Boy Reading the Book](https://www.flickr.com/photos/47850033@N08/40717134564)               | Nithi clicks             |
| `students-smiling.webp`         | [Colours of Rural life (School Life in Tamilnadu)](https://www.flickr.com/photos/47850033@N08/47393681652) | Nithi clicks             |
| `student-writing.webp`          | [\_L8V1571](https://www.flickr.com/photos/28032587@N06/10485308324)                                        | KMo Foto                 |
| `students-classroom.webp`       | [Indian children at school](https://www.flickr.com/photos/53620105@N06/6107977919)                         | José Morcillo Valenciano |
| `student-slate.webp`            | [math on slate](https://www.flickr.com/photos/29220600@N08/3448529469)                                     | { pranav }               |

## Structure

| Folder          | What it is                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `api/`          | Node 24 / Express 5 / TypeScript API on PostgreSQL. Auth, sessions, catalogue, checkout and payments, enquiries. |
| `web/`          | Vite / React 19 / TypeScript / CSS Modules website.                                                              |
| `AGENTS.md`     | Codebase rules (pro-web conventions adapted to SriDha Academy).                                                  |
| `DEPLOYMENT.md` | Production deployment guide for Cloudflare Pages and environment configuration.                                  |

## Getting started

```bash
npm install
cp api/.env.example api/.env   # placeholders only, adjust if needed
npm run dev:api                # http://localhost:4000 (in-memory PostgreSQL, seeded on start)
npm run dev:web                # http://localhost:5173 (proxies /api to the API)
```

With no `DATABASE_URL` the API runs PGlite, an in-memory PostgreSQL that starts empty and seeds itself. To use a real PostgreSQL database, set `DATABASE_URL` and run `npm run db:seed` once (it is safe to re-run).

## Scripts (from the repository root)

| Command                   | Does                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `npm run lint`            | ESLint for api and web                                        |
| `npm run typecheck`       | TypeScript for api and web                                    |
| `npm run test`            | API integration tests (node:test) and web tests (Vitest)      |
| `npm run build`           | Builds `api/dist` and `web/dist`                              |
| `npm run test:e2e -w web` | Playwright browser tests in local Chrome (desktop and mobile) |
| `npm run format`          | Prettier                                                      |

GitHub Actions runs lint, typecheck, unit tests, the build and the browser tests on every pull request (`.github/workflows/checks.yml`).

## Learning model

The catalogue is stored as **Subject → Chapter → Topic → Lesson → Batch**, but students only ever see and choose topics; subjects are never shown or sold. The homepage book previews up to four batches (two per page); **Explore more batches** opens `/batches`, which is only available to signed-in students — visitors are sent to sign in first and returned afterwards. Students select a batch of a single topic; each batch lists exactly which lessons it covers. A topic offering is never presented as a complete subject.

## Identity and data model

- `users.id` (UUID, generated by the API) is the canonical identity. It is the only ID the session resolves to.
- `student_profiles` holds the student details collected at registration. There is exactly one per user (`user_id UNIQUE`), created in the same transaction as the user.
- Catalogue entities (`subjects`, `chapters`, `topics`, `lessons`, `batches`) use stable, server-defined text IDs, for example `batch_gst_class_11_november`.
- The 156 topics are listed once, in `api/src/db/topicLibrary.ts` (name, class, lessons, and an icon and rank for featured topics). The seed writes them to the database and the website reads them from `GET /api/catalogue`.
- `enrolments` link `user_id` → `batch_id`, with `UNIQUE(user_id, batch_id)` and status `PENDING_PAYMENT | CONFIRMED | CANCELLED`.
- `pre_registrations` hold a student's paid place on a topic without batches yet. `payments` record each Razorpay order (`CREATED | PAID`) against one enrolment or pre-registration; card and UPI details never reach the API.
- An unpaid enrolment holds its seat for 30 minutes; after that it stops counting against the batch, and the student can still finish paying from My learning.
- `enquiries` store AI model paper waitlist sign-ups (type `MODEL_PAPER_WAITLIST`). They link to `user_id` when the visitor is signed in.
- Batch availability (`OPEN | FULL | CLOSED | UPCOMING | INACTIVE`) is computed on the server from the stored status, the start date and the live seat count.

## Authentication

- Email and password, hashed with scrypt.
- Sessions are opaque random tokens in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only the token's SHA-256 is stored.
- Session lifetime is `SESSION_TTL_DAYS`, or `SESSION_REMEMBER_TTL_DAYS` with "Keep me signed in".
- An expired or revoked session answers `401 SESSION_EXPIRED`. The website then clears local state and tells the student.
- State-changing requests from other origins are rejected (`ORIGIN_NOT_ALLOWED`).
- Password reset uses single-use tokens that expire after 1 hour. A reset signs the account out everywhere.

## API

All errors use `{ message, code, details }`.

| Method | Path                               | Auth    | Purpose                                           |
| ------ | ---------------------------------- | ------- | ------------------------------------------------- |
| GET    | `/api/health`                      | –       | Health check                                      |
| POST   | `/api/auth/register`               | –       | Create account and student profile, start session |
| POST   | `/api/auth/login`                  | –       | Start session                                     |
| POST   | `/api/auth/logout`                 | –       | End session                                       |
| GET    | `/api/auth/session`                | session | Current user (session restore)                    |
| POST   | `/api/auth/password-reset`         | –       | Email a reset link (always 202)                   |
| POST   | `/api/auth/password-reset/confirm` | –       | Set a new password with a reset token             |
| GET    | `/api/catalogue`                   | –       | Public catalogue tree with live availability      |
| GET    | `/api/enrolments`                  | session | The signed-in student's enrolments                |
| GET    | `/api/pre-registrations`           | session | The signed-in student's pre-registrations         |
| POST   | `/api/payments/checkout`           | session | Start a seat or pre-registration and its order    |
| POST   | `/api/payments/verify`             | session | Confirm a payment from Razorpay's signature       |
| POST   | `/api/payments/webhook`            | –       | Razorpay confirms captured payments (signed)      |
| GET    | `/api/admin/orders`                | admin   | Every order, for the team                         |
| POST   | `/api/enquiries`                   | –       | Join the AI model paper waitlist                  |

Request and response shapes are defined once in `api/src/contracts` and shared with the website. Every response carries an `X-Request-Id` header that matches the API's log lines.

## Environment

See `api/.env.example` and `web/.env.example`.

| Variable                                           | Required   | Notes                                                                                    |
| -------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `NODE_ENV`                                         | yes        | `production` enables secure cookies and stricter checks                                  |
| `PORT`                                             | no         | Default 4000                                                                             |
| `DATABASE_URL`                                     | production | PostgreSQL connection string. Unset: in-memory PGlite                                    |
| `WEB_ORIGIN`                                       | production | Public site origin, e.g. `https://letaed.com`. Used for the origin check and reset links |
| `SESSION_TTL_DAYS` / `SESSION_REMEMBER_TTL_DAYS`   | no         | Defaults 1 / 30                                                                          |
| `MAIL_TRANSPORT` / `RESEND_API_KEY` / `EMAIL_FROM` | for emails | `resend` sends password resets, admin sign-in links and payment confirmations            |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`          | production | Without them (development only) checkout runs in test mode                               |
| `RAZORPAY_WEBHOOK_SECRET`                          | production | Secret of the webhook for `/api/payments/webhook`                                        |
| `SUPER_ADMIN_EMAILS`                               | no         | Comma-separated team emails; they sign in with an emailed link                           |
| `LOG_LEVEL`                                        | no         | Default `info`                                                                           |
| `SENTRY_DSN` / `VITE_SENTRY_DSN`                   | no         | Error reports for the API / website. Unset: nothing is sent                              |
| `SERVE_WEB_DIST`                                   | no         | `true` serves `web/dist` from the API, so one origin is deployed                         |
| `VITE_API_URL`                                     | no         | Web build only. Default `/api`                                                           |

In production the website is on Cloudflare Pages and the API on Render; see `DEPLOYMENT.md`.

## Not yet built

- **Teacher accounts.** Batches name their instructor as text; teachers do not sign in yet.
- **Real content.** Faculty names and lesson durations are not configured; the site shows "To be announced". Team profiles are placeholders.
- **Email verification.**
- **AI test papers and AI model papers.** The site presents them as planned; only the waitlist is functional.
