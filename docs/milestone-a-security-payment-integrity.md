# Milestone A: security and payment integrity

Branch `chore/production-readiness`, uncommitted. Nothing here is committed, pushed or deployed.

| Step | Severity | Status            | Root cause                                             | Fix                                               | Tests                               | Independent review               |
| :--- | :------- | :---------------- | :----------------------------------------------------- | :------------------------------------------------ | :---------------------------------- | :------------------------------- |
| A1   | Critical | Completed locally | Documented                                             | Implemented                                       | Passed                              | Passed (2 rounds)                |
| A2   | High     | Completed locally | Documented: count-then-insert without a lock           | Batch row lock                                    | Passed, incl. real PostgreSQL races | Passed                           |
| A3   | High     | Completed locally | Documented: capture confirmed without a capacity check | Capacity re-checked at capture; payment exception | Passed                              | Passed after fixes (H1, H2, M1)  |
| A4   | High     | Completed locally | Documented: duplicate only logged; unlocked seat read  | Seat locks; durable exception; staff resolution   | Passed                              | Passed                           |
| A5   | High     | Completed locally | Documented: stored subject ignored by the worker       | Own template, content and mailer method           | Passed                              | Passed after fix (HTML escaping) |
| A6   | High     | Completed locally | Documented: outbox run inline in verify and webhook    | Worker only; Resend timeout                       | Passed                              | Passed                           |

"Completed locally" means implemented, tested and independently reviewed on this branch. Nothing is committed or deployed, and the open owner decisions at the end still apply. **This milestone does not by itself make the application production-ready.**

## A1. Sign-up proves the email before any account exists

### Original vulnerability

Checkout files a purchase under a password-less `users` row keyed on the billing email. `POST /api/auth/sign-up` with that email set a password on the row and returned a session immediately, with no email check. Anyone who knew a buyer's email could take over the account and see its purchases. In the other direction, an attacker who signed up first with someone's email received that person's later guest purchases.

### Root cause

`signUpStudent` (`api/src/modules/auth/auth.service.ts`, before this change) treated "an email on file with no password" as claimable by whoever asked. The test `signUp.test.ts` asserted that behaviour.

### Implementation

**Step 1: `POST /api/auth/sign-up` with `{ fullName, email, password }`**

- It always answers `202` with the same body, sets no cookie and creates no account.
- What it does depends on the email:
  - A new email, or a checkout buyer's email with no password, gets a pending row in `sign_up_verifications`: the name, the scrypt password hash and a salted SHA-256 hash of a 6-digit code. The code is emailed.
  - An email with a password, or a staff email, gets a notice row and an "account exists" email. No code is sent.
  - A request within 60 seconds of the email's last request, the sixth in an hour, or after 15 failed tries in 24 hours sends nothing.

**Step 2: `POST /api/auth/sign-up/confirm` with `{ email, code, password }`**

- The newest open code for the email must be unexpired (15 minutes).
- The try is counted atomically first, with at most 5 tries.
- The code is compared in constant time.
- The password must match the step-1 hash. A wrong password fails exactly like a wrong code.
- The row is then consumed atomically (`WHERE used_at IS NULL`). After that the account is created, or the buyer row is given its name and password with its purchases kept. Only then is the session issued.

**Other details**

- No mailer configured: `503 SIGN_UP_UNAVAILABLE`.
- Rate limits: the existing per-IP limit on `/auth/sign-up` (5 per 15 minutes) also covers `/confirm`.
- Website: `SignUpForm` has a code step that mirrors the "Forgot password" form. The password stays in memory only.
- Cleanup: the hourly job deletes sign-up rows one day after they expire.

### Files changed

| File                                                                                                                                                                                                                                                                     | Why                                                                                            |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `api/src/db/migrations.ts`                                                                                                                                                                                                                                               | `028_sign_up_verifications` (table, CHECKs, index); `029_sign_up_confirmed_at` (one column)    |
| `api/src/modules/auth/auth.service.ts`                                                                                                                                                                                                                                   | `requestSignUp`, `confirmSignUp` (replace `signUpStudent`)                                     |
| `api/src/modules/auth/auth.repository.ts`                                                                                                                                                                                                                                | Verification queries; cleanup of old rows                                                      |
| `api/src/modules/auth/auth.routes.ts`, `auth.schema.ts`                                                                                                                                                                                                                  | The two routes and strict schemas                                                              |
| `api/src/contracts/auth.ts`, `contracts/errors.ts`, `http/errors.ts`                                                                                                                                                                                                     | `SignUpPendingResponse`, `SignUpConfirmRequest`, `INVALID_SIGN_UP_CODE`, `SIGN_UP_UNAVAILABLE` |
| `api/src/mail/mailer.ts`                                                                                                                                                                                                                                                 | `sendSignUpCode`, `sendAccountExistsNotice`; console mailer can write to `MAIL_CONSOLE_FILE`   |
| `api/src/config/env.ts`                                                                                                                                                                                                                                                  | `MAIL_CONSOLE_FILE` (refused in production or without the console transport)                   |
| `api/src/jobs/cleanup.ts`                                                                                                                                                                                                                                                | Comment for the new table                                                                      |
| `api/src/test/testServer.ts`                                                                                                                                                                                                                                             | Records sign-up codes and notices; `signUpStudent` helper                                      |
| `web/src/components/auth/SignUpForm/SignUpForm.tsx`                                                                                                                                                                                                                      | Code step                                                                                      |
| `web/src/services/auth/*`, `web/src/constants/auth.ts`                                                                                                                                                                                                                   | `requestSignUp`, `confirmSignUp`, copy                                                         |
| `web/e2e/mailbox.ts` (new), `web/e2e/site.spec.ts`, `web/playwright.config.ts`                                                                                                                                                                                           | The browser journey reads the code from `web/e2e-mail.log` (ignored by git)                    |
| `docs/environment-variables.md`, `DECISION.md` (DEC-031)                                                                                                                                                                                                                 | Documentation                                                                                  |
| Tests: `signUp.test.ts` (rewritten), `signUp.postgres.test.ts` (new), `cleanup.test.ts`, `env.test.ts`, `changePassword.test.ts`, `resetCode.test.ts`, `emailEnumeration.test.ts`, `outbox.test.ts` (mailer stubs), `AccountDialog.test.tsx`, `SampleTestPaper.test.tsx` | Regression and updated fixtures                                                                |

### Database migration

- `028_sign_up_verifications` creates one new table and index and touches no existing rows. `029_sign_up_confirmed_at` adds one nullable column (`ADD COLUMN IF NOT EXISTS`) and a CHECK to that new table. Both are safe on a populated database.
- **To undo:** `DROP TABLE sign_up_verifications`.
- The restricted application role gets access through the start-up grant (`grantApplicationPrivileges`); this was verified on real PostgreSQL as that role.
- **To undo 029:** `ALTER TABLE sign_up_verifications DROP COLUMN confirmed_at`.
- Neither has been applied to a shared or production database. `confirmed_at` was first added inside 028 during review, then moved to 029 so that any database that ran the first 028 still ends up correct. I could not check the local development database: a read-only query on it was refused by the permission settings.

### Tests executed (this session, final code)

| Check                                                                       | Result                                                                                               |
| :-------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `npm run typecheck`, `npm run lint`                                         | exit 0, exit 0                                                                                       |
| Prettier on every changed file                                              | clean (`DECISION.md` was already unformatted on `main`; the new DEC-031 section is clean on its own) |
| `npm test`, API                                                             | 496 tests: 496 passed, 0 failed, 0 cancelled, 0 skipped                                              |
| `npm test`, web                                                             | 23 files, 215 tests passed                                                                           |
| `npm run test:postgres -w api` (disposable PostgreSQL 16.15, since removed) | 26 tests: 26 passed, 0 skipped (22 existing + 4 new)                                                 |
| `npm run build`                                                             | exit 0                                                                                               |
| `npm audit`, `npm audit --omit=dev`                                         | 0 vulnerabilities each                                                                               |
| `npm run test:e2e -w web`                                                   | 26 passed, including the sign-up journey on desktop and mobile                                       |

**Red-green checks** (each guard removed temporarily, then restored and checked with `cmp`):

| Check                                           | Result                                                                                                                                                                |
| :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unmodified `main`: the takeover test            | fails (`201 !== 202`)                                                                                                                                                 |
| Password binding removed                        | the H1 test fails                                                                                                                                                     |
| Attempt limit removed                           | fails                                                                                                                                                                 |
| Expiry removed                                  | fails                                                                                                                                                                 |
| Hourly cap removed                              | fails                                                                                                                                                                 |
| Daily failure budget removed                    | fails                                                                                                                                                                 |
| Existing-account check removed                  | fails                                                                                                                                                                 |
| Single-use guard removed                        | **passes on PGlite**, which runs one request at a time; **fails on real PostgreSQL** (the buyer-claim race returns `EMAIL_ALREADY_REGISTERED` to the losing requests) |
| Dummy hash on confirm removed (M1)              | fails (1.3 ms with an account vs 47.7 ms pending)                                                                                                                     |
| Per-code cap in the daily budget removed (M2)   | fails                                                                                                                                                                 |
| Per-email lock removed (LOW 3), real PostgreSQL | fails in 4 of 5 runs (a race; detection is probabilistic); the real code passed 5 of 5                                                                                |

### Independent review findings

**First review**, a fresh read-only reviewer:

| Finding                                                                                                                            | Severity | Outcome                                                                         |
| :--------------------------------------------------------------------------------------------------------------------------------- | :------- | :------------------------------------------------------------------------------ |
| H1: an attacker's password ends up on the owner's account when the owner confirms within the cooldown (reproduced by the reviewer) | High     | **Fixed**: confirm requires the step-1 password; regression test added          |
| H2: the legacy `POST /api/auth/register` creates accounts without email proof and answers `409` for existing emails (pre-existing) | High     | **Resolved 2026-11-27: endpoint removed (DEC-034)**                             |
| M1: per-email throttles let anyone block new codes for an address and send it up to 5 emails an hour                               | Medium   | Accepted trade-off, documented; owner may choose per-IP+email                   |
| M2: no cross-code budget on failed tries                                                                                           | Medium   | **Fixed**: no new code after 15 failed tries in 24 hours; regression test added |
| L1: small timing differences between paths                                                                                         | Low      | Documented                                                                      |
| L2: shared per-IP limit (school NAT)                                                                                               | Low      | Documented, product decision                                                    |

**Second review**, a fresh read-only reviewer: **H1 is closed** (no sequence found that installs a password the owner did not choose, or gives a session without the inbox); no Critical or High findings.

| Finding                                                                                                                             | Severity | Outcome                                                                                  |
| :---------------------------------------------------------------------------------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------- |
| M1: confirm skipped the password hash when no sign-up was pending (about 1.5 ms vs 49 ms), revealing that the email has an account  | Medium   | **Fixed**: dummy hash on that path; timing regression test                               |
| M2: tries past a code's 5 counted toward the daily budget, so 1 code + 15 wrong confirms blocked an email for a day                 | Medium   | **Fixed**: at most 5 tries per code count; regression test                               |
| LOW 3: simultaneous requests could all pass the throttle and each send a code                                                       | Low      | **Fixed**: per-email advisory lock around the check and the insert; real-PostgreSQL test |
| LOW 4: one per-IP limit shared by `/register`, `/sign-up` and `/sign-up/confirm`                                                    | Low      | Open, product decision (usability)                                                       |
| LOW 5: asking again within the cooldown with a different password makes the code fail with no explanation (recovers after a minute) | Low      | Documented; a consequence of the H1 fix                                                  |
| LOW 6: stale cleanup comment                                                                                                        | Low      | **Fixed**                                                                                |
| Migration caveat: 028 was edited before release                                                                                     | Note     | **Fixed**: the column moved to 029 (`IF NOT EXISTS`)                                     |

### Remaining risks

- **H2, `/register`.** Until it is removed or gated, an attacker can pre-create an account for someone else's email, and that person's later guest purchases attach to it.
- **Accounts claimed before this fix were never verified.** A read-only production query can list buyer rows that received a password through the old sign-up. Whether to force a password reset is an owner decision.
- **Denial of service through the throttles (M1).**
- **Password reset has the same weakness as M2 and no per-email cap.** It predates this change.
- **Sign-up depends on email delivery** (`MAIL_TRANSPORT=resend` in production).

## A2. Batch capacity race

**Original problem.** Two students checking out at the same moment could both take the last seat.

**Root cause.**

- `createEnrolment` (new hold) and `renewSeatHold` (returning student) read the batch without a lock, counted the taken seats, then inserted or renewed a hold.
- Transactions run at READ COMMITTED, so two transactions could both count "one seat free".

**Invariant.** Holds plus confirmed seats in a batch never exceed its capacity.

**Fix.**

- Both paths now lock the batch row first, with `lockBatchRow` (`SELECT … FOR UPDATE`), and only then count.
- A second transaction waits for the lock. Its count is a new statement under READ COMMITTED, so it sees the seat the first one took.
- No migration was needed.

**Evidence (real PostgreSQL 16.15, `seats.postgres.test.ts`):**

| Scenario                                                 | Without the lock (3 of 3 runs) | With the lock                         |
| :------------------------------------------------------- | :----------------------------- | :------------------------------------ |
| 20 simultaneous checkouts on a batch of 3                | 18 or 19 holds                 | exactly 3 held, the rest `BATCH_FULL` |
| 10 simultaneous renewals of lapsed holds on a batch of 2 | 10 holds                       | exactly 2                             |

## A3. Late capture against a full batch

**Original problem.** A seat hold lasts 30 minutes, but a payment can be captured up to 96 hours later. Capture confirmed the seat with no capacity check, so a slow payment could put a batch over capacity.

**Invariant.** A capture never confirms a seat beyond capacity, and the money is never lost.

**Fix** (`payments.lifecycle.ts`, `payments.repository.ts`):

1. Capture locks the batch row, then the seat row. This is the same order checkout uses, and checkout never takes a payment lock, so there is no deadlock (the reviewer traced every path).
2. It counts everyone else's seats, confirmed or within their hold, excluding this seat.
3. If the batch is full:
   - The payment is still recorded as `PAID`.
   - The seat stays unconfirmed.
   - No "seat confirmed" email is queued.
   - A `CAPTURED_FOR_FULL_BATCH` payment exception is opened.
   - The event outcome is `CAPTURED_FOR_FULL_BATCH`.
4. A capture inside its own hold always fits.

**What the student sees.**

- The verify response now carries `seatConfirmed`.
- The checkout page shows "Payment received, seat not confirmed". It never shows the seat as confirmed (review finding H1).
- That buyer cannot check out and pay again for the seat while the exception is open: they get `409 PAYMENT_UNDER_REVIEW` (review finding H2).

**Recovery path** (no refund policy invented). Finance staff resolve the exception with one of:

- `REFUNDED`: allowed only after the existing refund workflow has a **processed** refund for the full amount.
- `SEAT_CONFIRMED`: seat the student. Allowed only while the seat is still unconfirmed, the payment has no refund, and the batch has room. To add a seat, staff raise the batch's capacity first, so nobody holding a seat loses it. It sends the usual confirmation emails.
- `NO_ACTION`: with a note.

Every resolution needs a note and is written to the finance audit log. A resolved exception can never change.

## A4. Duplicate captures

**Original problem.**

- A second payment captured for an already-confirmed seat (a retried checkout paid twice) produced only a log line.
- Two such captures arriving at the same moment could both see the seat unconfirmed.

**Fix.**

- The seat lock above serialises captures for one seat.
- A capture for a confirmed seat opens a `CAPTURED_FOR_CONFIRMED_SEAT` payment exception, unique per payment. It records the payment and Razorpay ids, keeps all evidence, and sends no second confirmation.
- Repeated or differently named events for the same payment (`payment.captured`, `order.paid`, verify fetch) apply once; the rest are `IGNORED_STALE`.
- Migration 030 backfills earlier `CAPTURED_FOR_CONFIRMED_SEAT` events as open exceptions, so past double charges become visible.

**Staff API:**

| Endpoint                                           | Permission      | Who has it                   |
| :------------------------------------------------- | :-------------- | :--------------------------- |
| `GET /api/finance/payment-exceptions?status=OPEN`  | `viewPayments`  | super admin or finance admin |
| `POST /api/finance/payment-exceptions/:id/resolve` | `manageRefunds` | super admin or finance admin |

**There is no web screen for these yet** (see open items).

## A5. Finance copy sent as the student email

**Root cause.** Finance-copy outbox rows were stored with template `payment_confirmation` and a "[Finance Copy]" subject. The worker always called `sendPaymentConfirmation`, so finance received the student's email: "Your seat … is confirmed", "See more topics".

**Fix.**

- Finance rows now use their own template, `payment_finance_copy`.
- Their content contains no student-facing link: name, item, amount and payment reference only.
- Their subject is `[Finance] Payment received: <topic> (<amount>)`.
- They are sent with a separate mailer method.
- Rows queued by the previous release are recognised by their `…:finance:<email>` idempotency key and also sent as finance copies.
- Every value in email HTML is now escaped (review finding M1). Before this, a billing name such as `<a href="…">Approve refund</a>` would have arrived in the finance inbox as a working link from SriDha's own sender.

## A6. Email inside payment requests

**Root cause.** `verify` and the Razorpay webhook awaited a whole outbox batch, up to 20 sends, before answering. A slow or hanging Resend delayed checkout and could make Razorpay time out, retry and eventually disable the webhook. Resend calls had no timeout.

**Fix.**

- Payment requests only queue email, inside the capture transaction.
- The existing 15-second outbox worker sends it, with retries, claim tokens and idempotency keys unchanged.
- Every Resend call has a 10-second timeout. A timed-out payment email is retried with the same idempotency key, so it is never duplicated.

**Consequence.** A confirmation can now arrive up to about 15 seconds after payment.

## A2–A6: files, migrations and tests

**Files changed:**

- Seats and capture: `catalogue.repository.ts`, `enrolments.service.ts`, `payments.service.ts`, `payments.lifecycle.ts`, `payments.repository.ts`, `payments.webhook.ts`.
- Exceptions:
  - `api/src/modules/finance/paymentExceptions.{repository,service}.ts` (new)
  - `finance.routes.ts`, `audit.service.ts`
  - `contracts/finance.ts`, `contracts/payments.ts`, `contracts/errors.ts`, `http/errors.ts`
  - `db/applicationRole.ts` (`payment_exceptions` added to the no-delete list)
- Email: `mail/mailer.ts`, `outbox/outbox.service.ts`.
- Web: `pages/checkout/CheckoutPage.tsx`, `constants/payments.ts`.
- Tests:
  - New: `seats.postgres.test.ts`, `captureExceptions.test.ts`, `emailIndependence.test.ts`.
  - Changed: `outbox.test.ts`, `mailer.test.ts`, `teamOrders.test.ts`, `routing.test.tsx`, `testServer.ts`.

**Migrations.** All are additive and safe on a populated database. None has been applied to a shared or production database.

- `030_payment_exceptions`
  - Widens the `payment_events` outcome check to a strict superset of the old list.
  - Creates `payment_exceptions`, with a trigger that blocks deletes and any change after resolution.
  - Backfills earlier duplicate captures.
  - The undo is in the comment.
- `031_payment_exceptions_no_truncate`: refuses TRUNCATE on the new table, as on every other financial table.

**Red-green checks.** Each guard was removed temporarily and its test failed; the code was then restored and checked with `cmp`.

| Guard removed                           | Result                                                     |
| :-------------------------------------- | :--------------------------------------------------------- |
| A2 batch lock                           | fails 3 of 3 runs on real PostgreSQL                       |
| A3 capacity check at capture            | fails (in memory and on real PostgreSQL)                   |
| A3/A4 capture seat locks                | 3 real-PostgreSQL concurrency tests fail, 2 of 2 runs      |
| A4 duplicate exception record           | fails                                                      |
| H1 `seatConfirmed`                      | fails                                                      |
| H2 under-lock seat check on renewal     | fails                                                      |
| H2 stale-seat guard on `SEAT_CONFIRMED` | fails (after the test was split so it isolates this guard) |
| H2 refund guard on `SEAT_CONFIRMED`     | fails                                                      |
| M1 confirmation on `SEAT_CONFIRMED`     | fails                                                      |
| L1 processed-refund rule                | fails                                                      |
| A5 template dispatch                    | fails                                                      |
| A5 legacy-row routing                   | fails                                                      |
| A6 inline send in the webhook           | the test hangs and is cancelled at its 10-second limit     |

**Final results, this session, final code:**

| Check                                                        | Result                                                  |
| :----------------------------------------------------------- | :------------------------------------------------------ |
| `npm run typecheck`, `npm run lint`                          | pass; 0 lint warnings                                   |
| `npm test`, API                                              | 515 tests: 515 passed, 0 failed, 0 cancelled, 0 skipped |
| `npm test`, web                                              | 23 files, 216 tests passed                              |
| `npm run test:postgres -w api` (disposable PostgreSQL 16.15) | 32 tests: 32 passed, 0 skipped                          |
| `npm run build`                                              | pass                                                    |
| `npm audit`, `npm audit --omit=dev`                          | 0 vulnerabilities each                                  |
| `npm run test:e2e -w web`                                    | 26 passed                                               |

**Independent reviews of A2–A6.** Two reviewers worked in parallel on separate areas.

- **Seats and payments:** the locking design is correct, with no deadlock and no automated over-fill. It found:
  - H1 (false "seat confirmed" on screen) and H2 (paying twice, then confirming the stale exception): both **fixed**.
  - M1 (no email when staff confirm a seat): **fixed**.
  - L1–L5: **fixed**, except L5, which is covered by the H2 fix.
  - M2 and M3: **documented** below.
- **Email:** no Critical or High findings.
  - M1 (unescaped HTML): **fixed**.
  - L1 and L2 (deploy and rollback edge cases): documented below.
  - L5 (verify hanging-mailer test): **added**.
- **Third review** of those fixes:
  - It confirmed H1, M1, L1, L2 and the email fixes. It found no automatic over-fill, no double confirmation and no false "confirmed" message.
  - It found two side effects of the H2 fix, both reproduced:
    - **M-1:** once the exception was resolved, the buyer could never buy that batch again. **Fixed:** re-checkout is blocked only while an exception is open.
    - **M-2:** a staff seat decision could take the seat of a student still inside their hold. **Fixed:** `SEAT_CONFIRMED` locks the batch and requires room; to add a seat, staff raise the capacity first.
  - **L-a:** a refund could be requested between the resolution's checks and its write. **Fixed:** resolution locks the payment first. This is verified by reading the code, not by a concurrency test.
  - L-b, L-c and L-d: documented below.
  - Each fix has a regression test that fails when the fix is removed.

## Open owner decisions and remaining risks

1. **`POST /api/auth/register`. Resolved 2026-11-27: removed (DEC-034).** The original options are kept below for the record.
   - It creates accounts with no email proof and reveals whether an email exists.
   - The website does not call it. API tests use it as a fixture, in 9 files.
   - Options, safest first:
     1. **Remove it** and move those tests to the verified `signUpStudent` helper. This is my recommendation.
     2. Disable it behind a setting that is off in production.
     3. Require the same emailed code as sign-up.
   - Removing an endpoint is the owner's decision under `CLAUDE.md`, so it is unchanged.
2. **Guest accounts claimed before A1. Owner decision 2026-11-27: require a password reset only for the accounts this query identifies, after the owner approves the list.** These may carry a password chosen by someone who did not own the email. Nothing has been changed. A read-only query, to run on production **after** this release is deployed (it needs migration 029):
   ```sql
   -- Checkout-created buyer rows (first payment within a minute of the row)
   -- that have a password but no verified sign-up
   SELECT u.id, u.created_at, u.updated_at
   FROM users u
   WHERE u.role = 'STUDENT'
     AND u.password_hash IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM student_profiles s WHERE s.user_id = u.id)
     AND EXISTS (SELECT 1 FROM payments p
                 WHERE p.user_id = u.id
                   AND p.created_at <= u.created_at + INTERVAL '1 minute')
     AND NOT EXISTS (SELECT 1 FROM sign_up_verifications v
                     WHERE v.email = u.email AND v.confirmed_at IS NOT NULL);
   ```
   - It cannot tell an old unverified sign-up from a password set through "Forgot password", which does prove the email.
   - A recovery plan, such as forcing a password reset for the listed accounts, needs owner approval.
3. **Sign-up throttling denial of service (accepted trade-off, from A1).**
   - Anyone can use up an email's code budget and block new codes for up to a day.
   - Possible mitigations: count the budget per email and IP, or add CAPTCHA after repeated requests. Neither is implemented.
4. **Payment authorised in time, captured late (review M2, accepted window).**
   - The hold is counted from checkout, not from Razorpay's authorisation.
   - A payment authorised at minute 29 whose capture arrives at minute 31 is late if someone took the seat in between. It then becomes an exception, not an over-fill.
   - Razorpay normally captures within seconds.
5. **Invoices for payments with an exception (review M3). Owner decision 2026-11-27: no invoice while an exception is open; implemented. Invoicing stays off.**
   - Once invoicing is switched on, the invoice job would also invoice full-batch and duplicate payments.
   - Unchanged, because invoice selection is a tax decision. Invoicing is off (`INVOICING_ENABLED=false`).
6. **No web screen for payment exceptions.** Staff use the API. The 'Seat not confirmed' result on checkout is the only new UI.
7. **Confirmation copy.**
   - The paid screen says "We have emailed the details", but the email now arrives within about 15 seconds.
   - The new "seat not confirmed" message promises team contact without a time.
   - Wording is the owner's call.
8. **Razorpay calls have no timeout.** Resolved 2026-11-27: every call now has a 10-second response-start and a 20-second total deadline (DEC-035).
9. **Batches that are inactive or already started are not checked at capture.** Resolved 2026-11-27: capture applies checkout's rule and opens `CAPTURED_FOR_UNAVAILABLE_BATCH` (DEC-035).

## Deployment prerequisites and rollback

- **Before deploying:**
  - `MAIL_TRANSPORT=resend` is set (sign-up needs email; DEC-030).
  - Optionally, check `email_outbox` for PENDING or PROCESSING rows with template `payment_confirmation` and a `…:finance:` key (email review L1). If one was attempted before the deploy, Resend may refuse its retry under the same key because the body changed. It then ends `FAILED`, never duplicated.
- **Migrations 028–031 run at start-up.** They are additive and take short locks. 030 rewrites a check constraint on `payment_events` (a brief exclusive lock).
- **Rolling back the code** leaves the new tables in place, which is harmless. Two things to know:
  - The old code cannot send `payment_finance_copy` rows: they fail after about 21 minutes and can be requeued by hand after redeploying.
  - The old code has no `/sign-up/confirm` step, so a rollback must include the website.

## Further notes from the third review (not changed)

- **L-b: a second order while the first payment is AUTHORIZED.** A buyer on the "confirming" screen can start another checkout and pay twice. The second capture becomes an open `CAPTURED_FOR_CONFIRMED_SEAT` exception, so it is never an unseen double charge. Refusing checkout while a payment is AUTHORIZED would block buyers whose authorisation later fails, so it is left as a product decision.
- **L-c: a duplicate payment's checkout page shows the normal success screen.** The seat really is theirs, but the "we have emailed the details" line is wrong for that payment; finance has the exception. Wording or extra response detail is a follow-up.
- **L-d: verify returns seat status for an already-paid payment without a signature check.** This was already true for the payment status. The payment id is an unguessable UUID.

## Release hardening (owner decisions of 2026-11-27)

### Legacy registration removed (DEC-034)

- `POST /api/auth/register` is removed. That includes its service, schema, contract type, database insert and rate-limit entry.
- The only way to create a student account is now the verified sign-up: an emailed code plus the password chosen in step 1.
- A test proves `/api/auth/register` answers 404 and creates nothing.
- **Tests moved:** the API tests that used it as a fixture now sign students up through the verified flow: cleanup, admin sign-in, enrolments, invoices, three refunds suites, reports, staff, payments, webhook, seat hold and team orders. The six tests in `auth.test.ts` that exercised the old endpoint itself were replaced; the verified sign-up tests already cover duplicates, validation and unknown fields.
- **Student profiles** (class, stream, date of birth) were only ever created by this endpoint. Existing profiles are kept and still shown; no new ones are created.
- **What else can create a user row:**
  - **Checkout** creates password-less buyer rows. These cannot sign in.
  - **"Forgot password"** can give such a row a password, but only after a code sent to that email.
  - **Staff roles** come from environment email lists, and staff sign in with emailed links.

### Razorpay timeouts (DEC-035)

Every Razorpay call (create order, fetch payment, list an order's payments, create refund, fetch refund, list refunds) has two deadlines:

- Razorpay must **start answering within 10 seconds**. This covers the connection and the first response.
- The **whole exchange, body included, must finish within 20 seconds**.

A missed deadline is handled exactly like a network failure. Its outcome is unknown, never a failure:

| Call     | On a timeout                                                                                                                                                                                                                     |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A read   | Answers "unknown". Verify then leaves the payment `AUTHORIZED` with the seat unconfirmed, and the signed webhook settles it later, once.                                                                                         |
| A refund | Stays `PENDING` for reconciliation. Its receipt is Razorpay's idempotency key, so a retry never refunds twice. A refund Razorpay accepted but whose body did not arrive is also "unknown", never "created" with invented fields. |
| An order | Is not used: the buyer sees "try again". An order Razorpay may have made cannot be paid, because nobody has its id.                                                                                                              |

Nothing that carries the key is logged.

### Batch status when a payment arrives (DEC-035)

Capture applies checkout's own rule (`resolveBatchAvailability`), under the batch and seat locks:

- The batch must still exist and be `OPEN` (not `INACTIVE` or `UPCOMING`).
- It must not be past its start date. The start day itself still counts as joinable, as at checkout. Dates are compared in UTC, as at checkout.
- It must have room for the seat.

If the batch fails these checks:

- A full batch opens `CAPTURED_FOR_FULL_BATCH`.
- Anything else opens `CAPTURED_FOR_UNAVAILABLE_BATCH` (migration `032`).
- The details record the batch id, its status, its start date, capacity, seats taken and amount.
- The payment is recorded as `PAID`, the seat is not confirmed, and no confirmation email is sent.

The payment-to-seat link is fixed when the order is created. The payment row points at the enrolment by id, and the capture is matched by Razorpay's order id and amount. Nothing from the browser chooses the batch.

### No invoice while an exception is open, or resolved without a seat (owner decision)

- The invoice job skips any payment with an open payment exception. It also skips payments whose exception was resolved as refunded or no action, because nothing was supplied and credit notes do not exist yet (review finding). Only a `SEAT_CONFIRMED` resolution makes a payment invoiceable again.
- The issuing service refuses such payments too (`PAYMENT_EXCEPTION_NOT_INVOICEABLE`), as a second line of defence behind the job's query.
- Once staff resolve the exception, the normal rules apply.
- Invoicing itself stays off (`INVOICING_ENABLED=false`) until the owner and CA approve.

### Staff procedure for payment exceptions (no web screen in this release)

**Who:** a super admin or finance admin, signed in at `https://sridhaacademy.com/admin-sign-in` with the emailed link.

**How to call the API:** from the browser console on a page of `https://sridhaacademy.com`, so the session cookie and the allowed origin are sent. Replace `API` with `https://api.sridhaacademy.com/api`.

1. **List open cases.**

   ```js
   await (
     await fetch(`${API}/finance/payment-exceptions?status=OPEN`, {
       credentials: 'include',
     })
   ).json();
   ```

   Each case shows:
   - `id`, the kind and the payment's `paymentId` and `providerPaymentId` (Razorpay `pay_…`)
   - `amountPaise` (₹ = paise ÷ 100), `buyerEmail` and `itemDescription` (topic and batch)
   - `details`, with the reason: `availability` (FULL, INACTIVE, UPCOMING, CLOSED), `batchId`, `capacity`, `seatsTaken`

   The kind tells you what happened:
   - `CAPTURED_FOR_CONFIRMED_SEAT`: the student paid twice for one seat.
   - `CAPTURED_FOR_FULL_BATCH`: the payment arrived after the batch filled.
   - `CAPTURED_FOR_UNAVAILABLE_BATCH`: the batch was inactive, upcoming or already started.

2. **Check it in the Razorpay dashboard** under the `pay_…` id, and contact the student at `buyerEmail` if needed.
3. **Resolve it** with one of the three resolutions below. Every resolution needs a note, is final, and is written to the finance audit log (`GET ${API}/finance/audit-log`, super admin).
4. **Watch for it.** The student cannot pay again for that seat until the case is resolved; they see "payment under review".

**The three resolutions:**

- **Refund.** Request it:
  ```js
  await fetch(`${API}/finance/payments/<paymentId>/refunds`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Paid twice for one seat' }),
  });
  ```
  Wait until Razorpay reports it processed. Reconciliation runs hourly, or now with `POST ${API}/finance/refunds/reconcile` and body `{}`. Then resolve:
  ```js
  await fetch(`${API}/finance/payment-exceptions/<id>/resolve`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution: 'REFUNDED', note: '<what was done>' }),
  });
  ```
  This is refused until processed refunds cover the full amount.
- **Seat the student** (full batch only). The batch must be open and have room: raise the batch's capacity first. There is no admin screen for capacity; it is a database change that needs owner approval. Then resolve with `resolution: 'SEAT_CONFIRMED'`. The student and finance receive the usual confirmation. This is refused while the batch is full or not open, if the seat was confirmed another way, or if the payment has a refund.
- **No action**, for example when the case was settled outside the system: `resolution: 'NO_ACTION'` with a note explaining it.

### Migrations 028–032 and deployment precautions

| Migration                   | What it does                                                                       | Lock impact                                                              |
| :-------------------------- | :--------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| 028 `sign_up_verifications` | New table and index                                                                | none on existing tables                                                  |
| 029 `confirmed_at`          | `ADD COLUMN IF NOT EXISTS` on the new table                                        | none on existing tables                                                  |
| 030 `payment_exceptions`    | New table, guard trigger and backfill; replaces the `payment_events` outcome check | brief exclusive lock on `payment_events` while the check is re-validated |
| 031 no-truncate trigger     | Trigger on the new table                                                           | none on existing tables                                                  |
| 032 unavailable batch       | Replaces the `payment_events` and `payment_exceptions` checks                      | same brief lock as 030                                                   |

- All five are additive and keep every existing row.
- The new check lists are strict supersets of the old ones.
- They run automatically when the API starts, as the migration role. They were verified on disposable PostgreSQL 16.15, as the restricted application role, in every real-PostgreSQL run.
- **Lock impact in practice:** while 030 and 032 replace the check, writes to `payment_events` (webhooks, verify) wait. For a table of this size that is well under a second.
- **Deploy at a quiet time.** Razorpay retries webhooks, so a briefly delayed one is not lost.
- **Never run them by hand against production.**

### Deployment sequence (each step needs owner approval)

1. **Confirm production settings:** `MAIL_TRANSPORT=resend`, `RESEND_API_KEY`, the Razorpay keys and webhook secret, `INVOICING_ENABLED=false`, and `FINANCE_NOTIFICATION_EMAILS` if finance copies are wanted.
2. **Optionally check the outbox** for PENDING or PROCESSING legacy finance rows, read-only (email review L1):
   ```sql
   SELECT COUNT(*) FROM email_outbox
   WHERE status IN ('PENDING','PROCESSING')
     AND idempotency_key LIKE '%:finance:%';
   ```
3. **Deploy the API first, then the website straight away.** The new site needs `/sign-up/confirm`. Browser tabs still running the old site will fail to sign up until they reload. This fails closed: no account is created.
4. **Smoke tests:**
   - `/api/health` reports the database connected.
   - Sign up with an inbox you control: the code email arrives, and confirming signs you in.
   - "Forgot password" emails a code.
   - Staff sign-in link works.
   - A test-mode or ₹1 staging checkout reaches "Payment received", and the student and finance emails arrive within about 15 seconds, the finance one with the `[Finance]` subject.
   - `GET /api/finance/payment-exceptions` answers for finance staff and refuses students.
5. **Run the read-only guest-account query** (below). Do not change any account until the owner approves the list.
6. **Monitor the first days.** Sentry or logs for:
   - `payments.capture_for_*`, `payments.provider_fetch_failed`, `payments.provider_refund_unanswered`
   - `mail.outbox_exhausted`, `mail.delivery_failed`
   - `auth.sign_up_code_failed`

   Also check open payment exceptions daily.

### Rollback

- **Do not roll back to `b846f4e` as a whole.** That release has the one-step sign-up that let anyone claim a checkout buyer's account (G1), and the unverified `/register`. Prefer fixing forward, or reverting only the commit that caused the problem: the release is split into separate auth, payments and email commits. If a full rollback is unavoidable, it reopens G1 for its duration and needs the owner's explicit acceptance.
- **The database needs no change for a rollback.** Migrations 028–032 stay applied; the old code ignores the new tables and the migrations it does not know.
- **Drain the outbox first:** let PENDING `payment_finance_copy` rows send. Old code cannot send them.
- **During a long rollback,** expired `sign_up_verifications` rows, which hold scrypt hashes of unconfirmed passwords, are not cleaned. Purge expired rows by hand, scoped by `expires_at`, only with approval.
- **After a rollback:**
  - Finance-copy rows with template `payment_finance_copy` fail after about 21 minutes and can be requeued by hand.
  - Sign-ups started under the new release cannot be confirmed; students sign up again.
  - Payment exceptions stay recorded for when the release returns.
- **Do not revert the migrations.** Their undo steps are in the code comments for completeness only, and 030 and 032 cannot be undone while rows use the new values.

### Guest accounts claimed before A1: read-only query for owner approval

The query is in "Open owner decisions" item 2 above. Run it read-only after deploying, since it needs migration 029. It returns account ids and timestamps only, never passwords, hashes or codes.

The owner reviews the list; nothing is executed automatically. For each approved account the planned recovery is:

- delete its sessions, so it is signed out everywhere;
- clear its password, so the account can be re-claimed only by the inbox owner through "Forgot password" or sign-up.

That plan needs explicit approval before any production write.

### Accepted for this release (owner decisions)

- **Late authorisation and capture window:** documented behaviour kept.
- **Sign-up rate-limit abuse:** accepted temporarily and tracked as a security follow-up.
- **Invoicing:** stays off. Open exceptions are never invoiced.

### Final independent reviews (2026-11-27)

Two fresh reviewers worked in parallel, followed by a third check of the fixes. They found no Critical findings in the new code.

**Auth, timeouts, logging and rollback.** No Critical or High findings.

- **M1, rollback reopens G1:** documented in Rollback above.
- **M2, both sign-up steps shared one 5-per-15-minutes limit:** **fixed.** Requests and confirmations are limited separately (5 and 10 per 15 minutes); test added, and it fails if the shared limit returns.
- **L3, targeted sign-up denial:** accepted trade-off, tracked as a follow-up.
- **L4, deploy skew:** deploy the API first.
- **L5, rollback data:** documented.
- **L6, stale table row:** fixed.
- **L7, promoted students keep their password (pre-existing, not in this diff):** a student later promoted to staff can still sign in with their old password at `/login`. **Reported to the owner as a separate issue.**

**Payments, batches, migrations and email.**

- **H1 (pre-existing, in the expiry job):** a Razorpay payment `refunded` without ever being captured (an auto-refunded authorisation) was treated as captured, giving a seat while the money was returned. **Fixed:** Razorpay's `captured` flag is mapped, and only `captured`, or `refunded` with `captured=true`, counts. Test added; it fails without the fix.
- **M1, exceptions resolved as refunded or no action became invoiceable:** **fixed** as described above; test added.
- **M2, `NO_ACTION` has no guard:** it is audited, needs a note, and now blocks invoicing. **Accepted, pending the owner's confirmation** that staff may close a case this way.
- **L1, copy said "the batch filled" for every case:** fixed with neutral wording.
- **L2, an unavailable-batch case cannot be seated even if the batch reopens:** by design; staff refund instead.
- **L3, dates are UTC as at checkout:** documented. A batch starting on day D can be bought until 05:30 IST on D+1, as before.
- **L4, pre-registration captures skip the topic's batch rule:** documented; unchanged.
- **L5, lock while replacing the `payment_events` check:** the migration runner applies each migration in one transaction, so 030 and 032 hold an exclusive lock on `payment_events` until they commit. A "validate later" split would not help, and the third check confirmed that, so it was removed. Both migrations now set `lock_timeout = '10s'`: if a long transaction holds the table, the migration and the deploy fail (Render keeps the previous release serving) instead of stalling webhooks. Deploy at a quiet time; on that failure, simply redeploy.
- **L6, Resend idempotency after content changes:** runbook note under Deployment.
- **L7, DEC-035 wording:** corrected.
- **L8, `seatConfirmed` is true for a duplicate payment:** accepted, because the seat is the student's.

**Third check** of the fixes above. It found no Critical or High issues, and confirmed the limiter, the expiry fix, the invoice rule and the copy.

- **M1:** the lock comment was wrong. **Fixed** as described under L5.
- **L3:** sign-up and password-reset confirmations shared one limiter store. **Fixed:** sign-up confirmation now has its own store; a test asserts that confirmations leave password reset unaffected.
- **M2, owner decision:** a payment Razorpay reports as captured and then refunded, whose capture webhook was missed and which was refunded outside this system within 96 hours, is applied by the expiry job as a normal sale. The seat is confirmed and the refund is recorded separately when its webhook arrives. This predates the release and is rare. Options: record the capture without confirming the seat, or open a payment exception. Invoicing is off, so no invoice can result for now.
- **L4, optional test gaps:** no test yet for `NO_ACTION`, or for two exceptions on one payment. The SQL handles both, by reading.
