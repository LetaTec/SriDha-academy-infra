import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AppContext } from '../../app/context.js';
import { loadConfig } from '../../config/env.js';
import { seedCatalogue } from '../../db/catalogueSeed.js';
import { openDatabase, type Database } from '../../db/client.js';
import { openApplicationDatabase } from '../../db/startup.js';
import { ApiError } from '../../http/errors.js';
import {
  asPostgresAdmin,
  postgresSuite,
  postgresUrl,
} from '../../test/postgres.js';
import { createTestGateway } from './gateway.js';
import { applyPaymentEvent, EVENT_SOURCE } from './payments.lifecycle.js';
import { createCheckout, createCheckoutSchema } from './payments.service.js';

// Seats on a real PostgreSQL server, as the restricted application role,
// with requests that truly run at the same time (PGlite runs one at a
// time): a batch never holds or confirms more seats than its capacity, and
// a seat is confirmed by one payment only.

const local = { mode: 'disable' as const, ca: null };
const START = new Date('2026-10-10T09:00:00Z');
const BATCH = 'batch_accountancy_rectification_of_errors_class_11_b2';

describe(
  'Batch seats on real PostgreSQL',
  postgresSuite('seats.postgres'),
  () => {
    const suffix = randomBytes(5).toString('hex');
    const database = `sridha_seats_test_${suffix}`;
    const password = randomBytes(18).toString('hex');
    const owner = { name: `sridha_t_eown_${suffix}`, password };
    const app = { name: `sridha_t_eapp_${suffix}`, password };
    let ownerDb: Database;
    let db: Database;
    let context: AppContext;
    const gateway = createTestGateway();

    const checkout = (email: string) =>
      createCheckout(
        context,
        gateway,
        createCheckoutSchema.parse({
          kind: 'ENROLMENT',
          batchId: BATCH,
          fullName: 'Asha Verma',
          email,
          mobile: '+91 98765 43210',
          state: 'Rajasthan',
          city: 'Jaipur',
          customerType: 'INDIVIDUAL',
          addressLine1: '12 Civil Lines',
          pinCode: '302006',
        }),
      );

    const outcomeOf = (settled: PromiseSettledResult<unknown>) =>
      settled.status === 'fulfilled'
        ? 'HELD'
        : settled.reason instanceof ApiError
          ? settled.reason.code
          : `UNEXPECTED ${String(settled.reason)}`;

    const setCapacity = (capacity: number) =>
      ownerDb.query('UPDATE batches SET capacity = $1 WHERE id = $2', [
        capacity,
        BATCH,
      ]);

    // Seats counted the way availability counts them at START
    const seatsTaken = async () =>
      Number(
        (
          await db.get<{ n: string | number }>(
            `SELECT COUNT(*) AS n FROM enrolments
             WHERE batch_id = $1
               AND (status = 'CONFIRMED'
                 OR (status = 'PENDING_PAYMENT' AND updated_at > $2::timestamptz))`,
            [BATCH, new Date(START.getTime() - 30 * 60 * 1000).toISOString()],
          )
        )?.n ?? 0,
      );

    // Every test starts from an empty batch. Paid payments are never
    // deleted (the database refuses), so earlier seats are cancelled; every
    // test uses fresh emails.
    const clearBatch = () =>
      ownerDb.query(
        `UPDATE enrolments SET status = 'CANCELLED' WHERE batch_id = $1`,
        [BATCH],
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
        pgMaxConnections: 25,
      });
      ownerDb = await openDatabase(postgresUrl(database, owner), 2, local);
      await seedCatalogue(ownerDb);
      context = {
        db,
        config: loadConfig({
          NODE_ENV: 'test',
          WEB_ORIGIN: 'http://localhost:5173',
        }),
        mailer: null,
        now: () => START,
      };
    });

    after(async () => {
      await db?.close();
      await ownerDb?.close();
      await asPostgresAdmin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      for (const user of [owner, app]) {
        await asPostgresAdmin(`DROP ROLE IF EXISTS ${user.name}`);
      }
    });

    let eventCounter = 0;
    const capture = (
      order: { orderId: string; amountPaise: number },
      providerPaymentId: string,
      eventType = 'payment.captured',
    ) => {
      eventCounter += 1;
      return applyPaymentEvent(
        { db, now: () => START },
        {
          provider: 'RAZORPAY',
          source: EVENT_SOURCE.webhook,
          eventId: `evt_pg_${suffix}_${eventCounter}`,
          eventType,
          providerPaymentId,
          providerOrderId: order.orderId,
          amountPaise: order.amountPaise,
          currency: 'INR',
          payload: {},
        },
      );
    };

    const orderOf = (checkoutResult: Awaited<ReturnType<typeof checkout>>) => ({
      paymentId: checkoutResult.paymentId,
      orderId: String(checkoutResult.provider.orderId),
      amountPaise: Number(checkoutResult.amount.amountPaise),
    });

    const lapseHolds = () =>
      ownerDb.query(
        `UPDATE enrolments SET updated_at = $2
         WHERE batch_id = $1 AND status = 'PENDING_PAYMENT'`,
        [BATCH, new Date(START.getTime() - 60 * 60 * 1000).toISOString()],
      );

    const confirmedSeats = async () =>
      Number(
        (
          await db.get<{ n: string | number }>(
            `SELECT COUNT(*) AS n FROM enrolments
             WHERE batch_id = $1 AND status = 'CONFIRMED'`,
            [BATCH],
          )
        )?.n ?? 0,
      );

    const exceptionKinds = async (paymentIds: string[]) =>
      (
        await db.all<{ kind: string }>(
          `SELECT kind FROM payment_exceptions WHERE payment_id = ANY($1::text[])
           ORDER BY kind`,
          [paymentIds],
        )
      ).map(row => row.kind);

    it('holds exactly the free seats when 20 students check out at once', async () => {
      await clearBatch();
      await setCapacity(3);

      const settled = await Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          checkout(`race${index}.${suffix}@example.com`),
        ),
      );
      const outcomes = settled.map(outcomeOf);
      assert.equal(
        outcomes.filter(outcome => outcome === 'HELD').length,
        3,
        JSON.stringify(outcomes),
      );
      assert.ok(
        outcomes.every(
          outcome => outcome === 'HELD' || outcome === 'BATCH_FULL',
        ),
        JSON.stringify(outcomes),
      );
      assert.equal(await seatsTaken(), 3);
    });

    it('renews lapsed holds only up to the free seats when they come back at once', async () => {
      await clearBatch();
      await setCapacity(10);
      // Ten students hold seats, then let the holds lapse
      const emails = Array.from(
        { length: 10 },
        (_, index) => `renew${index}.${suffix}@example.com`,
      );
      for (const email of emails) await checkout(email);
      await lapseHolds();
      await setCapacity(2);

      const settled = await Promise.allSettled(
        emails.map(email => checkout(email)),
      );
      const outcomes = settled.map(outcomeOf);
      assert.equal(
        outcomes.filter(outcome => outcome === 'HELD').length,
        2,
        JSON.stringify(outcomes),
      );
      assert.ok(
        outcomes.every(
          outcome => outcome === 'HELD' || outcome === 'BATCH_FULL',
        ),
        JSON.stringify(outcomes),
      );
      assert.equal(await seatsTaken(), 2);
    });

    it('confirms one of 10 late payments captured at once for the last seat (A3)', async () => {
      await clearBatch();
      await setCapacity(10);
      const orders = [];
      for (let index = 0; index < 10; index += 1) {
        orders.push(
          orderOf(await checkout(`late${index}.${suffix}@example.com`)),
        );
      }
      await lapseHolds();
      await setCapacity(1);

      await Promise.all(
        orders.map((order, index) =>
          capture(order, `pay_late_${suffix}_${index}`),
        ),
      );
      assert.equal(await confirmedSeats(), 1, 'never over capacity');
      const paid = await db.get<{ n: string | number }>(
        `SELECT COUNT(*) AS n FROM payments
         WHERE id = ANY($1::text[]) AND status = 'PAID'`,
        [orders.map(order => order.paymentId)],
      );
      assert.equal(Number(paid?.n), 10, 'every payment is recorded as paid');
      const kinds = await exceptionKinds(orders.map(order => order.paymentId));
      assert.deepEqual(kinds, Array(9).fill('CAPTURED_FOR_FULL_BATCH'));
    });

    it('confirms a seat once when two payments for it are captured at once (A4)', async () => {
      await clearBatch();
      await setCapacity(5);
      const email = `twice.${suffix}@example.com`;
      const first = orderOf(await checkout(email));
      const second = orderOf(await checkout(email));

      await Promise.all([
        capture(first, `pay_twice_${suffix}_1`),
        capture(second, `pay_twice_${suffix}_2`),
      ]);
      assert.equal(await confirmedSeats(), 1);
      assert.deepEqual(
        await exceptionKinds([first.paymentId, second.paymentId]),
        ['CAPTURED_FOR_CONFIRMED_SEAT'],
      );
      const confirmations = await db.get<{ n: string | number }>(
        `SELECT COUNT(*) AS n FROM email_outbox
         WHERE idempotency_key = ANY($1::text[])`,
        [
          [first, second].map(
            order => `payment_confirmation:${order.paymentId}:customer`,
          ),
        ],
      );
      assert.equal(Number(confirmations?.n), 1, 'one confirmation email');
    });

    it('applies one capture when 10 events report the same payment at once (A4)', async () => {
      await clearBatch();
      await setCapacity(5);
      const order = orderOf(await checkout(`events.${suffix}@example.com`));
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          capture(
            order,
            `pay_events_${suffix}`,
            index % 2 === 0 ? 'payment.captured' : 'order.paid',
          ),
        ),
      );
      assert.deepEqual(
        results.map(result => result.outcome).sort(),
        ['APPLIED', ...Array(9).fill('IGNORED_STALE')].sort(),
      );
      assert.equal(await confirmedSeats(), 1);
      assert.deepEqual(await exceptionKinds([order.paymentId]), []);
    });

    it('never fills the last seat twice when a late capture races a new checkout', async () => {
      for (let round = 0; round < 5; round += 1) {
        await clearBatch();
        await setCapacity(1);
        const late = orderOf(
          await checkout(`racer${round}.${suffix}@example.com`),
        );
        await lapseHolds();
        const [captured, held] = await Promise.allSettled([
          capture(late, `pay_racer_${suffix}_${round}`),
          checkout(`newcomer${round}.${suffix}@example.com`),
        ]);
        assert.equal(captured.status, 'fulfilled');
        assert.ok((await seatsTaken()) <= 1, `round ${round}: over capacity`);
        const lateConfirmed = (await confirmedSeats()) === 1;
        // Exactly one of them has the seat
        assert.equal(
          lateConfirmed,
          held.status === 'rejected',
          `round ${round}: ${lateConfirmed ? 'capture' : 'checkout'} won`,
        );
      }
    });

    it('keeps capture and a batch being made inactive consistent when they race', async () => {
      for (let round = 0; round < 5; round += 1) {
        await clearBatch();
        await ownerDb.query(
          "UPDATE batches SET status = 'OPEN' WHERE id = $1",
          [BATCH],
        );
        await setCapacity(5);
        const order = orderOf(
          await checkout(`deactivate${round}.${suffix}@example.com`),
        );
        const [result] = await Promise.all([
          capture(order, `pay_deactivate_${suffix}_${round}`),
          ownerDb.query(
            "UPDATE batches SET status = 'INACTIVE' WHERE id = $1",
            [BATCH],
          ),
        ]);
        const seat = await db.get<{ status: string }>(
          `SELECT e.status FROM payments p JOIN enrolments e ON e.id = p.enrolment_id
           WHERE p.id = $1`,
          [order.paymentId],
        );
        const kinds = await exceptionKinds([order.paymentId]);
        // Either the capture ran first and confirmed the seat, or it saw the
        // batch inactive and opened an exception; never both, never neither
        if (result.outcome === 'APPLIED') {
          assert.equal(seat?.status, 'CONFIRMED', `round ${round}`);
          assert.deepEqual(kinds, [], `round ${round}`);
        } else {
          assert.equal(result.outcome, 'CAPTURED_FOR_UNAVAILABLE_BATCH');
          assert.equal(seat?.status, 'PENDING_PAYMENT', `round ${round}`);
          assert.deepEqual(kinds, ['CAPTURED_FOR_UNAVAILABLE_BATCH']);
        }
      }
      await ownerDb.query("UPDATE batches SET status = 'OPEN' WHERE id = $1", [
        BATCH,
      ]);
    });
  },
);
