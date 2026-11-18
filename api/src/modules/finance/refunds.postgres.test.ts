import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { loadConfig } from '../../config/env.js';
import { seedCatalogue } from '../../db/catalogueSeed.js';
import { openDatabase, type Database } from '../../db/client.js';
import { openApplicationDatabase } from '../../db/startup.js';
import { createScriptedRazorpay } from '../../test/fakeRazorpay.js';
import {
  captureQuotedPayment,
  createQuotedPayment,
  TEST_LATER,
  TEST_PAID_AT,
} from '../../test/invoicing.js';
import {
  asPostgresAdmin,
  postgresSuite,
  postgresUrl,
} from '../../test/postgres.js';
import {
  applyPaymentEvent,
  EVENT_SOURCE,
} from '../payments/payments.lifecycle.js';
import { reconcilePendingRefunds } from '../payments/payments.refunds.reconciliation.js';
import { requestRefund } from '../payments/payments.refunds.js';
import { markRefundRequiresReview } from '../payments/payments.repository.js';
import { resolveRefundException } from './refundsDesk.service.js';

// The refund engine on a real PostgreSQL server, as the restricted
// application role: what PGlite (one connection, no real locks) cannot
// prove. Desk resolution, duplicate provider ids, concurrent resolution and
// webhooks, rollback, the captured cap and exception idempotency.

const local = { mode: 'disable' as const, ca: null };
const HOUR = 60 * 60 * 1000;

describe(
  'Refund engine on real PostgreSQL (R3.2)',
  postgresSuite('refunds.postgres'),
  () => {
    const suffix = randomBytes(5).toString('hex');
    const database = `sridha_refund_test_${suffix}`;
    const password = randomBytes(18).toString('hex');
    const owner = { name: `sridha_t_rown_${suffix}`, password };
    const app = { name: `sridha_t_rapp_${suffix}`, password };
    let ownerDb: Database;
    let db: Database;
    let counter = 0;
    const config = loadConfig({ NODE_ENV: 'test' });
    void config;

    const clock = () => TEST_LATER;
    const razorpay = createScriptedRazorpay();

    const staff = async () => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, NULL, 'FINANCE_ADMIN', $3, $3)`,
        [id, `finance.${id}@sridha.test`, TEST_LATER.toISOString()],
      );
      return { userId: id, role: 'FINANCE_ADMIN' as const };
    };

    // A captured payment and one refund of `amountPaise` left for review,
    // with the provider's record of it scripted
    const exception = async (
      amountPaise: number,
      status: 'failed' | 'processed' | 'pending' = 'failed',
    ) => {
      counter += 1;
      const payment = await createQuotedPayment(db, { at: TEST_PAID_AT });
      await captureQuotedPayment(db, payment, TEST_PAID_AT);
      const providerPaymentId = String(
        (
          await db.get(
            'SELECT provider_payment_id FROM payments WHERE id = $1',
            [payment.paymentId],
          )
        )?.provider_payment_id,
      );
      razorpay.state.refundResult = () => ({ outcome: 'unknown' });
      const actor = await staff();
      const { refund } = await requestRefund(
        { db, now: clock },
        razorpay.gateway,
        actor,
        payment.paymentId,
        { amountPaise, reason: 'Real PostgreSQL test' },
      );
      const receipt = razorpay.refundRequests.at(-1)!.receipt;
      await markRefundRequiresReview(
        db,
        { id: refund.id, reason: 'Waiting for a person' },
        TEST_LATER.toISOString(),
      );
      const providerRefundId = `rfnd_pg_${suffix}_${counter}`;
      const record = {
        id: providerRefundId,
        status,
        amountPaise,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      };
      razorpay.refunds.set(providerRefundId, record);
      razorpay.paymentRefunds.set(providerPaymentId, [record]);
      return {
        payment,
        providerPaymentId,
        refundId: refund.id,
        receipt,
        providerRefundId,
        actor,
      };
    };

    const resolve = (
      refundId: string,
      actor: { userId: string; role: 'FINANCE_ADMIN' },
      input: {
        action: 'CONFIRM_PROCESSED' | 'MARK_FAILED';
        providerRefundId?: string;
      },
    ) =>
      resolveRefundException(
        db,
        razorpay.gateway,
        refundId,
        actor,
        {
          evidenceReference: 'PG test evidence',
          notes: 'PG test notes',
          ...input,
        },
        TEST_LATER,
      );

    const row = (refundId: string) =>
      db.get<Record<string, unknown>>(
        'SELECT * FROM payment_refunds WHERE id = $1',
        [refundId],
      );

    const countOf = async (sql: string, params: unknown[]) =>
      Number((await db.get<{ n: string | number }>(sql, params))?.n ?? 0);

    const resolvedAudits = (refundId: string) =>
      countOf(
        `SELECT COUNT(*) AS n FROM finance_audit_log
         WHERE action = 'REFUND_EXCEPTION_RESOLVED' AND entity_id = $1`,
        [refundId],
      );

    const exceptions = (refundId: string | null) =>
      countOf(
        `SELECT COUNT(*) AS n FROM finance_audit_log
         WHERE action = 'REFUND_EXCEPTION_RECORDED'
           AND entity_id IS NOT DISTINCT FROM $1`,
        [refundId],
      );

    const reserved = (paymentId: string) =>
      countOf(
        `SELECT COALESCE(SUM(amount_paise), 0) AS n FROM payment_refunds
         WHERE payment_id = $1 AND status <> 'FAILED'`,
        [paymentId],
      );

    const webhook = (
      eventId: string,
      eventType: string,
      providerPaymentId: string,
      entity: {
        id: unknown;
        amountPaise: unknown;
        status: unknown;
        receipt?: unknown;
      },
      now = clock,
    ) =>
      applyPaymentEvent(
        { db, now },
        {
          provider: 'RAZORPAY',
          source: EVENT_SOURCE.webhook,
          eventId,
          eventType,
          providerPaymentId,
          providerOrderId: null,
          amountPaise: null,
          currency: null,
          payload: {},
          refund: {
            id: entity.id,
            paymentId: providerPaymentId,
            amountPaise: entity.amountPaise,
            currency: 'INR',
            receipt: entity.receipt ?? null,
            status: entity.status,
          },
        },
      );

    before(async () => {
      for (const user of [owner, app]) {
        await asPostgresAdmin(
          `CREATE ROLE ${user.name} LOGIN PASSWORD '${user.password}'`,
        );
      }
      await asPostgresAdmin(`CREATE DATABASE ${database} OWNER ${owner.name}`);
      db = await openApplicationDatabase({
        databaseUrl: postgresUrl(database, app),
        migrationDatabaseUrl: postgresUrl(database, owner),
        databaseTls: local,
        pgMaxConnections: 10,
      });
      ownerDb = await openDatabase(postgresUrl(database, owner), 2, local);
      await seedCatalogue(ownerDb);
    });

    after(async () => {
      await db?.close();
      await ownerDb?.close();
      await asPostgresAdmin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      for (const user of [owner, app]) {
        await asPostgresAdmin(`DROP ROLE IF EXISTS ${user.name}`);
      }
    });

    it('resolves a refund once when two staff resolve it at the same moment', async () => {
      const fixture = await exception(900);
      const second = await staff();
      const outcomes = await Promise.allSettled([
        resolve(fixture.refundId, fixture.actor, { action: 'MARK_FAILED' }),
        resolve(fixture.refundId, second, { action: 'MARK_FAILED' }),
      ]);

      const won = outcomes.filter(item => item.status === 'fulfilled');
      const lost = outcomes.filter(item => item.status === 'rejected');
      assert.equal(won.length, 1);
      assert.equal(lost.length, 1);
      assert.equal(
        (lost[0] as PromiseRejectedResult).reason.statusCode ??
          (lost[0] as PromiseRejectedResult).reason.status,
        409,
      );
      assert.equal((await row(fixture.refundId))?.status, 'FAILED');
      assert.equal(await resolvedAudits(fixture.refundId), 1);
      assert.equal(await reserved(fixture.payment.paymentId), 0);
    });

    it('lets only one refund take a provider refund id when two are resolved at once', async () => {
      const a = await exception(700);
      const b = await exception(700);
      // Both refunds' providers claim the same id (a staff mistake)
      const shared = `rfnd_pg_shared_${suffix}`;
      for (const fixture of [a, b]) {
        razorpay.refunds.set(shared, {
          id: shared,
          status: 'failed',
          amountPaise: 700,
          currency: 'INR',
          paymentId: fixture.providerPaymentId,
          receipt: fixture.receipt,
        });
      }
      // The scripted gateway answers one record per id; make each request
      // see its own payment's record
      const original = razorpay.gateway.fetchRefund;
      const answers = new Map<string, number>();
      razorpay.gateway.fetchRefund = async id => {
        const fixture = (answers.get(id) ?? 0) % 2 === 0 ? a : b;
        answers.set(id, (answers.get(id) ?? 0) + 1);
        return {
          id,
          status: 'failed',
          amountPaise: 700,
          currency: 'INR',
          paymentId: fixture.providerPaymentId,
          receipt: fixture.receipt,
        };
      };
      let outcomes: PromiseSettledResult<unknown>[];
      try {
        outcomes = await Promise.allSettled([
          resolve(a.refundId, a.actor, {
            action: 'MARK_FAILED',
            providerRefundId: shared,
          }),
          resolve(b.refundId, b.actor, {
            action: 'MARK_FAILED',
            providerRefundId: shared,
          }),
        ]);
      } finally {
        razorpay.gateway.fetchRefund = original;
      }

      // Whichever record each request was shown, no refund may end with the
      // shared id unless it is the only one holding it
      const holders = await countOf(
        'SELECT COUNT(*) AS n FROM payment_refunds WHERE provider_refund_id = $1',
        [shared],
      );
      assert.ok(holders <= 1, 'the unique index keeps one holder');
      const won = outcomes.filter(item => item.status === 'fulfilled').length;
      assert.ok(won <= 1, 'at most one resolution succeeded');
      for (const fixture of [a, b]) {
        const state = await row(fixture.refundId);
        if (state?.status === 'REQUIRES_REVIEW') {
          // The loser rolled back completely
          assert.equal(state.provider_refund_id, null);
          assert.equal(await resolvedAudits(fixture.refundId), 0);
          assert.equal(await reserved(fixture.payment.paymentId), 700);
        }
      }
    });

    it('rolls a refused resolution back without a trace', async () => {
      const fixture = await exception(500);
      // The provider says the refund is still pending: refused with 409
      razorpay.paymentRefunds.set(fixture.providerPaymentId, [
        {
          id: fixture.providerRefundId,
          status: 'pending',
          amountPaise: 500,
          currency: 'INR',
          paymentId: fixture.providerPaymentId,
          receipt: fixture.receipt,
        },
      ]);
      await assert.rejects(
        () =>
          resolve(fixture.refundId, fixture.actor, { action: 'MARK_FAILED' }),
        (error: { statusCode?: number; status?: number }) =>
          (error.statusCode ?? error.status) === 409,
      );
      const state = await row(fixture.refundId);
      assert.equal(state?.status, 'REQUIRES_REVIEW');
      assert.equal(state?.provider_refund_id, null);
      assert.equal(await resolvedAudits(fixture.refundId), 0);
      assert.equal(await reserved(fixture.payment.paymentId), 500);
    });

    it('keeps a desk resolution and a webhook for the same refund consistent, with no deadlock', async () => {
      for (let round = 0; round < 4; round += 1) {
        const fixture = await exception(600, 'failed');
        // The webhook is the only source that says processed here; the
        // desk's provider record says failed. Whichever wins, the other is
        // refused or recorded, never a mix.
        const outcomes = await Promise.allSettled([
          resolve(fixture.refundId, fixture.actor, { action: 'MARK_FAILED' }),
          webhook(
            `evt_pg_race_${suffix}_${round}`,
            'refund.processed',
            fixture.providerPaymentId,
            {
              id: fixture.providerRefundId,
              amountPaise: 600,
              status: 'processed',
              receipt: fixture.receipt,
            },
          ),
        ]);

        for (const outcome of outcomes) {
          if (outcome.status === 'rejected') {
            const error = outcome.reason as {
              statusCode?: number;
              status?: number;
              code?: string;
            };
            assert.equal(
              error.statusCode ?? error.status,
              409,
              `only a refusal may fail, got ${String(error.code)}`,
            );
          }
        }
        const state = await row(fixture.refundId);
        assert.ok(
          ['FAILED', 'PROCESSED'].includes(String(state?.status)),
          `settled, not ${String(state?.status)}`,
        );
        // The amount follows the final status, and never exceeds the capture
        assert.equal(
          await reserved(fixture.payment.paymentId),
          state?.status === 'PROCESSED' ? 600 : 0,
        );
        if (state?.status === 'FAILED') {
          assert.equal(await resolvedAudits(fixture.refundId), 1);
        }
      }
    });

    it('applies a late processed refund for only as many failed refunds as the capture has room for', async () => {
      counter += 1;
      const payment = await createQuotedPayment(db, { at: TEST_PAID_AT });
      await captureQuotedPayment(db, payment, TEST_PAID_AT);
      const captured = Number(
        (
          await db.get('SELECT amount_paise FROM payments WHERE id = $1', [
            payment.paymentId,
          ])
        )?.amount_paise,
      );
      const providerPaymentId = String(
        (
          await db.get(
            'SELECT provider_payment_id FROM payments WHERE id = $1',
            [payment.paymentId],
          )
        )?.provider_payment_id,
      );
      const actor = await staff();
      const half = Math.floor(captured / 2) + 1; // two of these cannot both fit
      const failed: Array<{ id: string; providerRefundId: string }> = [];
      for (let index = 0; index < 2; index += 1) {
        razorpay.state.refundResult = request => ({
          outcome: 'created',
          refund: {
            id: `rfnd_pg_room_${suffix}_${counter}_${index}`,
            status: 'pending',
            amountPaise: request.amountPaise,
            currency: 'INR',
            paymentId: request.providerPaymentId,
            receipt: request.receipt,
          },
        });
        const { refund } = await requestRefund(
          { db, now: clock },
          razorpay.gateway,
          actor,
          payment.paymentId,
          { amountPaise: half, reason: 'Room for one' },
        );
        const providerRefundId = String(refund.providerRefundId);
        await webhook(
          `evt_pg_room_fail_${suffix}_${counter}_${index}`,
          'refund.failed',
          providerPaymentId,
          {
            id: providerRefundId,
            amountPaise: half,
            status: 'failed',
          },
        );
        failed.push({ id: refund.id, providerRefundId });
      }
      assert.equal(await reserved(payment.paymentId), 0);

      // Razorpay now reports both processed, at the same moment
      await Promise.all(
        failed.map((item, index) =>
          webhook(
            `evt_pg_room_proc_${suffix}_${counter}_${index}`,
            'refund.processed',
            providerPaymentId,
            {
              id: item.providerRefundId,
              amountPaise: half,
              status: 'processed',
            },
          ),
        ),
      );

      const processed = await countOf(
        `SELECT COUNT(*) AS n FROM payment_refunds
         WHERE payment_id = $1 AND status = 'PROCESSED'`,
        [payment.paymentId],
      );
      assert.equal(processed, 1, 'only one fits within the captured amount');
      assert.equal(await reserved(payment.paymentId), half);
      assert.ok(half <= captured);
      const other = failed.find(
        item => item.id !== failed[0].id || processed === 1,
      );
      void other;
      // The one that could not be reinstated is a recorded exception
      const recorded =
        (await exceptions(failed[0].id)) + (await exceptions(failed[1].id));
      assert.equal(recorded, 1);
    });

    it('records one exception when a bad-evidence event is delivered many times at once', async () => {
      const fixture = await exception(400, 'pending');
      const eventId = `evt_pg_dup_${suffix}`;
      const deliveries = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          webhook(eventId, 'refund.failed', fixture.providerPaymentId, {
            id: '   ',
            amountPaise: 400,
            status: 'failed',
            receipt: fixture.receipt,
          }),
        ),
      );
      assert.ok(
        deliveries.every(item => item.status === 'fulfilled'),
        'every delivery is acknowledged',
      );
      assert.equal(
        await countOf(
          'SELECT COUNT(*) AS n FROM payment_events WHERE event_id = $1',
          [eventId],
        ),
        1,
      );
      assert.equal(await exceptions(fixture.refundId), 1);
      assert.equal((await row(fixture.refundId))?.status, 'REQUIRES_REVIEW');
      assert.equal(await reserved(fixture.payment.paymentId), 400);
      assert.equal(
        await countOf(
          `SELECT COUNT(*) AS n FROM payment_refunds
           WHERE provider_refund_id IS NOT NULL
             AND provider_refund_id !~ '^\\S(.*\\S)?$'`,
          [],
        ),
        0,
      );
    });

    it('flags bad reconciliation evidence once even when reconciliation runs concurrently', async () => {
      const payment = await createQuotedPayment(db, { at: TEST_PAID_AT });
      await captureQuotedPayment(db, payment, TEST_PAID_AT);
      const providerPaymentId = String(
        (
          await db.get(
            'SELECT provider_payment_id FROM payments WHERE id = $1',
            [payment.paymentId],
          )
        )?.provider_payment_id,
      );
      razorpay.state.refundResult = () => ({ outcome: 'unknown' });
      const actor = await staff();
      const { refund } = await requestRefund(
        { db, now: clock },
        razorpay.gateway,
        actor,
        payment.paymentId,
        { amountPaise: 300, reason: 'Concurrent reconciliation' },
      );
      const receipt = razorpay.refundRequests.at(-1)!.receipt;
      razorpay.paymentRefunds.set(providerPaymentId, [
        {
          id: '',
          status: 'failed',
          amountPaise: 300,
          currency: 'INR',
          paymentId: providerPaymentId,
          receipt,
        },
      ]);

      const later = () => new Date(TEST_LATER.getTime() + HOUR);
      const runs = await Promise.all(
        Array.from({ length: 4 }, () =>
          reconcilePendingRefunds({ db, now: later }, razorpay.gateway, {
            olderThanMinutes: 0,
          }),
        ),
      );
      // (Other tests' refunds with valid evidence may settle in these runs)
      assert.equal(runs.length, 4);
      assert.equal((await row(refund.id))?.status, 'REQUIRES_REVIEW');
      assert.equal(await exceptions(refund.id), 1);
      assert.equal(await reserved(payment.paymentId), 300);
    });

    it('refuses a blank or padded provider refund id in the database itself', async () => {
      const fixture = await exception(200);
      for (const value of ['', '   ', ' rfnd_pad', 'rfnd_pad\n']) {
        await assert.rejects(
          () =>
            db.query(
              'UPDATE payment_refunds SET provider_refund_id = $2 WHERE id = $1',
              [fixture.refundId, value],
            ),
          (error: { code?: string }) => error.code === '23514',
          JSON.stringify(value),
        );
      }
    });

    it('never lets the application role rewrite the exception history', async () => {
      const fixture = await exception(250);
      await webhook(
        `evt_pg_history_${suffix}`,
        'refund.failed',
        fixture.providerPaymentId,
        {
          id: '',
          amountPaise: 250,
          status: 'failed',
          receipt: fixture.receipt,
        },
      );
      assert.equal(await exceptions(fixture.refundId), 1);
      await assert.rejects(() =>
        db.query(
          `UPDATE finance_audit_log SET details = '{}'::jsonb WHERE action = 'REFUND_EXCEPTION_RECORDED'`,
        ),
      );
      await assert.rejects(() =>
        db.query(
          `DELETE FROM finance_audit_log WHERE action = 'REFUND_EXCEPTION_RECORDED'`,
        ),
      );
      assert.equal(await exceptions(fixture.refundId), 1);
    });
  },
);
