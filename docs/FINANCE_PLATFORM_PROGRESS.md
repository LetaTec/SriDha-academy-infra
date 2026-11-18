# Finance platform progress

Last updated: 18 November 2026. Branch `feat/finance-platform`, HEAD `2aebdab`. Nothing in Phases 1–2.1-R3.2 is committed, pushed or deployed.

Decisions are recorded in the root `DECISION.md` (DEC-021 to DEC-028). The architecture is in `docs/finance-platform-architecture.md`, and database roles and TLS in `docs/database-roles.md`.

## Status by phase

| Phase                                                                                                                    | Status                                                     |
| :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| Remediation of the first audit (C1–C4, H1–H5)                                                                            | Done (DEC-021); independently verified as partly complete  |
| **Phase 1: financial foundation** (the independent verification's findings)                                              | Done (DEC-022)                                             |
| Phase 1.5: independent audit of Phase 1                                                                                  | Conditional pass (N1–N8, A–D)                              |
| **Phase 1.6: financial integrity closure**                                                                               | Done (DEC-023)                                             |
| Phase 1.7: independent audit of Phase 1.6                                                                                | Pass with conditions (tax approval backdating risk)        |
| **Phase 2.0: tax approval timestamp hardening**                                                                          | Done (DEC-024; Migration 021)                              |
| **Phase 2.1: refund management desk (UI & backend)**                                                                     | Done (DEC-025)                                             |
| Phase 2.1-R: first audit findings remediation                                                                            | Completed                                                  |
| Phase 2.1-R2: final refund integrity remediation                                                                         | Completed                                                  |
| Phase 2.1-R2.1: independent audit of Phase 2.1-R2                                                                         | Conditional pass (AUDIT-2.1-R2-01 HIGH finding)           |
| **Phase 2.1-R3: receipt-path provider ID validation & normalization clarification**                                      | **Done locally; awaiting independent audit verification**   |
| Phase 2.1-R3.1: independent audit of Phase 2.1-R3                                                                         | PARTIAL: R3 accepted for its scope; R31-01 (HIGH), R31-02 to R31-04 (MEDIUM) open |
| **Phase 2.1-R3.2: unified refund evidence & reconciliation integrity**                                                   | **Done locally (DEC-028; Migration 023); awaiting a fresh independent audit** |
| Phase 2.2: email outbox monitoring & operational desk                                                                    | Pending (paused for refund engine verification)            |
| Phase 2.3: finance dashboard & reporting analytics                                                                       | Pending                                                    |
| Phase 2.4: Razorpay settlement & fee reconciliation                                                                      | Pending                                                    |
| Phase 2.5: GST credit notes & live invoicing                                                                             | Blocked pending CA approval                                |

## Phase 1

**Objective:** make the financial records trustworthy before anything is built on them. That means:

- reports count only money collected;
- refunds never disappear from the ledger;
- the invoice job cannot stall;
- emails are not duplicated;
- immutability cannot be bypassed;
- production verifies database TLS;
- checkout makes no tax-invoice promise.

**Files modified or added:**

- **API:**
  - `config/env.ts`, `contracts/errors.ts`, `contracts/finance.ts`
  - `db/client.ts`, `db/connection.ts` (new), `db/applicationRole.ts` (new), `db/seed.ts`, `db/migrations.ts`
  - `http/errors.ts`, `mail/mailer.ts`, `server.ts`, `modules/auth/permissions.ts`
  - `modules/finance/`: `audit.service.ts`, `finance.routes.ts`, `reports.repository.ts`, `reports.service.ts`
  - `modules/finance/invoices/`: `invoices.repository.ts`, `invoices.service.ts`, `invoicing.activation.ts`, `taxApprovals.service.ts` (new)
  - `modules/outbox/`: `outbox.repository.ts`, `outbox.service.ts`
  - `modules/payments/`: `gateway.ts`, `payments.lifecycle.ts`, `payments.refunds.ts`, `payments.refunds.reconciliation.ts`, `payments.repository.ts`
  - `test/invoicing.ts`
- **Web:** `constants/payments.ts`, `pages/checkout/CheckoutPage.tsx` (one comment).
- **Docs:** `DECISION.md`, `docs/database-roles.md` (new), `docs/environment-variables.md`, this file (new).

**Database changes:** migration `019_finance_integrity_hardening` (undo in its comment), plus the undo note of `018` completed. It:

- adds the refund state `REQUIRES_REVIEW` with a `review_reason` column;
- adds the approval order column `seq`, and refuses approvals that take effect before they are recorded;
- makes invoices unique per (financial year, sequence) and ties the number text to the sequence;
- requires each snapshot to belong to an invoice and match the quote;
- guards quotes against edits and deletes;
- refuses TRUNCATE on every financial table;
- adds the `invoice_issuance_attempts` table and the outbox `claim_token` column;
- validates the 018 check constraint.

**Tests added or changed:**

- **New files:**
  - `payments/gateway.test.ts` (idempotency header, refusal classification, pagination);
  - `db/connection.test.ts` (TLS);
  - `db/applicationRole.postgres.test.ts` (restricted role, real PostgreSQL);
  - `web constants/payments.test.ts` (no tax-invoice promise).
- **Extended:**
  - `reports.test.ts`: collected versus not collected, pending refunds, net, CSV formulas, row limit;
  - `refunds.reconciliation.test.ts`: provider delay, late confirmation, PROCESSED stays final;
  - `invoices.test.ts`: approval ordering and backdating, the approval route, revocation during a batch, starvation, the counter, TRUNCATE, number text, snapshot amounts, quote guard, inconsistent old invoices;
  - `outbox.test.ts`: idempotency key, failed "mark sent", claim ownership, abandonment;
  - `env.test.ts`: TLS, migration role.
- **Replaced:** `refunds.reconciliation.test.ts` asserted the faulty "absent means FAILED" behaviour, and `reports.test.ts` asserted the inflated total. Both now assert the corrected behaviour.

**Results** (17 November 2026, this session):

- Typecheck 0 errors; lint 0 problems; build passed.
- API: 266 passed, 0 failed, 0 skipped. This includes the real-PostgreSQL suites on throwaway databases.
- Web: 103 passed (15 files).
- Mutation check: each of 25 fixes was reverted in a scratch copy and its test failed.
- The real API started with split roles on a throwaway copy of the development data: health OK, migrations through 019, and the application role owns 0 tables.
- Not run: Playwright end-to-end.

**Remaining risks:**

- `REQUIRES_REVIEW` refunds have no screen yet; finance must check the Razorpay dashboard.
- Jobs run in-process every hour with no run history or alerting.
- Old outbox payloads are never cleaned up; the retention policy is a business decision.
- `npx prettier --check .` still fails on about 37 files that were already unformatted before this work.
- Real-PostgreSQL coverage is targeted, not the whole suite.
- Settlements and fees are not imported, so "captured" is not "received in bank".
- No credit notes exist, so a refunded invoice cannot yet be reconciled.

**Decisions required:**

- **CA:** rounding policy; invoice number format and gaps; payments since 1 July 2026; SEZ, export and multiple-establishment rules; GST on top versus absorbed; credit-note procedure; whether the financial year follows the issue date or the supply date.
- **Owner:**
  - who may approve the tax configuration (super admin for now);
  - who may resolve `REQUIRES_REVIEW` refunds;
  - whether to make `MIGRATION_DATABASE_URL` mandatory in production;
  - the outbox retention period.

**Next step:** a fresh, independent read-only audit of Phase 1. Phase 2 does not start before it.

## Phase 1.6

**Objective:** close every finding of the Phase 1.5 independent audit (N1–N8, A–D), and add the two tests the audit found missing (the invoice approval lock and the Resend idempotency header).

**Database:** migration `020_financial_history_guards`. Its undo is in its comment; it was run on a throwaway copy of the development data, and 020 re-applied.

- Payment events are append-only.
- Refund history is guarded: never deleted, and only forward status moves.
- PAID payments are frozen: amount, currency, Razorpay references, buyer, paid time and status.
- Outbox status `UNCONFIRMED`.
- The application role also loses `DELETE` on payments, events and refunds.

**Files changed:**

- **New:** `api/src/db/startup.ts`, `api/src/test/postgres.ts`, `api/src/modules/finance/ledger.test.ts`.
- **Code:**
  - `api/src/db/applicationRole.ts`, `migrations.ts`, `server.ts`, `config/env.ts`
  - `contracts/finance.ts`
  - Finance: `audit.service.ts`, `finance.routes.ts`, `reports.repository.ts`, `reports.service.ts`, `invoices/invoices.repository.ts`, `invoices/invoices.service.ts`
  - `outbox/outbox.repository.ts`
  - Payments: `payments.lifecycle.ts`, `payments.refunds.ts`, `payments.refunds.reconciliation.ts`, `payments.repository.ts`
  - `api/package.json` (`test:postgres` script)
- **Tests:**
  - `applicationRole.postgres.test.ts` (rewritten)
  - `invoices.postgres.test.ts`, `invoices.test.ts`, `refunds.reconciliation.test.ts`, `reports.test.ts`, `outbox.test.ts`, `env.test.ts`
  - `auth.test.ts` (its production configuration now needs a migration URL)
- **Docs:** `DECISION.md` (DEC-023), `docs/database-roles.md`, `docs/environment-variables.md`, this file.

**Results** (17 November 2026, this session):

- Typecheck 0 errors; lint 0 problems; build passed.
- API, with `REQUIRE_POSTGRES_TESTS=1` and `TEST_DATABASE_URL` set: 288 passed, 0 failed, none "NOT RUN".
- `npm run test:postgres -w api`: 13 passed, 0 failed.
- Web: 103 passed (15 files).
- **Mutation check:** each of 25 Phase 1.6 fixes was reverted in a scratch copy, and its test failed every time. This includes the approval lock and the Resend header, both of which survived the Phase 1.5 auditor's mutations.
- **Migration:** the real API started with two throwaway roles on a copy of the development data (health OK; application role owns 0 tables). Undoing and re-applying 020 worked. `sridha_dev` was unchanged.
- **End-to-end ledger** (`ledger.test.ts`), in paise:

  | Item                                                 |  Paise |
  | :--------------------------------------------------- | -----: |
  | Captured (Razorpay) = payment records = report       | 53,922 |
  | Processed refunds = report refunded                  |  8,000 |
  | Report net (captured − refunded)                     | 45,922 |
  | Pending refunds                                      |      0 |
  | Refunds under review                                 |  2,000 |
  | Exceptional refunds (on a payment not captured here) | 12,900 |
  | Invoice total = tax snapshot total                   | 15,222 |
  | Unpaid checkouts                                     | 12,900 |

  The duplicate and the mismatched (9,000 for 3,000) refund webhooks changed nothing. No payment has refunds above its capture.

- **Not run:** Playwright end-to-end. Repository-wide `prettier --check .` still fails on 21 files, none of them changed in Phase 1.6.

**Remaining risks:**

- Refund exceptions and `UNCONFIRMED` emails need a person, and there is no screen yet (Phase 2).
- The database's backdating check on approvals trusts the `recorded_at` value the application writes.
- The application role could still advance `invoice_sequences` by one (a gap, never a duplicate).
- Production now refuses to start without the two-role configuration.
- Captured amounts are not bank receipts: no settlement or fee data exists yet.
- CI must run `npm run test:postgres -w api` with a disposable database. Node's summary line counts a skipped suite as "skipped 0", so the "NOT RUN" label (or `REQUIRE_POSTGRES_TESTS=1`) is what shows a skip.

**Decisions still open:**

- **CA:** rounding, invoice number format and gaps, payments since 1 July 2026, SEZ and export, GST on top or absorbed, credit notes, and the date basis for reports and financial years. Reports use the creation date today; invoices use the issue date.
- **Owner:** who resolves refund exceptions and unconfirmed emails, and the outbox retention period.

## Phase 1.7: Independent Audit

Phase 1.7 conducted an independent review of Phase 1.6:
- **Verdict:** Pass with Conditions.
- **Key finding:** Migration 019 `check_tax_approval_not_backdated` checked `effective_from >= NEW.recorded_at`. Because `recorded_at` was supplied by the caller, an application exploit could backdate `recorded_at` to circumvent backdating protection.
- **Remediation required:** Phase 2.0 database clock hardening.

## Phase 2.0: Tax Approval Timestamp Hardening

- **Migration `021_tax_approval_clock_timestamp`:** Enforces `NEW.recorded_at = CLOCK_TIMESTAMP()` in a PostgreSQL BEFORE INSERT/UPDATE trigger, disallowing caller manipulation. Validates `effective_from >= CLOCK_TIMESTAMP() - INTERVAL '5 minutes'`.
- **Status:** Complete & verified.

## Phase 2.1: Refund Management Desk

- **Backend:** `refundsDesk.service.ts` and routes under `/api/finance/refunds` and `/api/finance/refund-exceptions/:id/resolve`. Role checks restrict endpoints to `FINANCE_ADMIN` and `SUPER_ADMIN`.
- **Frontend:** `web/src/pages/refunds/RefundsPage.tsx`, `useRefunds.ts`, `finance/refunds.ts`. Includes status filtering, pagination, summary metrics, and exception resolution modal with audit history and note capture.

## Phase 2.1-R2: Final Refund Integrity Remediation

**Objective:** Address all findings from the Phase 2.1-R audit to make the refund engine unconditionally safe before Phase 2.2:
1. **Strict 5-Point Invariant Verification for `CONFIRM_PROCESSED`:**
   - Validates that provider response provides non-null `paymentId` and that it matches `paymentProviderId`.
   - Validates that provider response provides non-null `currency` and that it matches `expectedCurrency`.
   - Validates exact paise amount match.
   - Validates exact refund ID match.
   - Validates strict lowercase status parity (`'processed'`).
2. **Authoritative Terminal Failure Verification for `MARK_FAILED`:**
   - Rejects status `'pending'` or `'processed'`.
   - For status `'failed'`, validates all 5 points: exact ID, exact payment ID, exact paise amount, exact currency, and status `'failed'`.
   - Completely removes 24-hour absence fallback: absence from Razorpay records never proves failure and never releases reserved balance. Unverified refunds remain in `REQUIRES_REVIEW`.
3. **Receipt-Only Correlation:**
   - Removed loose amount-only matching fallback in `fetchPaymentRefunds`. Correlation strictly searches by `r.receipt === expectedReceipt`.
4. **Adapter Currency Accuracy:**
   - Removed `currency: refund.currency ?? 'INR'` fallback in `gateway.ts`. Returns `currency: refund.currency ?? null` and `paymentId: item.payment_id ?? null`.
5. **PostgreSQL 23505 Conflict Handling:**
   - Catches unique violation when `provider_refund_id` is duplicated, rolls back the transaction, and throws HTTP 409 `PAYMENT_VERIFICATION_FAILED`.
6. **Migration 022 Redundancy Analysis:**
   - Documented in `DECISION.md` (DEC-026) that Migration 022 (`CREATE UNIQUE INDEX ... WHERE provider_refund_id IS NOT NULL`) is technically redundant with Migration 014's column-level `UNIQUE` constraint, but harmlessly preserved under forward-only migration policy.

**Verification Results:**
- `npm test -w api`: 315 passed, 0 failed.
- `npm test -w web`: 110 passed, 0 failed.
- `npm run typecheck`: clean (0 errors).
- `npm run lint`: clean (0 errors).
- `npm run build`: clean production build.
- **Status:** Phase 2.1-R2 completed. Independent audit conducted (Phase 2.1-R2.1).

## Phase 2.1-R2.1: Independent Audit

Phase 2.1-R2.1 independently evaluated Phase 2.1-R2:
- **Verdict:** Conditional pass — 1 HIGH finding (`AUDIT-2.1-R2-01`), 1 LOW finding (`AUDIT-2.1-R2-02`), and real PostgreSQL suite marked `NOT RUN` (`AUDIT-2.1-R2-08`).
- **Core finding (`AUDIT-2.1-R2-01`):** In `refundsDesk.service.ts` Path B (receipt matching), `candidateRefund.id` was not checked for non-emptiness before storing and transitioning the refund to `FAILED`.
- **Observation (`AUDIT-2.1-R2-02`):** Status evaluation uses case-insensitive `toLowerCase()` normalization rather than strict lowercase string comparison.

## Phase 2.1-R3: Receipt-Path Provider ID Validation & Status Normalization Clarification

**Objective:** Remediate `AUDIT-2.1-R2-01` and clarify `AUDIT-2.1-R2-02`.

1. **Explicit Provider Refund ID Validation in Path B:**
   - In `refundsDesk.service.ts`, before any candidate refund is accepted as authoritative evidence in `MARK_FAILED`, explicitly validate:
     ```typescript
     if (
       !candidateRefund.id ||
       typeof candidateRefund.id !== 'string' ||
       !candidateRefund.id.trim()
     ) {
       throw new ApiError(
         409,
         ERROR_CODE.paymentVerificationFailed,
         'Provider refund record is missing an authoritative refund ID',
       );
     }
     ```
   - Enforced prior to assigning `verifiedProviderRefundId`, updating the database, or writing the audit event.
2. **Status Normalization Clarification (`AUDIT-2.1-R2-02`):**
   - The engine utilizes case-insensitive status normalization (`status?.toLowerCase()`) to match Razorpay's lowercase protocol (`'processed'`, `'failed'`, `'pending'`) while remaining robust against provider or mock casing variations. Non-terminal states (e.g. `'pending'`, null, undefined) continue to be rejected unconditionally.
3. **Negative & Positive Unit Test Coverage:**
   - Added 4 targeted tests in `refundsDesk.test.ts` exercising Path B:
     1. `id: ""` (empty string)
     2. `id: null`
     3. `id` omitted entirely
     4. `id: "   "` (whitespace only)
   - Verified that every case returns HTTP 409 `PAYMENT_VERIFICATION_FAILED`, preserves `REQUIRES_REVIEW` status, does not populate `provider_refund_id`, keeps reserved refund balance intact, and logs 0 resolution audit events.
   - Verified positive control test where a valid, non-empty provider refund ID successfully resolves.

**Verification Results:**
- `npm test -w api`: 319 passed, 0 failed (75 suites).
- `npm test -w web`: 110 passed, 0 failed (16 test files).
- `npm run typecheck`: clean (0 errors).
- `npm run lint`: clean (0 errors).
- `npm run build`: clean production build for both `api` and `web`.
- **Status:** Ready for independent review. Phase 2.2 and production remain **BLOCKED**.

## Phase 2.1-R3.1: Independent Audit

A fresh read-only audit accepted the R3 fix (`AUDIT-2.1-R2-01`, closed for the desk) and found the same root cause elsewhere: R31-01 (HIGH, reconciliation), R31-02, R31-03, R31-04 (MEDIUM) and eight LOW findings (R31-05 to R31-12). Verdict PARTIAL: not safe for live refund resolution, Phase 2.2 not to start. Real PostgreSQL 16.15: committed suites 13/13.

## Phase 2.1-R3.2: Unified Refund Evidence & Reconciliation Integrity

**Objective:** close R31-01 to R31-04. Decision: DEC-028. Migration: `023_payment_refunds_provider_id_clean`.

- **One validator** (`payments/refundEvidence.ts`) decides whether provider refund data is usable: id (non-empty, not padded), payment id, integer paise amount, currency (never defaulted), supported status, and our receipt. Applied in reconciliation (hourly and manual), the refund desk (all three resolution paths), signed webhooks and refund creation.
- **Unusable evidence never settles a refund.** The reserved amount stays and a `REFUND_EXCEPTION_RECORDED` entry is written once; an unresolved refund moves to `REQUIRES_REVIEW`.
- **Desk receipt binding.** A staff-supplied provider id is accepted only when that provider refund carries our receipt; several provider refunds under one receipt are refused; a different id from the one on record is a 409.
- **R31-04.** A late `refund.processed` that cannot be reinstated, and a dashboard refund over the captured amount, are recorded as finance exceptions (visible in `GET /finance/refund-exceptions` and on the refund detail), one per provider event.
- **Migration 023.** The database refuses blank or whitespace-padded provider refund ids (NOT VALID, validated only if existing data is clean).
- **Also changed (LOW findings that touch the same code):** R31-05, R31-06, R31-07, R31-08, R31-12. Not changed: R31-09 (web page), R31-10 (docs corrected by DEC-028), R31-11 (tests added for the areas covered here).

### Tests run (18 November 2026, this session)

See the R3.2 report for exact counts. Real PostgreSQL ran on a disposable PostgreSQL 16.15 container created for this phase and removed afterwards.

### Remaining

A fresh independent R3.2 audit; R31-09; the production-readiness audit; CA approvals. Phase 2.2 has not been started.
