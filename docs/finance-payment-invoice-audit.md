# Finance, payment, invoice and enrolment audit

- **Date:** 2026-11-25
- **Branch audited:** `chore/production-readiness` at `b846f4e` (equal to `origin/main`), working tree included
- **Method:** read-only code audit. Four independent auditors covered payments and refunds, invoices and GST, enrolment, and email and admin finance. The author spot-checked every Critical and High claim against the source.
- **Not done:** nothing was executed against production. No new tests were run for this audit. Runtime claims below are from reading code unless marked "verified".

Line numbers are as of the date above and drift as the code changes.

## Status update (2026-11-27)

These audit findings have been fixed on branch `chore/production-readiness`. The changes are uncommitted and not deployed; see `docs/milestone-a-security-payment-integrity.md` and DEC-031 to DEC-035.

| Finding                           | Fix                                                             |
| :-------------------------------- | :-------------------------------------------------------------- |
| G1, account claiming              | Verified sign-up; `/api/auth/register` removed                  |
| G3, checkout race                 | Batch row locked                                                |
| G4, late capture                  | Capacity and batch status checked at capture; payment exception |
| G5, double charges                | Durable payment exceptions with a staff resolution API          |
| G6, finance copy                  | Own template and content                                        |
| G7, email inside payment requests | Outbox worker only; deadlines on Resend and Razorpay calls      |
| G17, mismatched capture           | Unchanged                                                       |

Invoices are never issued while a payment exception is open, and invoicing stays off until the owner and CA approve. The invoicing findings (G2, G9–G12) are unchanged and belong to Milestone B.

## 0. Answers in brief

| Question                                            | Answer                                                                                                                                                                                                                                                                                                                                                                                  |
| :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What invoice functionality exists?                  | A complete but **dormant** GST invoicing back end: quotes, a GST calculator, gapless per-year numbering, immutable invoices and tax snapshots, an hourly issuing job and a tax-approval gate. There is **no PDF, no student download, no invoice email, no credit note and no invoice list** for staff.                                                                                 |
| What happens right after Razorpay confirms payment? | In one transaction: the event is stored once, the payment row is locked, then marked `PAID`, the seat set to `CONFIRMED`, and the confirmation emails queued in the outbox. After commit, the outbox batch is sent inline. No invoice, ledger entry or audit row is written at capture.                                                                                                 |
| Is the student enrolled automatically?              | **Yes.** The batch is fixed when the order is created and confirmed on capture. A browser callback alone never confirms a seat.                                                                                                                                                                                                                                                         |
| Are invoices generated and emailed automatically?   | **No.** Checkout never collects GST (`tax_status` is never `QUOTED`), and the issuing job refuses any other payment. So **no real payment can be invoiced today**, even with invoicing switched on. There is no PDF and no invoice email.                                                                                                                                               |
| What is broken or incomplete?                       | See §6. In short: account takeover by claiming a guest purchase, seat overselling under concurrency and on late capture, unseen double charges, the finance copy sent as a student email, emails sent inside payment requests, refunds not affecting seats, and the invoicing gaps above.                                                                                               |
| What can be reused?                                 | Almost everything on the money path: order creation, signature checks, the webhook, the lifecycle state machine, idempotency, refunds and their reconciliation, the outbox, the GST calculator, numbering, snapshots and reports. The new work is presentation and delivery (PDF, download, email attachment, admin views), wiring GST into checkout once decided, and the fixes in §6. |

## 1. Existing implementation

### 1.1 Payments (Razorpay)

**Order creation** (`api/src/modules/payments/payments.service.ts:429-485`, route `POST /api/payments/checkout`, no account needed):

- The amount comes from the catalogue (`topics.price_paise`, through the batch), and the currency is `INR`.
- The request schema is strict, so a client-sent amount is a 400.
- A password-less buyer row is created or reused from the billing email.
- A 30-minute seat hold is created as a `PENDING_PAYMENT` enrolment.
- A Razorpay order is created with `receipt = paymentId`.
- The `payments` row stores ids, amount, currency, billing snapshot, item snapshot (`item_topic_id`, `item_batch_id`, `item_description`, `unit_price_paise`) and `tax_status = PENDING_CONFIGURATION`.

**Verify** (`POST /api/payments/verify`, `payments.service.ts:500-573`):

- The order id must match the stored one.
- The HMAC is checked in constant time (`gateway.ts:312-321`). A valid signature gives `AUTHORIZED` only.
- The server then fetches the payment from Razorpay, and only a remote `captured` with a matching amount and currency gives `PAID`.

**Webhook** (`payments.webhook.ts`, mounted with `express.raw` before JSON parsing in `app/app.ts:109-114`):

- An HMAC over the raw body, compared in constant time. Returns 503 without a secret; production refuses to start without one.
- Each event is stored once: `UNIQUE (provider, event_id)`, keyed by `x-razorpay-event-id` or a body hash.
- It handles payment, refund and dispute events.

**Source of truth for success:** only the capture transition, from a signed `payment.captured` or `order.paid` webhook, or from the server's own Razorpay fetch (verify, or the expiry job). Verified in code.

**State machine:**

- `CREATED`, `AUTHORIZED`, `PAID`, `FAILED`, `EXPIRED`. Transitions are in `payments.lifecycle.ts:463-476`.
- The database freezes a `PAID` row: amount, status and ids cannot change and it cannot be deleted (`migrations.ts:1276-1304`).
- There is no `REFUNDED` status. Refunds live in `payment_refunds`.

### 1.2 Enrolment

- **Hierarchy:** subjects, then chapters, then topics, then batches. A batch is the unit bought when a topic has batches; otherwise the buyer pre-registers for the topic.
- **Class** is `topics.level` (for example "Class 11"). **Stream exists only on `student_profiles`, which guest buyers do not have.**
- There is no batch access period or end date.
- **Tables:**
  - `enrolments` has `UNIQUE (user_id, batch_id)`; `pre_registrations` has `UNIQUE (user_id, topic_id)`.
  - Statuses are `PENDING_PAYMENT`, `CONFIRMED` and `CANCELLED`. `CANCELLED` is never written.
- **Linkage:** the payment points at the seat (`payments.enrolment_id` or `pre_registration_id`, exactly one).
- **The batch cannot change after payment.** Verified: verify takes no batch input.

### 1.3 Invoices and GST

- **Tables:** `tax_quotes`, `tax_configuration_approvals`, `invoice_sequences`, `invoices` (one per payment, `UNIQUE payment_id`), `payment_tax_snapshots`, `invoice_issuance_attempts`. All created in migrations 017–021.
- **Database triggers:**
  - Invoices and snapshots are immutable.
  - The sequence starts at 1 and moves forward by one.
  - The number must match the allocated sequence.
  - An invoice needs a snapshot.
  - A snapshot must match a `PAID`, `QUOTED` payment.
  - Finance tables refuse TRUNCATE.
- **Numbering:** `INV/<YY-YY>/<6 digits>`, for example `INV/26-27/000001`. The format is enforced by the trigger in `migrations.ts:1046-1064` and `invoices.repository.ts:94-101`.
  - The financial year is the Indian (IST) April–March year, taken from the **issue** date.
  - Numbers are gapless: allocated under a row lock and returned on rollback. Real-PostgreSQL concurrency tests exist.
- **GST:**
  - SAC `999293` and 18% (1800 bp) are fixed in `gst/gst.config.ts`.
  - Pricing is exclusive. Rounding is half-up per component in BigInt paise.
  - Rajasthan (`08`) to Rajasthan gives CGST+SGST; anything else gives IGST.
  - Database checks enforce `taxable + GST = total`.
  - The rounding policy is labelled `PROPOSED_PENDING_CA_APPROVAL`.
- **Supplier** (`gst/gst.config.ts:6-15`):
  - Legal name `LETATEC AI TECHNOLOGIES PRIVATE LIMITED`, GSTIN `08AAGCL9166P1ZL`, Rajasthan `08`.
  - Address "LG32, Jaipur Electronics Market, Ridhi Sidhi Chowraha, Shyam Nagar, Jaipur, Rajasthan – 302019".
  - Effective 2026-07-01. **No CIN.**
- **Issuing:**
  - An hourly job, `reconcileMissingInvoices` (`jobs/finance.ts`), handles 50 payments per run.
  - It runs only when `INVOICING_ENABLED=true` **and** the latest tax approval for the exact configuration is `APPROVED` and effective.
  - It is deliberately not done at capture (DEC-021).
- **PDF:** none. No library, template or stored document.
- **Access:** staff only. `GET /api/finance/invoices/:paymentId` returns JSON and needs the `viewFinanceReports` permission. Students have no invoice endpoint.
- **Credit notes:** none.

### 1.4 Email

- **Mailer** (`api/src/mail/mailer.ts`):
  - Resend, HTML only, `Idempotency-Key` on payment confirmations.
  - No attachments and no fetch timeout.
  - The layout is a plain `<h2>` heading with a blue button. There is no logo, and the email does not use the student's name.
- **Payment confirmation:**
  - Subject `Payment received: <topic>`.
  - Contains the amount, topic, batch, payment reference and a "See more topics" link.
  - **No student name, no dashboard link, no invoice.**
- **Outbox** (`modules/outbox`, migration 016):
  - Rows are queued in the capture transaction, with idempotency keys `payment_confirmation:<id>:customer` and `…:finance:<email>`.
  - A worker runs every 15 s, takes 20 rows, makes up to 5 attempts, and claims with `FOR UPDATE SKIP LOCKED` plus a claim token.
  - A stale claim is reclaimed after 5 minutes.
  - Terminal states are `FAILED` and `UNCONFIRMED`.
  - Rows wait while no mailer is configured.
  - **The outbox is also run inline** inside verify and webhook requests (`payments.service.ts:579-590`).

### 1.5 Admin finance

- **Roles:** `SUPER_ADMIN`, `FINANCE_ADMIN`, `OPERATIONS_ADMIN` and `STUDENT`, assigned from environment email lists.
- **Permissions** (`auth/permissions.ts`):

  | Permission                                            | Roles                                           |
  | :---------------------------------------------------- | :---------------------------------------------- |
  | `viewPayments`, `manageRefunds`, `viewFinanceReports` | super and finance admins                        |
  | `viewAuditLog`, `manageTaxConfiguration`              | super admin only                                |
  | anything                                              | not `OPERATIONS_ADMIN`, which has no permission |

  They are enforced server-side on every request.

- **What exists:**
  - The team orders page: newest 500 orders.
  - A historical payments report in JSON and CSV, counting only `PAID` as collected, net of processed refunds, excluding test payments.
  - The refunds desk: list, detail, summary figures and exception resolution in the UI. Starting a refund and running reconciliation are API-only.
  - The audit log and tax approvals: API only.
- **What is missing:**
  - Counts by status.
  - Today's and monthly collections.
  - A date range (`until`), or reporting by paid date.
  - Invoice list, PDF and resend.
  - Revenue by batch.
  - One student's financial history.
  - Payment and settlement reconciliation against Razorpay.

### 1.6 Refunds

- **Starting a refund:** `POST /api/finance/payments/:paymentId/refunds` (`manageRefunds`). Full and partial refunds are supported, as is a request key.
- **How a refund is recorded:**
  - A `PENDING` row is written before the Razorpay call, with `X-Refund-Idempotency`.
  - It is `PROCESSED` **only** on Razorpay's own validated evidence. Submission alone never marks it processed.
- **Guards:**
  - The total of pending and processed refunds is capped by a database trigger.
  - Refund status only moves forward.
- **Reconciliation:** an hourly reconciliation job, and an exception desk that re-fetches the refund from Razorpay before resolving it.
- **Audit log:** append-only.
- **Scope:** refunds do **not** change the seat, and no credit note is issued.

## 2. Relevant file paths

| Area                | Files                                                                                                                                                                                                            |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payments            | `api/src/modules/payments/{payments.routes,payments.service,payments.lifecycle,payments.webhook,payments.repository,gateway,payments.expiry,payments.refunds,payments.refunds.reconciliation,refundEvidence}.ts` |
| Enrolment           | `api/src/modules/enrolments/*`, `api/src/modules/catalogue/catalogue.repository.ts`, `api/src/db/{topicLibrary,catalogueSeed,sessionOneRoster}.ts`                                                               |
| Invoices and GST    | `api/src/modules/finance/{gst,invoices,quotes,tax}/*`, `api/src/modules/finance/gstin.ts`, `api/src/jobs/finance.ts`                                                                                             |
| Finance admin       | `api/src/modules/finance/{finance.routes,reports.service,reports.repository,refundsDesk.service,audit.service}.ts`, `api/src/modules/admin/*`, `api/src/modules/auth/{roles,permissions}.ts`                     |
| Email               | `api/src/mail/mailer.ts`, `api/src/modules/outbox/*`, `api/src/jobs/outbox.ts`                                                                                                                                   |
| Web                 | `web/src/pages/checkout/CheckoutPage.tsx`, `web/src/pages/team-orders/TeamOrdersPage.tsx`, `web/src/pages/refunds/RefundsPage.tsx`, `web/src/services/finance/*`, `web/src/constants/payments.ts`                |
| Schema              | `api/src/db/migrations.ts` (001–027)                                                                                                                                                                             |
| Earlier design docs | `docs/finance-platform-architecture.md`, `docs/FINANCE_PLATFORM_PROGRESS.md`, `DECISION.md` (DEC-021 and later)                                                                                                  |

## 3. Tables and relationships

```
users ─┬─< enrolments >── batches >── topics >── chapters >── subjects
       └─< pre_registrations >── topics
payments ── enrolment_id | pre_registration_id (exactly one), user_id
payments ─< payment_events            (UNIQUE provider, event_id)
payments ─< payment_refunds           (cap trigger, forward-only status)
payments ─< payment_disputes
payments ── tax_quote_id ── tax_quotes
payments ─1 invoices ─1 payment_tax_snapshots
invoice_sequences (per fiscal year, forward-only)
tax_configuration_approvals (append-only, not backdated)
email_outbox (UNIQUE idempotency_key)
finance_audit_log (append-only)
```

## 4. API endpoints (money path)

| Method and path                                 | Auth                     | Purpose                                         |
| :---------------------------------------------- | :----------------------- | :---------------------------------------------- |
| `POST /api/payments/checkout`                   | none (rate-limited)      | Create a seat hold and a Razorpay order         |
| `POST /api/payments/verify`                     | none                     | Browser signature, then a server fetch          |
| `POST /api/payments/webhook`                    | Razorpay HMAC            | Payment, refund and dispute events              |
| `GET /api/admin/orders`                         | `viewPayments`           | Newest 500 orders                               |
| `GET /api/finance/reports/historical-payments`  | `viewFinanceReports`     | JSON or CSV report (each CSV export is audited) |
| `GET /api/finance/invoices/:paymentId`          | `viewFinanceReports`     | Invoice and snapshot as JSON                    |
| `POST /api/finance/payments/:paymentId/refunds` | `manageRefunds`          | Start a refund                                  |
| `POST /api/finance/refunds/reconcile`           | `manageRefunds`          | Poll pending refunds                            |
| `GET/POST /api/finance/refunds…`                | `manageRefunds`          | Refunds desk                                    |
| `POST /api/finance/tax-approvals`               | `manageTaxConfiguration` | Record a CA approval                            |
| `GET /api/finance/audit-log`                    | `viewAuditLog`           | Audit log                                       |

## 5. Security controls already in place

- **Payment trust:**
  - The amount comes from the server.
  - Request schemas are strict.
  - Signatures are compared in constant time.
  - The webhook signature is checked over the raw body.
  - `PAID` comes only from Razorpay evidence.
- **Idempotency:**
  - Webhook events are stored once.
  - Payments are locked (`FOR UPDATE`) during lifecycle changes.
- **Database guards:**
  - Paid payments are frozen by trigger.
  - Refunds are capped and only move forward.
  - Finance tables are immutable and refuse TRUNCATE.
  - Invoice numbers are gapless and immutable.
- **Access control:**
  - Permissions are checked server-side from the database role on every request.
  - The audit log is append-only.
  - CSV exports are protected against spreadsheet formulas and audited.
- **Production configuration:** production refuses to start without the Razorpay keys and the webhook secret.

## 6. Gaps and defects

Severity is the auditors' rating after the author's check. "Verified" means confirmed by reading the cited code.

| #   | Severity     | Finding                                                                                                                                                                                                                                                                                          | Evidence                                                                                  |
| :-- | :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| G1  | **Critical** | **Account takeover by claiming a guest purchase.** Anyone who knows a buyer's email can call `POST /api/auth/sign-up`, set a password, get a session and see that buyer's purchases. A later guest purchase by the real owner lands in the attacker's account. No email verification (verified). | `auth.service.ts:219-259`, test `signUp.test.ts:76-104` asserts this behaviour            |
| G2  | **High**     | **No real payment can be invoiced.** Checkout never sets `tax_status='QUOTED'`, and issuing refuses anything else (verified).                                                                                                                                                                    | `quotes.service.ts:169-170`, `invoices.service.ts:279`                                    |
| G3  | **High**     | **Last seat oversold under concurrent checkouts** on PostgreSQL: count, then insert, under READ COMMITTED, with no lock on the batch row (code verified; race not yet reproduced).                                                                                                               | `db/client.ts:101`, `enrolments.service.ts:89-123`                                        |
| G4  | **High**     | **A late capture confirms with no capacity check.** The hold is 30 min but capture is allowed for 96 h, so the batch can be overbooked.                                                                                                                                                          | `payments.lifecycle.ts:566-585`, `catalogue.repository.ts:76-83`, `payments.expiry.ts:15` |
| G5  | **High**     | **Double charges are only logged.** A second capture for an already-confirmed seat produces `CAPTURED_FOR_CONFIRMED_SEAT` and a log line, with no refund, exception or staff view (verified).                                                                                                    | `payments.lifecycle.ts:587-593`                                                           |
| G6  | **High**     | **The finance copy is sent as a student email.** The stored `[Finance Copy]` subject is never used; the mailer builds the student subject (verified).                                                                                                                                            | `outbox.service.ts:111,190`, `mailer.ts:164`                                              |
| G7  | **High**     | **The outbox runs inside verify and webhook requests, with no Resend timeout.** A slow provider delays checkout and risks Razorpay webhook timeouts.                                                                                                                                             | `payments.service.ts:579-590`, `mailer.ts:112`                                            |
| G8  | Medium       | **Refunded or disputed students stay `CONFIRMED`** and keep counting toward capacity. Policy decision needed.                                                                                                                                                                                    | refund and dispute code paths                                                             |
| G9  | Medium       | **No PDF, student download, invoice email, invoice list or resend.**                                                                                                                                                                                                                             | §1.3                                                                                      |
| G10 | Medium       | **No credit notes.** A fully refunded payment can still be invoiced, and nothing reverses the invoice.                                                                                                                                                                                           | `invoices.repository.ts:154-165`                                                          |
| G11 | Medium       | **Snapshots lack an item description, quantity, reverse-charge flag and signatory**, so a complete Rule 46 invoice cannot be rendered from them alone.                                                                                                                                           | `migrations.ts:758-799`                                                                   |
| G12 | Medium       | **The invoice financial year follows the issue date, not the time of supply.**                                                                                                                                                                                                                   | `invoices.service.ts:336,348`                                                             |
| G13 | Medium       | **The team orders "Collected" figure** includes test payments, ignores refunds and is limited to the newest 500 orders.                                                                                                                                                                          | `TeamOrdersPage.tsx:96-101`                                                               |
| G14 | Medium       | **Reports select by checkout-start date and have no end date.**                                                                                                                                                                                                                                  | `reports.repository.ts:91`                                                                |
| G15 | Medium       | **Seat-hold abuse.** Unauthenticated checkouts with throwaway emails hold seats; only a per-IP limit applies.                                                                                                                                                                                    | `payments.routes.ts:48`, `app.ts:219`                                                     |
| G16 | Medium       | **Re-seeding can renumber batch ids** (positional `b1, b2…`) and change paid batches.                                                                                                                                                                                                            | `sessionOneRoster.ts:248-256`, `catalogueSeed.ts:491-500`                                 |
| G17 | Low          | **A mismatched capture stays `CREATED`** with no finance record.                                                                                                                                                                                                                                 | `payments.lifecycle.ts:689-697`, `payments.expiry.ts:50-68`                               |
| G18 | Low          | **Concurrent first checkouts** for one email and batch return a 500, not a 409.                                                                                                                                                                                                                  | `payments.service.ts:316`                                                                 |
| G19 | Low          | **Email text is not HTML-escaped.** Catalogue text only today.                                                                                                                                                                                                                                   | `mailer.ts:30-31,70`                                                                      |
| G20 | Low          | **Undocumented and unused settings:** `FINANCE_NOTIFICATION_EMAILS` and the other role email lists are not in `docs/environment-variables.md`; `OPERATIONS_ADMIN` has no permissions.                                                                                                            | `permissions.ts`, env docs                                                                |

## 7. Duplicate functionality to avoid

- **Keep:** the GST calculator, quotes, invoice numbering, snapshots, the issuing job and the tax-approval gate. Do **not** add a second invoice table, series or calculator. Add presentation and delivery around `invoices` and `payment_tax_snapshots`.
- **Keep:** the outbox for any new email, such as the invoice email. Do not add fire-and-forget sends on the money path.
- **Keep:** `payment_refunds`, the refunds desk and refund reconciliation. Credit notes should hang off `payment_refunds` and `invoices`, not form a new refund system.
- **Keep:** `payments.lifecycle.ts` as the only place payment state changes. Enrolment activation already happens there.
- **Keep:** the historical report as the source for collections figures. New admin views should reuse its rules (`PAID` only, processed refunds deducted, test payments excluded) rather than recompute differently.

## 8. Recommended architecture (minimal change)

1. **Keep issuing out of the capture transaction** (DEC-021). After the issuing job inserts an invoice, queue an `invoice_issued` outbox row in the same transaction, with key `invoice:<invoiceId>:customer`.
2. **PDF:** render on demand from the immutable invoice and snapshot rows, with a pure-JavaScript renderer (for example `pdfkit`, one new dependency, owner decision O4). Do not store the PDF: rendering is deterministic, so a download and the email attachment come out identical. Record a SHA-256 of the first rendering if the CA wants document integrity evidence.
3. **Mailer:** add an `attachments` field. The outbox dispatches by template. Use the stored subject for finance copies (fixes G6). Add a fetch timeout and stop running the outbox inline in requests (fixes G7).
4. **Student download:** `GET /api/me/invoices/:invoiceId.pdf`, scoped by `req.auth.userId` through `payments.user_id`, returning 404 for anyone else's invoice. G1 must be fixed first, or this exposes invoices to anyone who claims an account.
5. **Admin:** invoice list and resend (which re-queues the outbox with a new key, same invoice); a status and period summary with `from`/`until` and paid-date basis; revenue by batch; and one student's history. All are read-only queries in `reports.repository.ts`.
6. **Checkout GST:** wire `createTaxQuote`/`redeemTaxQuote` into checkout **only after** the CA confirms the treatment and the owner decides whether prices become GST-exclusive (the price rises by 18%) or GST-inclusive (needs `INCLUSIVE` support, which is refused today).
7. **Fixes:**
   - G3 and G4: lock the batch row (`FOR UPDATE`) in checkout, and re-check capacity at capture, flagging rather than silently overbooking.
   - G5 and G17: record finance exceptions visible on the refunds desk.
   - G1: verify the email (reuse the 6-digit code mechanism) before claiming an account that has purchases.

## 9. Migration requirements (expected; none written yet)

All append-only, with the undo written alongside, and safe on populated data.

- **Only if the owner and CA choose a different invoice series** (for example `LETA/2026-27/NNNNN`): a new migration replacing `invoice_number_matches_sequence()` and the code format, plus a controlled way to start a year's counter above 1. The trigger currently requires a new year to start at 1. Applied migrations are never edited.
- Snapshot additions for G11 (item description, quantity, SAC per line, reverse charge), added as nullable columns because snapshots are immutable and existing rows must stay valid.
- `credit_notes` (and probably its own sequence) linked to `invoices` and `payment_refunds`, once the CA defines the procedure.
- A finance exceptions table, or reuse of `finance_audit_log` entries, for G5 and G17.
- The outbox needs no schema change: `template` is free text and `payload` is JSONB.

## 10. Risks, dependencies and decisions needed

**Owner or CA decisions. Invoicing must not be enabled until these are answered:**

1. **GST treatment:** SAC `999293` at 18% is in code as "CA-provided". The CA should confirm it for these online coaching services and B2C sales, including any exemption.
2. **Price:** charge 18% on top of the current Rs 129, or treat Rs 129 as GST-inclusive.
3. **Invoice series:**
   - The code enforces `INV/26-27/000001`, but an invoice `LETA/2026-27/00002` has already been issued outside the system.
   - Which series continues? Can two series run side by side?
   - `LETA/2026-27/00002` is 18 characters, and the code applies a 16-character limit (Rule 46(b)).
4. **Supplier address:** the code says "…Ridhi Sidhi Chowraha, **Shyam Nagar**, Jaipur – 302019", while the owner's brief says "…Riddhi Siddhi Chauraha, **Gopalpura Bypass**, Jaipur". Confirm against the GST registration certificate (REG-06). CIN `U62010RJ2026PTC114803` is not stored anywhere; confirm it should be printed.
5. **Payments since 1 July 2026:** whether they need invoices, and how (decision C1). The issuing job deliberately never backfills them.
6. **Credit-note procedure**, and whether a refund should cancel the seat (G8).
7. **Account claim (G1):** require email verification before a guest purchase can be claimed. This changes the sign-up experience.
8. **Logo:** `/mnt/data/SriDha_Academy_Logo(2).png` does not exist on this machine. Several candidates are in `~/Downloads` and `~/Desktop`, so the owner should name the exact file.
9. **Support contact details** for the invoice footer, if any are verified.

**Technical dependencies:** one PDF dependency (owner decision O4); real-PostgreSQL tests for G3, G4 and numbering; staging Razorpay test keys for end-to-end payment checks (no live credentials).
