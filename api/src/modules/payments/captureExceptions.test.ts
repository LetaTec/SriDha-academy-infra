import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  createScriptedRazorpay,
  FAKE_RAZORPAY_KEY_SECRET,
} from '../../test/fakeRazorpay.js';
import { startTestServer, type TestClient } from '../../test/testServer.js';

// Captures that cannot simply confirm a seat: a payment that arrives after
// its hold lapsed and the batch filled (A3), and a second payment for a seat
// that is already paid for (A4). The money is always recorded; the seat is
// never over-filled or confirmed twice; each case becomes one payment
// exception that finance staff resolve, with an audit entry.

const WEBHOOK_SECRET = 'whsec_test';
const BATCH = 'batch_accountancy_rectification_of_errors_class_11_b2';
const START = new Date('2026-10-10T09:00:00Z');
const FINANCE = 'finance@sridha.test';
const MINUTE_MS = 60 * 1000;

const signWebhook = (body: unknown) =>
  createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');

describe('captures that cannot confirm a seat', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let razorpay: TestClient;
  let finance: TestClient;
  let nowMs = START.getTime();
  let eventCounter = 0;
  const fake = createScriptedRazorpay();

  before(async () => {
    server = await startTestServer({
      paymentGateway: fake.gateway,
      razorpayWebhookSecret: WEBHOOK_SECRET,
      financeAdminEmails: [FINANCE],
    });
    server.clock.now = () => new Date(nowMs);
    razorpay = server.createClient();
  });

  after(async () => {
    await server.close();
  });

  const setCapacity = (capacity: number) =>
    server.db.query('UPDATE batches SET capacity = $1 WHERE id = $2', [
      capacity,
      BATCH,
    ]);

  // Each test uses fresh buyers on an emptied batch
  const emptyBatch = async () => {
    await server.db.query(
      `UPDATE enrolments SET status = 'CANCELLED' WHERE batch_id = $1`,
      [BATCH],
    );
    nowMs += 2 * 60 * MINUTE_MS;
  };

  // A payment that arrived after its hold lapsed and the batch filled:
  // returns its payment id and the open exception
  const latePaymentForFullBatch = async (name: string) => {
    await emptyBatch();
    await setCapacity(1);
    const late = await checkout(`${name}.late@example.com`);
    nowMs += 40 * MINUTE_MS;
    const first = await checkout(`${name}.first@example.com`);
    await capture(first, `pay_${name}_first`);
    await capture(late, `pay_${name}_late`);
    const [exception] = await exceptionsFor(late.paymentId);
    assert.equal(exception.kind, 'CAPTURED_FOR_FULL_BATCH');
    return { paymentId: late.paymentId, exceptionId: String(exception.id) };
  };

  const checkout = async (email: string) => {
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: BATCH,
        fullName: 'Seat Buyer',
        email,
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const { paymentId, provider, amount } = response.body.checkout;
    return {
      paymentId: String(paymentId),
      orderId: String(provider.orderId),
      amountPaise: Number(amount.amountPaise),
    };
  };

  const capture = async (
    order: { orderId: string; amountPaise: number },
    providerPaymentId: string,
    { event = 'payment.captured', eventId = '' } = {},
  ) => {
    eventCounter += 1;
    const body = {
      event,
      created_at: 1_790_000_000,
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            order_id: order.orderId,
            amount: order.amountPaise,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const response = await razorpay.request(
      'POST',
      '/api/payments/webhook',
      body,
      {
        'X-Razorpay-Signature': signWebhook(body),
        'X-Razorpay-Event-Id': eventId || `evt_seat_${eventCounter}`,
      },
    );
    assert.equal(response.status, 200);
  };

  const paymentState = async (paymentId: string) => {
    const row = await server.db.get<Record<string, unknown>>(
      `SELECT p.status, e.status AS seat_status, e.id AS enrolment_id
       FROM payments p JOIN enrolments e ON e.id = p.enrolment_id
       WHERE p.id = $1`,
      [paymentId],
    );
    assert.ok(row);
    return { payment: String(row.status), seat: String(row.seat_status) };
  };

  const exceptionsFor = (paymentId: string) =>
    server.db.all<Record<string, unknown>>(
      'SELECT id, kind, status FROM payment_exceptions WHERE payment_id = $1',
      [paymentId],
    );

  const confirmationsFor = async (paymentId: string) =>
    Number(
      (
        await server.db.get<{ n: string | number }>(
          `SELECT COUNT(*) AS n FROM email_outbox
           WHERE idempotency_key = $1`,
          [`payment_confirmation:${paymentId}:customer`],
        )
      )?.n ?? 0,
    );

  const confirmedSeats = async () =>
    Number(
      (
        await server.db.get<{ n: string | number }>(
          `SELECT COUNT(*) AS n FROM enrolments
           WHERE batch_id = $1 AND status = 'CONFIRMED'`,
          [BATCH],
        )
      )?.n ?? 0,
    );

  it('records a late payment for a full batch as paid, without over-filling it (A3)', async () => {
    await emptyBatch();
    await setCapacity(1);

    const asha = await checkout('asha.late@example.com');
    // Asha's hold lapses; Ravi takes the only seat and pays
    nowMs += 40 * MINUTE_MS;
    const ravi = await checkout('ravi.ontime@example.com');
    await capture(ravi, 'pay_ravi_ontime');
    assert.deepEqual(await paymentState(ravi.paymentId), {
      payment: 'PAID',
      seat: 'CONFIRMED',
    });

    // Asha's money arrives after the batch filled
    await capture(asha, 'pay_asha_late');
    assert.deepEqual(await paymentState(asha.paymentId), {
      payment: 'PAID',
      seat: 'PENDING_PAYMENT',
    });
    assert.equal(await confirmedSeats(), 1, 'the batch is not over-filled');
    const exceptions = await exceptionsFor(asha.paymentId);
    assert.deepEqual(
      exceptions.map(row => [row.kind, row.status]),
      [['CAPTURED_FOR_FULL_BATCH', 'OPEN']],
    );
    // Asha is not told a seat is confirmed
    assert.equal(await confirmationsFor(asha.paymentId), 0);
    const outcome = await server.db.get<{ outcome: string }>(
      `SELECT outcome FROM payment_events
       WHERE payment_id = $1 AND event_type = 'payment.captured'`,
      [asha.paymentId],
    );
    assert.equal(outcome?.outcome, 'CAPTURED_FOR_FULL_BATCH');

    // Coming back from Razorpay, Asha is told the payment arrived but the
    // seat is not confirmed (found in review: it said "PAID" only, and the
    // page showed the seat as confirmed)
    fake.payments.set('pay_asha_late', {
      id: 'pay_asha_late',
      orderId: asha.orderId,
      status: 'captured',
      amountPaise: asha.amountPaise,
      currency: 'INR',
    });
    const verified = await server
      .createClient()
      .request('POST', '/api/payments/verify', {
        paymentId: asha.paymentId,
        providerOrderId: asha.orderId,
        providerPaymentId: 'pay_asha_late',
        signature: createHmac('sha256', FAKE_RAZORPAY_KEY_SECRET)
          .update(`${asha.orderId}|pay_asha_late`)
          .digest('hex'),
      });
    assert.equal(verified.status, 200);
    assert.deepEqual(verified.body.payment, {
      paymentId: asha.paymentId,
      status: 'PAID',
      seatConfirmed: false,
    });

    // And she cannot be charged a second time for the seat while the team
    // reviews the first payment (found in review)
    nowMs += 60 * MINUTE_MS;
    await setCapacity(5);
    const again = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: BATCH,
        fullName: 'Seat Buyer',
        email: 'asha.late@example.com',
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        customerType: 'INDIVIDUAL',
        addressLine1: '12 Civil Lines',
        pinCode: '302006',
      });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'PAYMENT_UNDER_REVIEW');
  });

  it('confirms a payment that arrives inside its hold, even with the batch otherwise full', async () => {
    await emptyBatch();
    await setCapacity(1);
    const meera = await checkout('meera.hold@example.com');
    nowMs += 10 * MINUTE_MS;
    await capture(meera, 'pay_meera_hold');
    assert.deepEqual(await paymentState(meera.paymentId), {
      payment: 'PAID',
      seat: 'CONFIRMED',
    });
    assert.equal((await exceptionsFor(meera.paymentId)).length, 0);
    assert.equal(await confirmationsFor(meera.paymentId), 1);
  });

  it('confirms a late payment while the batch still has room', async () => {
    await emptyBatch();
    await setCapacity(5);
    const kiran = await checkout('kiran.late@example.com');
    nowMs += 3 * 60 * MINUTE_MS;
    await capture(kiran, 'pay_kiran_late');
    assert.deepEqual(await paymentState(kiran.paymentId), {
      payment: 'PAID',
      seat: 'CONFIRMED',
    });
    assert.equal((await exceptionsFor(kiran.paymentId)).length, 0);
  });

  it('records a second payment for an already-paid seat once, however often it is delivered (A4)', async () => {
    await emptyBatch();
    await setCapacity(5);
    // A retried checkout: two orders for the same seat
    const first = await checkout('leela.twice@example.com');
    const second = await checkout('leela.twice@example.com');
    assert.notEqual(first.paymentId, second.paymentId);

    await capture(first, 'pay_leela_1');
    await capture(second, 'pay_leela_2', { eventId: 'evt_leela_2' });
    // Razorpay retries the same event, and sends order.paid as well
    await capture(second, 'pay_leela_2', { eventId: 'evt_leela_2' });
    await capture(second, 'pay_leela_2', {
      event: 'order.paid',
      eventId: 'evt_leela_2_order',
    });

    assert.equal((await paymentState(second.paymentId)).payment, 'PAID');
    assert.equal(await confirmedSeats(), 1);
    const exceptions = await exceptionsFor(second.paymentId);
    assert.deepEqual(
      exceptions.map(row => [row.kind, row.status]),
      [['CAPTURED_FOR_CONFIRMED_SEAT', 'OPEN']],
    );
    assert.equal((await exceptionsFor(first.paymentId)).length, 0);
    // One confirmation for the seat, none for the duplicate
    assert.equal(await confirmationsFor(first.paymentId), 1);
    assert.equal(await confirmationsFor(second.paymentId), 0);
    const stored = await server.db.get<{ n: string | number }>(
      `SELECT COUNT(*) AS n FROM payment_events WHERE event_id = 'evt_leela_2'`,
    );
    assert.equal(Number(stored?.n), 1, 'a redelivered event is stored once');
  });

  it('applies one capture when the same payment is reported by different events', async () => {
    await emptyBatch();
    await setCapacity(5);
    const order = await checkout('sana.events@example.com');
    await capture(order, 'pay_sana', { eventId: 'evt_sana_captured' });
    await capture(order, 'pay_sana', {
      event: 'order.paid',
      eventId: 'evt_sana_order_paid',
    });
    const outcomes = await server.db.all<{ outcome: string }>(
      `SELECT outcome FROM payment_events WHERE payment_id = $1
       ORDER BY received_at, event_id`,
      [order.paymentId],
    );
    assert.deepEqual(outcomes.map(row => row.outcome).sort(), [
      'APPLIED',
      'IGNORED_STALE',
    ]);
    assert.equal((await exceptionsFor(order.paymentId)).length, 0);
    assert.equal(await confirmationsFor(order.paymentId), 1);
  });

  const setBatchStatus = (status: 'OPEN' | 'INACTIVE' | 'UPCOMING') =>
    server.db.query('UPDATE batches SET status = $1 WHERE id = $2', [
      status,
      BATCH,
    ]);

  const outcomeOf = async (paymentId: string) =>
    (
      await server.db.get<{ outcome: string }>(
        `SELECT outcome FROM payment_events
         WHERE payment_id = $1 AND event_type = 'payment.captured'`,
        [paymentId],
      )
    )?.outcome;

  it('does not confirm a seat in a batch made inactive while the student was paying', async () => {
    await emptyBatch();
    await setCapacity(5);
    const order = await checkout('inactive.pay@example.com');
    await setBatchStatus('INACTIVE');
    try {
      nowMs += 5 * MINUTE_MS; // inside the hold
      await capture(order, 'pay_inactive_1', { eventId: 'evt_inactive_1' });
      // Razorpay redelivers it: still one exception
      await capture(order, 'pay_inactive_1', { eventId: 'evt_inactive_1' });
    } finally {
      await setBatchStatus('OPEN');
    }
    assert.deepEqual(await paymentState(order.paymentId), {
      payment: 'PAID',
      seat: 'PENDING_PAYMENT',
    });
    const exceptions = await server.db.all<{ kind: string; details: unknown }>(
      'SELECT kind, details FROM payment_exceptions WHERE payment_id = $1',
      [order.paymentId],
    );
    assert.equal(exceptions.length, 1);
    assert.equal(exceptions[0].kind, 'CAPTURED_FOR_UNAVAILABLE_BATCH');
    assert.equal(
      (exceptions[0].details as { availability: string }).availability,
      'INACTIVE',
    );
    assert.equal(
      await outcomeOf(order.paymentId),
      'CAPTURED_FOR_UNAVAILABLE_BATCH',
    );
    assert.equal(await confirmationsFor(order.paymentId), 0);
  });

  it('does not confirm a seat when the payment arrives after the batch started', async () => {
    await emptyBatch();
    await setCapacity(5);
    const order = await checkout('started.pay@example.com');
    const resumeAt = nowMs + 2 * 60 * MINUTE_MS;
    const batch = await server.db.get<{ start_date: string }>(
      'SELECT start_date FROM batches WHERE id = $1',
      [BATCH],
    );
    // Two days after the start date (the start day itself is still open)
    const started = new Date(`${String(batch?.start_date)}T12:00:00Z`);
    nowMs = Math.max(nowMs, started.getTime() + 2 * 24 * 60 * MINUTE_MS);
    await capture(order, 'pay_started_1');
    assert.equal((await paymentState(order.paymentId)).seat, 'PENDING_PAYMENT');
    const [exception] = await server.db.all<{ kind: string; details: unknown }>(
      'SELECT kind, details FROM payment_exceptions WHERE payment_id = $1',
      [order.paymentId],
    );
    assert.equal(exception.kind, 'CAPTURED_FOR_UNAVAILABLE_BATCH');
    assert.equal(
      (exception.details as { availability: string }).availability,
      'CLOSED',
    );
    // Staff cannot seat anyone in a batch that is not open
    finance = await server.signInStaff(FINANCE);
    const exceptionRow = await server.db.get<{ id: string }>(
      'SELECT id FROM payment_exceptions WHERE payment_id = $1',
      [order.paymentId],
    );
    const decision = await finance.request(
      'POST',
      `/api/finance/payment-exceptions/${String(exceptionRow?.id)}/resolve`,
      { resolution: 'SEAT_CONFIRMED', note: 'Seat anyway' },
    );
    assert.equal(decision.status, 400);
    // Back to before the batch started for the remaining tests
    nowMs = resumeAt;
  });

  describe('finance staff resolve exceptions', () => {
    // Signed in now: the tests above moved the clock past earlier sessions
    before(async () => {
      finance = await server.signInStaff(FINANCE);
    });

    it('shows exceptions only to finance staff', async () => {
      assert.equal(
        (
          await server
            .createClient()
            .request('GET', '/api/finance/payment-exceptions')
        ).status,
        401,
      );
      const student = await server.signUpStudent({
        fullName: 'Curious Student',
        email: 'curious.student@example.com',
        password: 'correct-horse-1',
      });
      assert.equal(
        (await student.client.request('GET', '/api/finance/payment-exceptions'))
          .status,
        403,
      );
      const listed = await finance.request(
        'GET',
        '/api/finance/payment-exceptions?status=OPEN',
      );
      assert.equal(listed.status, 200);
      assert.ok(listed.body.exceptions.length >= 2);
      for (const exception of listed.body.exceptions) {
        assert.equal(exception.status, 'OPEN');
      }
    });

    it('confirms a seat in a full batch only as a deliberate, audited decision', async () => {
      const fixture = await latePaymentForFullBatch('deliberate');
      const late = { id: fixture.exceptionId, payment_id: fixture.paymentId };
      const path = `/api/finance/payment-exceptions/${late.id}/resolve`;

      const noNote = await finance.request('POST', path, {
        resolution: 'SEAT_CONFIRMED',
        note: '',
      });
      assert.equal(noNote.status, 400);

      const refundedWithoutRefund = await finance.request('POST', path, {
        resolution: 'REFUNDED',
        note: 'Refunded the student',
      });
      assert.equal(refundedWithoutRefund.status, 400);
      assert.equal(
        refundedWithoutRefund.body.code,
        'PAYMENT_EXCEPTION_RESOLUTION_INVALID',
      );

      // While the batch is full, seating this student would take someone
      // else's place (found in review): staff raise the capacity first
      const whileFull = await finance.request('POST', path, {
        resolution: 'SEAT_CONFIRMED',
        note: 'Teacher agreed to one extra seat',
      });
      assert.equal(whileFull.status, 400);
      assert.equal(whileFull.body.code, 'PAYMENT_EXCEPTION_RESOLUTION_INVALID');
      await setCapacity(2);

      const resolved = await finance.request('POST', path, {
        resolution: 'SEAT_CONFIRMED',
        note: 'Teacher agreed to one extra seat',
      });
      assert.equal(resolved.status, 200);
      assert.equal(resolved.body.exception.status, 'RESOLVED');
      assert.equal(resolved.body.exception.resolution, 'SEAT_CONFIRMED');
      assert.equal(
        (await paymentState(late.payment_id)).seat,
        'CONFIRMED',
        'the seat is confirmed by the decision',
      );
      // and the student gets the usual confirmation
      assert.equal(await confirmationsFor(late.payment_id), 1);
      const audit = await server.db.get<{ n: string | number }>(
        `SELECT COUNT(*) AS n FROM finance_audit_log
         WHERE action = 'PAYMENT_EXCEPTION_RESOLVED' AND entity_id = $1`,
        [late.id],
      );
      assert.equal(Number(audit?.n), 1);

      // Resolved once; the record can no longer change
      const again = await finance.request('POST', path, {
        resolution: 'NO_ACTION',
        note: 'Second try',
      });
      assert.equal(again.status, 409);
      await assert.rejects(
        server.db.query(
          `UPDATE payment_exceptions SET resolution_note = 'edited' WHERE id = $1`,
          [late.id],
        ),
        /already resolved/,
      );
      await assert.rejects(
        server.db.query('DELETE FROM payment_exceptions WHERE id = $1', [
          late.id,
        ]),
        /never deleted/,
      );
      await assert.rejects(server.db.query('TRUNCATE payment_exceptions'));
    });

    it('accepts "refunded" for a duplicate payment only once it is fully refunded', async () => {
      const [duplicate] = await server.db.all<{
        id: string;
        payment_id: string;
      }>(
        `SELECT id, payment_id FROM payment_exceptions
         WHERE kind = 'CAPTURED_FOR_CONFIRMED_SEAT' AND status = 'OPEN'`,
      );
      const path = `/api/finance/payment-exceptions/${duplicate.id}/resolve`;

      const seatForDuplicate = await finance.request('POST', path, {
        resolution: 'SEAT_CONFIRMED',
        note: 'Wrong action',
      });
      assert.equal(seatForDuplicate.status, 400);

      const refund = await finance.request(
        'POST',
        `/api/finance/payments/${duplicate.payment_id}/refunds`,
        { reason: 'Paid twice for one seat' },
      );
      assert.equal(refund.status, 201, JSON.stringify(refund.body));

      // Sent to Razorpay but not processed yet: a refund that could still
      // fail is not enough to close the exception for good
      const tooEarly = await finance.request('POST', path, {
        resolution: 'REFUNDED',
        note: 'Refund requested',
      });
      assert.equal(tooEarly.status, 400);
      await server.db.query(
        `UPDATE payment_refunds SET status = 'PROCESSED', processed_at = $2
         WHERE payment_id = $1`,
        [duplicate.payment_id, new Date(nowMs).toISOString()],
      );

      const resolved = await finance.request('POST', path, {
        resolution: 'REFUNDED',
        note: 'Full refund sent through the refunds desk',
      });
      assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
      assert.equal(resolved.body.exception.resolution, 'REFUNDED');
    });

    it('lets the buyer check out again once their exception is resolved', async () => {
      // Found in review: any captured payment on the seat blocked the buyer
      // for good, even after staff closed the case
      const fixture = await latePaymentForFullBatch('reopened');
      const resolved = await finance.request(
        'POST',
        `/api/finance/payment-exceptions/${fixture.exceptionId}/resolve`,
        { resolution: 'NO_ACTION', note: 'Student will choose another batch' },
      );
      assert.equal(resolved.status, 200);
      await setCapacity(5);
      const again = await server
        .createClient()
        .request('POST', '/api/payments/checkout', {
          kind: 'ENROLMENT',
          batchId: BATCH,
          fullName: 'Seat Buyer',
          email: 'reopened.late@example.com',
          mobile: '+91 98765 43210',
          state: 'Rajasthan',
          city: 'Jaipur',
          customerType: 'INDIVIDUAL',
          addressLine1: '12 Civil Lines',
          pinCode: '302006',
        });
      assert.equal(again.status, 201, JSON.stringify(again.body));
    });

    it('never gives away the seat of someone holding it when staff decide', async () => {
      // Found in review: confirming a late payer while another student held
      // the last seat bumped the holder when they paid on time
      await emptyBatch();
      await setCapacity(1);
      const late = await checkout('bump.late@example.com');
      nowMs += 40 * MINUTE_MS;
      const holder = await checkout('bump.holder@example.com');
      await capture(late, 'pay_bump_late');
      const [exception] = await exceptionsFor(late.paymentId);

      const decision = await finance.request(
        'POST',
        `/api/finance/payment-exceptions/${String(exception.id)}/resolve`,
        { resolution: 'SEAT_CONFIRMED', note: 'Extra seat' },
      );
      assert.equal(decision.status, 400, 'the holder still has the seat');

      nowMs += 2 * MINUTE_MS;
      await capture(holder, 'pay_bump_holder');
      assert.deepEqual(await paymentState(holder.paymentId), {
        payment: 'PAID',
        seat: 'CONFIRMED',
      });
      assert.equal((await exceptionsFor(holder.paymentId)).length, 0);
    });

    it('will not confirm a seat in a batch that has since closed, even with room', async () => {
      const fixture = await latePaymentForFullBatch('closedlater');
      await setCapacity(5);
      await setBatchStatus('INACTIVE');
      try {
        const decision = await finance.request(
          'POST',
          `/api/finance/payment-exceptions/${fixture.exceptionId}/resolve`,
          { resolution: 'SEAT_CONFIRMED', note: 'Seat anyway' },
        );
        assert.equal(decision.status, 400);
        assert.match(decision.body.message, /no longer open/);
      } finally {
        await setBatchStatus('OPEN');
      }
      assert.equal(
        (await paymentState(fixture.paymentId)).seat,
        'PENDING_PAYMENT',
      );
    });

    it('will not confirm a seat that another payment has since confirmed', async () => {
      const fixture = await latePaymentForFullBatch('stale');
      await server.db.query(
        `UPDATE enrolments SET status = 'CONFIRMED'
         WHERE id = (SELECT enrolment_id FROM payments WHERE id = $1)`,
        [fixture.paymentId],
      );
      const stale = await finance.request(
        'POST',
        `/api/finance/payment-exceptions/${fixture.exceptionId}/resolve`,
        { resolution: 'SEAT_CONFIRMED', note: 'Seat anyway' },
      );
      assert.equal(stale.status, 400);
      assert.equal(stale.body.code, 'PAYMENT_EXCEPTION_RESOLUTION_INVALID');
    });

    it('will not confirm a seat for a payment that has a refund', async () => {
      const fixture = await latePaymentForFullBatch('refunded');
      const refund = await finance.request(
        'POST',
        `/api/finance/payments/${fixture.paymentId}/refunds`,
        { reason: 'Batch was full' },
      );
      assert.equal(refund.status, 201);
      const refunded = await finance.request(
        'POST',
        `/api/finance/payment-exceptions/${fixture.exceptionId}/resolve`,
        { resolution: 'SEAT_CONFIRMED', note: 'Seat anyway' },
      );
      assert.equal(refunded.status, 400);
      assert.equal(
        (await paymentState(fixture.paymentId)).seat,
        'PENDING_PAYMENT',
      );
    });

    it('answers 404 for an unknown exception', async () => {
      const response = await finance.request(
        'POST',
        '/api/finance/payment-exceptions/pex_unknown/resolve',
        { resolution: 'NO_ACTION', note: 'Nothing to do' },
      );
      assert.equal(response.status, 404);
    });
  });
});
