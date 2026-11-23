# SriDha Academy — Finance, Billing and Business Intelligence Platform

**Phase 0: architecture and implementation plan, revision 2.** Status: _architecture direction approved by the owner; implementation not approved_. Nothing in this document has been implemented. No schema, code, dependency or configuration has changed.

- Repository: `SriDha-integration`, branch `feat/finance-platform`, created from `origin/main` at `ce0dcaf` (2026-11-14).
- Revision 2 incorporates the owner's review: one legal supplier identity, GST strictly configuration-driven, B2C and B2B billing, a separate historical-transactions report for the CA, the owner's phase order, and an explicit split between what may be built now and what stays disabled until tax configuration is approved.

### Project boundary

This platform is exclusively part of the SriDha Academy application (this repository, its API and its PostgreSQL database). LETATEC AI TECHNOLOGIES PRIVATE LIMITED is the **legal supplier** for SriDha's sales, but LETATEC's separate GST/legal AI product is a different system: its architecture, database, authentication, code and financial records are not imported, reused, connected to or modified. The only thing shared is the supplier's legal identity, entered here as configuration.

---

## 1. Confirmed business facts

Confirmed by the owner. The system relies on these; any change to them is an owner decision recorded in `DECISION.md`.

| #   | Fact                                                                                                                                                                                                                            |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | The legal supplier is **LETATEC AI TECHNOLOGIES PRIVATE LIMITED**, GSTIN 08AAGCL9166P1ZL, registration type Regular, principal place of business in Jaipur, **Rajasthan** (PIN 302019). Registration effective **1 July 2026**. |
| F2  | **SriDha Academy is the customer-facing brand**, operating under that same registration. It is **not** a separate GST-registered entity and has no GST identity of its own. The certificate's trade-name field is blank.        |
| F3  | Every invoice and credit note names LETATEC AI TECHNOLOGIES PRIVATE LIMITED as the supplier. SriDha Academy branding appears on documents only where legally appropriate (how is a CA decision, C6).                            |
| F4  | **Course prices exclude GST.** GST is calculated separately and added to the base price. This policy stays until the owner explicitly changes it.                                                                               |
| F5  | Customers must receive their invoice automatically after a successful payment.                                                                                                                                                  |
| F6  | Both B2C (individual) and B2B (business) customers are supported.                                                                                                                                                               |
| F7  | Monthly GST reporting and CA-ready records are required.                                                                                                                                                                        |
| F8  | The GST registration certificate is confidential: it is never committed, stored by this system or exposed through any endpoint. Supplier details are entered as configuration by a super admin.                                 |

## 2. CA decisions pending

None of these are guessed, defaulted or hardcoded anywhere. Each one gates something specific (section 5).

| #   | Decision needed from the CA                                                                                                                                                                              |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Treatment of payments received since 1 July 2026** (no GST charged, no invoices issued). The system will produce the historical report (section 6) and do nothing else with those payments until told. |
| C2  | Applicable **GST rate** for each kind of sale (topic enrolment, pre-registration).                                                                                                                       |
| C3  | **SAC classification** for each kind of sale.                                                                                                                                                            |
| C4  | Whether any **exemption or non-taxable** treatment applies.                                                                                                                                              |
| C5  | **Place-of-supply** treatment for B2C and for B2B, and therefore when CGST + SGST versus IGST applies.                                                                                                   |
| C6  | **Mandatory particulars and format** of invoices and credit notes, including document titles, signature or authentication, and how the SriDha Academy brand may appear beside the legal supplier.        |
| C7  | **Invoice and credit-note numbering**: series format and length, financial-year reset (the proposed `SDA/2026-27/000001` is a placeholder until confirmed).                                              |
| C8  | **Rounding policy** (section 9.3 proposal) and whether totals are rounded to the rupee.                                                                                                                  |
| C9  | When a **B2C billing address and PIN** are mandatory (always, or above a threshold).                                                                                                                     |

## 3. Owner decisions pending

| #   | Decision                                                                                                                                                                                                                                                                                                       |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | What checkout charges **until** tax configuration is approved. Proposed: unchanged (the catalogue price), each sale marked "tax treatment pending", no tax invoice. After approval: price + GST.                                                                                                               |
| O2  | Internal notification recipients (finance, operations).                                                                                                                                                                                                                                                        |
| O3  | Razorpay account settings: auto-capture and capture timeout; webhook events enabled (`payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`, `payment.dispute.*`); webhook secret; API key access for settlements and reconciliation. |
| O4  | Approval of the one proposed dependency, `pdfkit`, for PDF documents (section 14).                                                                                                                                                                                                                             |
| O5  | Who holds FINANCE_ADMIN and OPERATIONS_ADMIN.                                                                                                                                                                                                                                                                  |
| O6  | Analytics consent approach (cookie-less first-party visit and topic-view counts; whether consent is required before recording).                                                                                                                                                                                |
| O7  | Optional: a GSTIN verification provider. Not required: invoices never depend on it (section 9.5).                                                                                                                                                                                                              |
| O8  | Retention policy for billing personal data (statutory financial records excepted).                                                                                                                                                                                                                             |

---

## 4. Technical decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                    | Why / trade-off                                                                                     |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| T1  | **One API, one database.** A `finance` module family inside `api/src/modules/` and a lazy-loaded `/finance` area in the website, following the existing layering (routes → service → repository) and `api/src/contracts`.                                                                                                   | No second backend; reuses auth, logging, migrations, tests.                                         |
| T2  | **One supplier identity.** A single `supplier_identity` record, versioned for changes (for example a new address), holding the legal entity's details and a separate `display_brand` ("SriDha Academy") whose use on documents is governed by C6. There is no table, field or flow that could create a second GST identity. | Matches F1–F3; brand and legal identity can never be confused.                                      |
| T3  | **Money is integer paise; rates are integer basis points** (1 bp = 0.01%). All percentage maths in one pure module (`finance/tax.ts`) using `BigInt` and an explicit rounding function. No floating point in any authoritative calculation.                                                                                 | Exact to the paisa; no decimal library needed.                                                      |
| T4  | **Tax is configuration, separate from catalogue prices.** `tax_rules` are effective-dated and need an approval record (who, when, note) before they can apply. Catalogue prices stay GST-exclusive base prices.                                                                                                             | Meets F4 and C2–C5; changes are traceable.                                                          |
| T5  | **Tax is quoted once, at checkout,** from the approved rule effective at that moment and the place of supply; the quote is stored on the payment and the Razorpay order is created for the quoted total. The invoice copies the quote.                                                                                      | What was charged always equals what is invoiced.                                                    |
| T6  | **Seat confirmed on capture, not on signature.** The browser signature marks a payment `AUTHORIZED`; it becomes captured (the existing `PAID` value) only on provider confirmation (payment fetch, or a `payment.captured` / `order.paid` webhook).                                                                         | "Verify capture before treating as paid"; default auto-capture keeps this immediate in practice.    |
| T7  | **Invoice allocated in the capture transaction; PDF and email through an outbox.** Number, snapshot and lines are written with the capture; rendering and delivery retry independently.                                                                                                                                     | Exactly one invoice per sale; an email failure never rolls back a payment or duplicates an invoice. |
| T8  | **Append-only records.** Issued invoices, credit notes and audit rows are immutable at the database level (triggers). Payment history is an event log; corrections are credit/debit notes.                                                                                                                                  | Statutory auditability.                                                                             |
| T9  | **Reports read snapshots only** (payment quote and billing snapshot, invoice snapshot), never the live catalogue. `TEST`-provider rows are excluded from every business figure by construction.                                                                                                                             | History cannot change when a topic is renamed or repriced.                                          |
| T10 | **Indian Standard Time** for invoice dates, financial years (1 April – 31 March), filters and period comparisons, computed on the server.                                                                                                                                                                                   | No UTC-midnight misdating.                                                                          |
| T11 | **Staff roles follow the existing pattern** (`FINANCE_ADMIN_EMAILS`, `OPERATIONS_ADMIN_EMAILS` beside `SUPER_ADMIN_EMAILS`), checked per endpoint on the server; role changes audited.                                                                                                                                      | Consistent with today's super-admin model.                                                          |
| T12 | **Customer identity:** a person is the normalised billing email (existing `users` row); a business is its GSTIN on the billing snapshot. Phone numbers never merge identities.                                                                                                                                              | Fits guest checkout on main.                                                                        |
| T13 | **Funnel lower stages from authoritative tables** (enquiries, payments, invoices); only visits and topic views are newly measured. Unmeasured history is shown as "not measured".                                                                                                                                           | No duplicated or fabricated data.                                                                   |
| T14 | **Minimal dependencies.** Charts are in-house SVG; one new package, `pdfkit`, proposed for PDFs (O4).                                                                                                                                                                                                                       | Small maintenance and security surface.                                                             |

---

## 5. What may be built before GST approval, and what stays disabled

### 5.1 Safe to implement and enable before CA approval

These involve no tax determination, or use tax logic only with synthetic rules in tests and non-production environments.

| Capability                                                                                                                                                                     | Enabled in production? |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| Payment integrity: RESTRICT foreign keys, `paid_at`, item snapshot, `TEST` exclusion                                                                                           | Yes                    |
| Webhook event store, idempotency, out-of-order handling, capture verification, failure and expiry states                                                                       | Yes                    |
| Refunds (money movement and records) and disputes                                                                                                                              | Yes                    |
| Staff roles and the append-only finance audit log                                                                                                                              | Yes                    |
| **Historical transactions report for the CA** (section 6)                                                                                                                      | Yes, read-only         |
| B2C and B2B billing capture at checkout, with the billing snapshot stored on each payment                                                                                      | Yes                    |
| GSTIN format, state-code and checksum validation (section 9.5)                                                                                                                 | Yes                    |
| Supplier identity configuration (entered and saved as a draft; approval is part of activation)                                                                                 | Yes, as draft          |
| Tax engine code and its tests, using synthetic rules only                                                                                                                      | Code only              |
| Invoice and credit-note pipeline (numbering, snapshot, PDF, outbox) exercised in tests and staging with synthetic configuration and a "SPECIMEN — NOT A TAX INVOICE" watermark | Code only              |
| Payment confirmation emails (non-tax) through the outbox                                                                                                                       | Yes                    |
| Collections dashboard (amounts collected, payments by status, refunds, customers, products), clearly labelled as collections, not tax figures                                  | Yes                    |
| Razorpay reconciliation (payments, refunds, fees, settlements)                                                                                                                 | Yes                    |
| Customer purchase history                                                                                                                                                      | Yes                    |
| First-party visit and topic-view analytics                                                                                                                                     | After O6               |

### 5.2 Disabled until tax configuration is approved

Each switch needs an approved tax rule and supplier identity in the database (approver, time, note) **and** the environment flag `INVOICING_ENABLED=true`. Until then the code paths refuse to run in production.

| Capability                                                             | Unlocked by                                              |
| :--------------------------------------------------------------------- | :------------------------------------------------------- |
| Adding GST to the amount charged at checkout (tax quote in production) | C2–C5, C8, O1                                            |
| Allocating invoice numbers and issuing tax invoices                    | C2–C8 and supplier identity approved                     |
| Automatic invoice email delivery                                       | as above                                                 |
| Issuing credit notes as tax documents for refunds                      | as above                                                 |
| GST summaries and sales registers presented as tax figures             | as above (before then they show "tax treatment pending") |
| Any treatment of payments received since 1 July 2026                   | C1, as the CA directs                                    |

---

## 6. Historical transactions report (separate, for CA review)

A read-only report of every payment received since the registration took effect, so the CA can decide C1. It is deliberately kept apart from the invoicing system.

- **Scope:** payments created on or after **1 July 2026 00:00 IST**, real provider only (`TEST` rows counted separately and listed in their own section), every status.
- **Columns:** payment id; created and paid date and time (IST; paid date marked "estimated" where it comes from `updated_at`); status; amount charged (paise and rupees) and currency; Razorpay order and payment ids; billing name, email, mobile, state and city (state and city are absent for payments made before they were collected, and shown as absent); what was bought (topic and batch titles shown **as they are in today's catalogue** and labelled as such, because no snapshot existed); seat status; refunds recorded (none existed before Phase 1).
- **Not included, by design:** any GST, taxable value, rate, SAC or place-of-supply column. No figure is computed from today's tax configuration or catalogue prices.
- **Never does:** create invoices, change amounts, statuses or dates, or mark rows as reviewed.
- **Delivery:** `GET /api/finance/reports/historical-payments?format=json|csv` (SUPER_ADMIN, FINANCE_ADMIN; every export audited). Producing it from the **production** database is an action the owner authorises separately.
- **Marking:** these payments carry `tax_status = 'LEGACY_UNREVIEWED'`, a value that no automatic process (quote, invoice, credit note, GST report) will ever act on. Only a later, explicit, audited action following the CA's written instruction can change it.

---

## 7. Starting point (verified at `ce0dcaf`)

| Area           | What exists                                                                                                                                                                                                                                                                        |
| :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout       | Guest checkout (`POST /api/payments/checkout`, public): billing name, email, mobile, state, city. Price from the catalogue in integer paise, INR. The billing email becomes a passwordless `users` row.                                                                            |
| Confirmation   | `POST /api/payments/verify` (public): order id match plus timing-safe HMAC. Webhook `POST /api/payments/webhook`: raw-body HMAC, amount check, handles only `payment.captured` and `order.paid`. Seat confirmed in one transaction; confirmation email never rolls a payment back. |
| Statuses       | Payments `CREATED`, `PAID`; seats `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`.                                                                                                                                                                                                     |
| Not present    | Capture verification, failed / expired / refunded / disputed states, event store, refunds, invoices, tax, credit notes, settlements, reconciliation, analytics, audit log, finance roles.                                                                                          |
| Reporting      | `GET /api/admin/orders` (super admin, 500 newest rows); totals summed in the browser.                                                                                                                                                                                              |
| Data integrity | `payments.user_id … ON DELETE CASCADE`; no `paid_at`; history reads the live catalogue; `TEST` rows mixed with real ones.                                                                                                                                                          |
| Infrastructure | One Express API with an injectable `AppContext` (`db`, `config`, `mailer`, `now`, `paymentGateway`); append-only migrations (last `010_tutors`); PGlite in tests, PostgreSQL 16 in production; in-process interval jobs (`jobs/cleanup.ts`); minimal dependencies.                 |

Razorpay behaviour relied on, checked against Razorpay's current documentation on 2026-11-14: at-least-once webhook delivery with a unique `x-razorpay-event-id` header; no ordering guarantee (`payment.failed` can be followed by `payment.captured`); 5-second response window and retries for 24 hours before the webhook is disabled; automatic capture by default for Orders API payments, and auto-refund of authorised payments left uncaptured past the capture timeout (3 days by default); late authorisation up to 3 days after creation; refunds only on captured payments, with `receipt` acting as an idempotency key; per-transaction fee, tax, settlement id and UTR from `GET /v1/settlements/recon/combined`; `count`/`skip` pagination and HTTP 429 rate limiting. Settlement webhooks were not confirmed and are not relied on.

**Provider refund evidence (DEC-028).** Razorpay JSON is cast, not parsed, at the gateway and webhook, so every provider report about a refund passes `payments/refundEvidence.ts` before it can settle a refund: a non-empty provider id with no surrounding whitespace, the provider payment id, a whole-number paise amount, a currency (never defaulted), a supported status, and our receipt when we have one. A refund is moved to `FAILED` or `PROCESSED` only on evidence that passes; anything else keeps the amount reserved and records a `REFUND_EXCEPTION_RECORDED` entry for finance (shown on `/finance/refund-exceptions` and the refund detail). The database also refuses blank or padded `provider_refund_id` values (migration 023).

---

## 8. Components, data flow and data model

### 8.1 Components

```
                         ┌──────────────────────── website (React) ─────────────────────────┐
  visitor ──► pages ──►  │ checkout: Individual | Business       /finance/* (lazy, staff)    │
                         │  • first-party view events (after O6)  Overview Payments Invoices…│
                         └──────┬──────────────────────────────────┬─────────────────────────┘
                                │ public                           │ session + role
┌───────────────────────────────▼──────────────────────────────────▼──────────────────────────┐
│ API (Express) — one application, one database                                                │
│  payments ── checkout: base price (+ tax quote once approved) ──► Razorpay order             │
│     │        verify: signature ─► AUTHORIZED ─► fetch payment ─► CAPTURED                    │
│     │        webhook: signature ─► payment_events (dedupe by event id) ─► lifecycle          │
│     ▼                                                                                        │
│  finance/lifecycle ── on CAPTURED (one transaction): seat confirmed, paid_at, audit,         │
│     │                  invoice + number (only when invoicing is active), outbox rows          │
│     ├─ refunds ──► Razorpay refund (receipt = idempotency key) ─► refund.* events             │
│     │              ─► credit note (only when invoicing is active) ─► outbox                   │
│     ├─ disputes ◄─ payment.dispute.* events                                                   │
│  finance/reports ── SQL over snapshots · historical report · CSV · audit                      │
│  finance/reconciliation ── Razorpay recon API ⇄ payments ⇄ refunds ⇄ invoices ─► exceptions   │
│  jobs (in-process, SKIP LOCKED): outbox · payment expiry · daily recon · monthly report        │
└───────────────┬────────────────────────────────────────────────────────────┬────────────────┘
                ▼                                                            ▼
        PostgreSQL (SriDha's database only)                         Resend (email, PDF attachment)
```

**Capture path:**

1. Checkout prices the sale (base price; plus an approved tax quote once invoicing is active), stores the payment (`CREATED`, billing snapshot, quote or `PENDING_CONFIGURATION`) and creates the Razorpay order for that total.
2. Browser returns with a signature → valid → `AUTHORIZED`; the API fetches the payment; captured with matching order, amount and currency → step 4; only authorised → wait for the capture webhook (or capture explicitly if O3 sets manual capture).
3. Webhook → signature valid → `INSERT … ON CONFLICT (provider, event_id) DO NOTHING` into `payment_events`; duplicates acknowledged and ignored; otherwise applied by the lifecycle rules (9.1).
4. `confirmCapture` (one transaction, payment row locked): `PAID`, `paid_at`, provider payment id, seat `CONFIRMED`, audit row, outbox rows; **if invoicing is active and the sale has an approved quote**, the invoice number, snapshot and lines too. Re-entry is a no-op.
5. The outbox worker renders the PDF once from the snapshot (stored with its SHA-256) and sends emails with retries.

### 8.2 Relationships

```
users (customer = billing email; staff roles) ─┬─< payments >─┬─ enrolments >── batches >── topics
                                               │              └─ pre_registrations >── topics
                                               │   │  (billing snapshot B2C/B2B, quote or tax_status, paid_at)
                                               │   ├─< payment_events          UNIQUE (provider, event_id)
                                               │   ├─< payment_refunds ──1:0..1── credit_notes ─< credit_note_lines
                                               │   ├─< payment_disputes
                                               │   └──1:0..1── invoices ─< invoice_lines
                                               │                  └──1:0..1── finance_documents (PDF bytes, sha256)
supplier_identity (one legal supplier, versioned) ─< invoices / credit_notes (values also copied)
tax_rules (effective-dated, approved) ─< payments.tax_rule_id (values also copied)
document_series (series, financial_year, next_value)
finance_audit_log (append-only)          notification_outbox (retrying jobs)
reconciliation_runs ─< reconciliation_items ; provider_transactions (fee, tax, settlement, utr)
analytics_events (anonymous visits and topic views)
```

### 8.3 Changes to existing tables

`payments` — additions are nullable or defaulted; historical values are kept as they are and **not** back-filled from the live catalogue or today's tax configuration:

- **Integrity:** `user_id` foreign key becomes `ON DELETE RESTRICT`.
- **Lifecycle:** status check widened to `CREATED, AUTHORIZED, PAID, FAILED, EXPIRED` (`PAID` keeps meaning captured; no stored value renamed); `authorized_at`, `paid_at`, `failed_at`, `expired_at`, `failure_code`, `failure_reason`. Existing `PAID` rows get `paid_at = updated_at` with `paid_at_estimated = true`.
- **Item snapshot:** `item_description`, `item_topic_id`, `item_batch_id`, `unit_price_paise`, `quantity` (1). Null for historical rows ("snapshot unavailable").
- **Billing snapshot:** `customer_type` (`INDIVIDUAL` | `BUSINESS`); existing name, email, mobile, state, city; new `address_line1`, `address_line2`, `pin_code`; for business: `business_legal_name`, `gstin`, `gstin_check` (`FORMAT_VALID` | `PROVIDER_VERIFIED`), `contact_person`, `contact_mobile`. Check constraint: a `BUSINESS` payment has legal name, GSTIN, address, state, PIN and billing email. Historical rows: `customer_type` left null ("not captured").
- **Tax:** `tax_status` (`LEGACY_UNREVIEWED` for every pre-existing payment; `PENDING_CONFIGURATION` while invoicing is disabled; `QUOTED` once approved), `tax_rule_id`, `place_of_supply_state`, `supply_type`, `taxable_paise`, `exempt_paise`, `cgst_paise`, `sgst_paise`, `igst_paise`, `rate_bp`, `sac_code`. Check constraint: for `QUOTED`, `taxable + exempt + cgst + sgst + igst = amount_paise`.

`users.role` check widened to `STUDENT, SUPER_ADMIN, FINANCE_ADMIN, OPERATIONS_ADMIN`.

### 8.4 New tables (abridged; full DDL arrives with each phase's migration)

| Table                            | Key columns and constraints                                                                                                                                                                                                                                                                                                             |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supplier_identity`              | Versioned: `legal_name`, `gstin`, `registered_address`, `state_code`, `pin_code`, `display_brand`, `brand_display_mode` (governed by C6), `effective_from`, `status` (`DRAFT`, `APPROVED`, `SUPERSEDED`), `approved_by`, `approved_at`, `approval_note`. A partial unique index allows at most one `APPROVED` version at a time.        |
| `tax_rules`                      | `applies_to` (`ENROLMENT`, `PRE_REGISTRATION`), `treatment` (`TAXABLE`, `EXEMPT`, `NON_TAXABLE`), `rate_bp`, `sac_code`, `pricing_mode` (`EXCLUSIVE`; `INCLUSIVE` supported for the future), `effective_from`, `effective_to`, `status`, `approved_by`, `approved_at`, `approval_note`. No overlapping approved rules per `applies_to`. |
| `payment_events`                 | UNIQUE (`provider`, `event_id`), `event_type`, provider payment and order ids, `amount_paise`, `currency`, sanitised `payload` (card, VPA, bank, email, phone removed), `received_at`, `applied`, `outcome`, `payment_id`.                                                                                                              |
| `payment_refunds`                | `payment_id` FK RESTRICT, `provider_refund_id` UNIQUE, `receipt` UNIQUE (idempotency key), `amount_paise` > 0, `status` (`PENDING`, `PROCESSED`, `FAILED`), `reason`, `source` (`FINANCE_ADMIN`, `PROVIDER_DASHBOARD`), `requested_by`, timestamps; refunds never exceed the captured amount (trigger).                                 |
| `payment_disputes`               | `payment_id` FK RESTRICT, `provider_dispute_id` UNIQUE, `phase`, `status`, `amount_paise`, `amount_deducted_paise`, timestamps.                                                                                                                                                                                                         |
| `document_series`                | PRIMARY KEY (`series`, `financial_year`), `next_value`; allocated inside the issuing transaction (row lock; a rolled-back transaction consumes no number).                                                                                                                                                                              |
| `invoices` / `invoice_lines`     | `number` UNIQUE, `payment_id` UNIQUE, `supplier_identity_id` plus copied supplier values, buyer snapshot (B2C or B2B incl. GSTIN and address), place of supply, supply type, SAC, rate, taxable/exempt/CGST/SGST/IGST/total in paise, currency, Razorpay order and payment ids, IST invoice date; update and delete blocked.            |
| `credit_notes` / lines           | Same shape; `invoice_id` FK RESTRICT, `refund_id` UNIQUE; cumulative credit per component never exceeds the invoice.                                                                                                                                                                                                                    |
| `finance_documents`              | `document_type`, `document_id`, `pdf` (bytea), `sha256`, `template_version`, `rendered_at`; rendered once, served for every download.                                                                                                                                                                                                   |
| `finance_audit_log`              | `occurred_at`, `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `details` (no secrets, no full personal data), `request_id`; insert-only.                                                                                                                                                                           |
| `notification_outbox`            | `kind`, `dedupe_key` UNIQUE, `payload`, `status`, `attempts`, `next_attempt_at`, `last_error`; `FOR UPDATE SKIP LOCKED`; back-off; dead-letter.                                                                                                                                                                                         |
| `provider_transactions`          | From Razorpay recon: entity id and type, amount, fee, tax on fee, settlement id, settlement UTR, settled at, order and payment ids; UNIQUE per provider entity.                                                                                                                                                                         |
| `reconciliation_runs` / `_items` | Run window and counts; exception items (missing payment, duplicate, amount mismatch, currency mismatch, unmatched settlement, missing invoice, refund mismatch) with expected vs actual and `OPEN` / `ACKNOWLEDGED` + note. Acknowledging never edits financial rows.                                                                   |
| `analytics_events`               | `occurred_at`, `event_type` (`page_view`, `topic_view`), random first-party `visitor_id`, `session_id`, `path`, `topic_id`, `referrer_host`, UTM fields; no IP, user agent or personal data.                                                                                                                                            |

---

## 9. Core rules

### 9.1 Payment lifecycle

`CREATED → AUTHORIZED → PAID (captured)`; `CREATED/AUTHORIZED → FAILED`; `CREATED → EXPIRED`. Refunds and disputes are separate records.

- Events are stored first, then applied, and only forward: `PAID` is terminal for capture; `FAILED → PAID` allowed (documented by Razorpay); `EXPIRED → PAID` allowed on provider-confirmed capture and flagged for review; later `payment.authorized` events after `PAID` are recorded and ignored.
- Every application checks order id, amount and currency; a mismatch is recorded as `REJECTED_MISMATCH`, logged at error level and never confirms a seat.
- Expiry only after the provider window (capture timeout + late-authorisation window, configurable) **and** an order fetch showing no captured payment.

### 9.2 Tax engine (`finance/tax.ts`, pure, exhaustively tested)

Inputs: base price (paise), quantity, the approved rule effective at checkout, supplier state (Rajasthan, from the approved supplier identity), place-of-supply state (per C5), pricing mode. Outputs: taxable, exempt, CGST, SGST, IGST, total, supply type.

- `TAXABLE` + `EXCLUSIVE` (F4): taxable = base price × quantity; GST added on top.
- `EXEMPT` / `NON_TAXABLE`: no GST; value reported in its own column.
- Same state as the supplier → CGST + SGST at half the rate each; different state → IGST (subject to C5).
- No approved rule effective → no calculation at all; the sale is `PENDING_CONFIGURATION` and is shown as such in every report. Nothing is defaulted.

### 9.3 Rounding (proposal for C8)

Half-up to the paisa, per tax component, per line, with `BigInt`. CGST and SGST each computed on the half rate and rounded separately. Document totals are sums of rounded line values, so every document adds up exactly. No rounding to the rupee unless C8 requires it. Credit notes reverse tax proportionally with the same rule, and the last credit note on an invoice takes the exact remainder so cumulative credits never exceed the original per component.

### 9.4 Numbering (format per C7)

Configurable tokens, for example `{PREFIX}/{FY}/{SEQ:6}` → `SDA/2026-27/000001` and `SDA/CN/2026-27/000001`; one series per document type per financial year (IST); allocated inside the issuing transaction; format length validated; uniqueness and gap-freedom proven by concurrent-capture tests on real PostgreSQL. No number is allocated while invoicing is disabled.

### 9.5 GSTIN validation

Server-side, never dependent on a third party:

1. Normalise (trim, upper-case); 15 characters.
2. Structure: two-digit state code, ten-character PAN pattern, entity code, `Z`, check character.
3. Check character recomputed with the published GSTIN checksum algorithm.
4. State code compared with the billing state entered; a mismatch is shown to the buyer and stored, and its effect on place of supply follows C5.

The result is stored as `gstin_check = 'FORMAT_VALID'`, and documents and screens say "format verified", never "active" or "registered". If the owner later approves a verification provider (O7), a successful lookup is recorded as `PROVIDER_VERIFIED` with its timestamp; an unavailable provider never blocks a sale or an invoice.

### 9.6 Dashboard definitions

| Figure        | Definition                                                                                                                                                         |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected     | Captured amounts by `paid_at`, real provider only.                                                                                                                 |
| Gross sales   | Taxable + exempt + non-taxable value of captured sales (excl. GST); `LEGACY_UNREVIEWED` and `PENDING_CONFIGURATION` sales shown in their own line, not classified. |
| Tax collected | CGST, SGST, IGST of sales with an approved quote only.                                                                                                             |
| Refunds       | Processed refunds by processed date; credit notes shown separately.                                                                                                |
| Net sales     | Gross sales − value reversed by credit notes.                                                                                                                      |
| Gateway fees  | Razorpay fee and GST on fee, from reconciliation data ("not yet reconciled" when missing).                                                                         |
| Settlements   | Amounts settled by Razorpay by settlement date, with UTR. Bank statements are not connected, and say so.                                                           |
| Customers     | New = first captured purchase in the period; returning = an earlier captured purchase exists.                                                                      |

"Sales" is not presented as recognised accounting revenue; revenue recognition is a CA matter.

---

## 10. API contracts (under `/api`, types in `api/src/contracts/finance.ts`)

Public, extended: `POST /payments/checkout` gains `customerType` with the B2C/B2B fields and, once invoicing is active, returns the tax breakdown; `POST /payments/verify` returns `AUTHORIZED` or `PAID`; `POST /payments/webhook` handles the full event set; new `POST /analytics/events` (after O6; strict schema, rate-limited, no personal data).

Staff (session + server-side role check; `Cache-Control: no-store`):

| Method & path                                                            | Roles                              | Purpose                                                                                                                                       |
| :----------------------------------------------------------------------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /finance/overview?period=…&from=&to=`                               | SUPER, FINANCE                     | KPIs for the period and the previous equivalent period                                                                                        |
| `GET /finance/trends?granularity=day\|month&…`                           | SUPER, FINANCE                     | Time series (monthly revenue and tax reports draw on this)                                                                                    |
| `GET /finance/payments?status=&q=&page=`, `/:id`                         | SUPER, FINANCE (OPERATIONS masked) | Payments with events, refunds, invoice, credit notes                                                                                          |
| `POST /finance/payments/:id/refunds`                                     | SUPER, FINANCE                     | Full or partial refund (reason required; idempotent)                                                                                          |
| `GET /finance/invoices`, `/:id`, `/:id/pdf`; `POST /:id/resend`          | SUPER, FINANCE                     | Register, detail, download, resend (download and resend audited)                                                                              |
| `GET /finance/credit-notes…`                                             | SUPER, FINANCE                     | Register, detail, PDF                                                                                                                         |
| `GET /finance/customers?q=&type=&page=`, `/:id`                          | SUPER, FINANCE                     | Customer list and purchase history                                                                                                            |
| `GET /finance/reports/:report?from=&to=&format=json\|csv`                | SUPER, FINANCE                     | B2B and B2C sales registers, invoice and credit-note registers, GST summaries, SAC-wise, state-wise, monthly, financial-year; exports audited |
| `GET /finance/reports/historical-payments?format=json\|csv`              | SUPER, FINANCE                     | Section 6 report for the CA (read-only, audited)                                                                                              |
| `GET /finance/analytics/products`, `/funnel`                             | SUPER, FINANCE, OPERATIONS         | Product and funnel analytics (measured vs not measured)                                                                                       |
| `GET/POST /finance/reconciliation/runs…`, `POST …/items/:id/acknowledge` | SUPER, FINANCE                     | Runs, exceptions, acknowledgement with a note                                                                                                 |
| `GET /finance/audit-log`                                                 | SUPER                              | Append-only audit trail                                                                                                                       |
| `GET/POST /finance/settings/tax-rules`, `POST …/:id/approve`             | FINANCE drafts, SUPER approves     | Tax rules with approval record                                                                                                                |
| `GET/POST /finance/settings/supplier-identity`, `POST …/:id/approve`     | SUPER                              | The one legal supplier identity, versioned                                                                                                    |

Errors use the existing `{ message, code, details }` shape with new `ERROR_CODE` entries.

---

## 11. Website

- **Checkout:** an Individual / Business choice. Individual: name, email, mobile, billing address, state, city, PIN (mandatory rules per C9). Business: legal name, GSTIN (validated as in 9.5, with a clear "format verified" message), registered billing address, state, city, PIN, billing email, contact person and mobile. Once invoicing is active, the base price, GST lines and total are shown before paying. The existing guest model is unchanged: no student accounts.
- **Finance area:** `/finance`, lazy-loaded, behind the staff `ProtectedRoute` and a `canViewFinance` policy; navigation Overview, Payments, Invoices, Customers, GST Reports, Refunds & Credit Notes, Reconciliation, Sales Analytics, Conversion Funnel, Audit Logs, Settings. Existing UI kit and tokens (forest green, gold, square corners), in-house SVG charts, server-paginated tables, server-resolved IST periods. Team orders is superseded by Finance → Payments.

## 12. Background jobs (in the API process, following `jobs/cleanup.ts`)

| Job            | Schedule                 | Safety                                                                   |
| :------------- | :----------------------- | :----------------------------------------------------------------------- |
| Outbox worker  | every 15 s               | `SKIP LOCKED` claims, idempotent per `dedupe_key`, back-off, dead-letter |
| Payment expiry | hourly                   | Provider confirmation before expiring                                    |
| Reconciliation | daily, IST early morning | Read-only towards financial rows                                         |
| Monthly report | 1st of month, IST        | Outbox email to configured recipients (O2)                               |

## 13. Migration plan

Forward-only, appended after `010_tutors` (renumbered if main gains migrations first), each with undo SQL in a comment, each tested on populated databases (PGlite in CI and throwaway PostgreSQL databases; never `sridha_dev` or production).

| Id (indicative)                 | Phase | Change                                                                                                                                       |
| :------------------------------ | :---- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `011_payment_integrity`         | 1     | RESTRICT; `paid_at` + estimated flag; item snapshot; `tax_status` with existing rows `LEGACY_UNREVIEWED`; reporting indexes excluding `TEST` |
| `012_payment_events`            | 1     | Event store                                                                                                                                  |
| `013_staff_roles_and_audit`     | 1     | Role check widened; insert-only `finance_audit_log`                                                                                          |
| `014_payment_lifecycle`         | 1     | Status widened; lifecycle fields; refunds; disputes                                                                                          |
| `015_customer_billing`          | 1     | B2C/B2B billing snapshot columns and constraints                                                                                             |
| `016_supplier_and_tax`          | 2     | `supplier_identity`, `tax_rules`, payment tax-quote columns                                                                                  |
| `017_invoices_and_credit_notes` | 2     | `document_series`, invoices, credit notes, lines, `finance_documents`, immutability triggers                                                 |
| `018_notification_outbox`       | 1–2   | Outbox                                                                                                                                       |
| `019_reconciliation`            | 3     | Provider transactions, runs, items                                                                                                           |
| `020_analytics_events`          | 3     | Visits and topic views                                                                                                                       |

Recovery: a verified `pg_dump` immediately before any production deployment carrying a migration; undo SQL per step; a restore rehearsal on a throwaway database. No migration rewrites a historical amount, date, status meaning or catalogue reference.

## 14. Dependency proposal (O4)

**`pdfkit`** (MIT, pure JavaScript, no headless browser, embeds TrueType fonts, streams PDFs). Alternatives: `pdf-lib` (no text layout, much more code to maintain), Puppeteer/Chromium (heavy and fragile on Render). With it come static TrueType files of DM Sans and Cormorant Garamond (SIL Open Font License) and a PNG of the SriDha logo. No chart, decimal or date library is proposed.

## 15. Security and privacy

- Finance endpoints: session + server-side role check; OPERATIONS sees masked contact data; `no-store` responses; PDF downloads and CSV exports audited.
- Webhook: raw-body HMAC (existing), event-id dedupe, sanitised payload storage, heavy work deferred to the outbox to stay inside the 5-second window.
- Public checkout: replace the existing "This email has already paid for this batch" response, which lets anyone test whether an email has paid, with a neutral message (Phase 1).
- No secrets, card data, full addresses or GSTIN-with-name pairs in logs; audit details carry identifiers, not personal data.
- Supplier configuration and the certificate: the certificate is never stored; supplier details are visible only to staff and on issued documents.
- Analytics: no IP, user agent or personal data; consent per O6; rate-limited ingestion.

## 16. Testing strategy

Pure-unit tests for the tax engine, rounding and GSTIN checksum (table-driven, intra and inter-state, exempt, credit-note remainders, exact to the paisa); integration tests through `startTestServer` with a fake Razorpay gateway and clock (duplicate and out-of-order webhooks, failure then capture, capture verification, expiry, partial and multiple refunds, disputes, role access, the disabled-invoicing guard, CSV contents, outbox retries without duplicates, the historical report never changing data); concurrency tests for numbering and duplicate capture on throwaway PostgreSQL; migration tests from populated pre-phase states; synthetic fixtures only. Full existing suite after every phase.

---

## 17. Implementation phases (owner's order)

Each phase ends with a report (files, database, API and website changes, tests with real results, security implications, remaining blockers) and the owner's approval before the next. A fresh-context review follows every phase touching payments, tax or migrations.

| Phase                                                                | Scope                                                                                                                                                                                                                                                                                                                                                                | Needs before starting / enabling       | Exit criteria                                                                                                                                        |
| :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Financial data integrity and payment lifecycle**                | RESTRICT, `paid_at`, item snapshot, `TEST` exclusion, `LEGACY_UNREVIEWED` marking; event store and idempotency; capture verification; failure, expiry; refunds and disputes (money and records); staff roles; audit log; B2C/B2B billing capture and GSTIN validation; neutral checkout messages; outbox for confirmation emails; **historical transactions report** | O3 for live events; O5                 | Migrations proven on populated databases; duplicate and out-of-order tests green; historical report produced from synthetic data and changes nothing |
| **2. GST engine and invoice generation** (built, then held disabled) | Supplier identity (draft → approval flow), tax rules with approval, tax engine, quote at checkout, numbering, invoices, credit notes, PDFs, invoice emails, download and resend                                                                                                                                                                                      | O4 to build PDFs; C2–C8 + O1 to enable | Engine exact to the paisa; numbering concurrency proven; production guard proven to refuse issuance without approval                                 |
| **3. Finance dashboard, reporting and reconciliation**               | Executive dashboard, payments, invoices, customers and purchase history, B2B/B2C registers, GST summaries, monthly revenue and tax reports, CSV exports, Razorpay reconciliation, product and funnel analytics, internal notifications                                                                                                                               | O2; O6 for visit tracking              | Every figure matches direct SQL; no browser-side totals; seeded reconciliation mismatches all detected                                               |
| **4. Testing, security audit and production rollout**                | Full regression, financial-accuracy review, security review, performance review, migration rehearsal on populated data, backup and restore drill, deployment checklist, activation checklist for invoicing                                                                                                                                                           | All CA decisions for activation        | Owner go/no-go; invoicing activated only with the approval record and flag                                                                           |

---

## 18. Remaining blockers for final approval

**Before Phase 1 starts:** owner approval of this revision. Nothing else blocks Phase 1.

**During Phase 1:** O3 (Razorpay settings) to receive the full event set in production; O5 (finance roles).

**Before Phase 2 PDFs can be built:** O4 (`pdfkit`).

**Before invoicing can be switched on (Phase 4):** C1–C9 from the CA; O1 (checkout charge while unconfigured, and confirmation of price + GST after); supplier identity entered and approved; C6 brand presentation.

**Before Phase 3 analytics and notifications:** O2 (recipients), O6 (consent), O8 (retention).

**Optional:** O7 (GSTIN verification provider).

## 19. What to revisit as the system grows

Multiple line items per order; a separate job runner if job volume grows; bank-statement import for true bank reconciliation; e-invoicing (IRN) if the supplier becomes subject to it (CA to advise); multi-currency.
