import type { DatabaseClient, Row } from '../../db/client.js';

// Every SQL statement for payments and pre-registrations

// A batch with the topic it belongs to and the topic's fee
export const findBatchForPurchase = (db: DatabaseClient, batchId: string) =>
  db.get<Row>(
    `SELECT b.id, b.name, b.schedule_label, t.id AS t_id, t.title AS t_title,
            t.level AS t_level, t.price_paise AS t_price_paise
     FROM batches b JOIN topics t ON t.id = b.topic_id WHERE b.id = $1`,
    [batchId],
  );

// A topic with its fee and how many batches it has published
export const findTopicForPreRegistration = (
  db: DatabaseClient,
  topicId: string,
) =>
  db.get<Row>(
    `SELECT t.id AS t_id, t.title AS t_title, t.level AS t_level,
            t.price_paise AS t_price_paise,
            (SELECT COUNT(*) FROM batches b WHERE b.topic_id = t.id) AS batch_count
     FROM topics t WHERE t.id = $1`,
    [topicId],
  );

// Pre-registrations

export const findPreRegistration = (
  db: DatabaseClient,
  userId: string,
  topicId: string,
) =>
  db.get<{ id: string; status: string }>(
    'SELECT id, status FROM pre_registrations WHERE user_id = $1 AND topic_id = $2',
    [userId, topicId],
  );

export const insertPreRegistration = (
  db: DatabaseClient,
  preRegistration: {
    id: string;
    userId: string;
    topicId: string;
    status: string;
    timestamp: string;
  },
) =>
  db.query(
    `INSERT INTO pre_registrations (id, user_id, topic_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [
      preRegistration.id,
      preRegistration.userId,
      preRegistration.topicId,
      preRegistration.status,
      preRegistration.timestamp,
    ],
  );

export const setPreRegistrationStatus = (
  db: DatabaseClient,
  preRegistrationId: string,
  status: string,
  timestamp: string,
) =>
  db.query(
    'UPDATE pre_registrations SET status = $1, updated_at = $2 WHERE id = $3',
    [status, timestamp, preRegistrationId],
  );

// The student's pre-registrations with their topic, newest first
export const listPreRegistrationRows = (
  db: DatabaseClient,
  userId: string,
  excludedStatus: string,
) =>
  db.all<Row>(
    `SELECT r.id, r.status, r.created_at, t.id AS t_id, t.title AS t_title,
            t.level AS t_level, t.price_paise AS t_price_paise,
            t.price_tax_label AS t_price_tax_label
     FROM pre_registrations r JOIN topics t ON t.id = r.topic_id
     WHERE r.user_id = $1 AND r.status <> $2
     ORDER BY r.created_at DESC`,
    [userId, excludedStatus],
  );

// Payments

export type NewPayment = {
  id: string;
  userId: string;
  enrolmentId: string | null;
  preRegistrationId: string | null;
  testAttemptId: string | null;
  amountPaise: number;
  currency: string;
  provider: string;
  providerOrderId: string;
  status: string;
  billingName: string;
  billingEmail: string;
  billingMobile: string;
  billingState: string;
  billingCity: string;
  customerType: string;
  addressLine1: string;
  addressLine2: string | null;
  pinCode: string;
  billingStateCode: string;
  businessLegalName: string | null;
  gstin: string | null;
  gstinStateCode: string | null;
  gstinCheck: string | null;
  purchaseOrderReference: string | null;
  itemDescription: string;
  itemTopicId: string;
  itemBatchId: string | null;
  unitPricePaise: number;
  timestamp: string;
};

// A new payment's tax treatment is PENDING_CONFIGURATION (the column's
// default) until an approved tax rule exists
export const insertPayment = (db: DatabaseClient, payment: NewPayment) =>
  db.query(
    `INSERT INTO payments (id, user_id, enrolment_id, pre_registration_id, test_attempt_id, amount_paise, currency,
       provider, provider_order_id, status, billing_name, billing_email, billing_mobile,
       billing_state, billing_city, customer_type, address_line1, address_line2,
       pin_code, billing_state_code, business_legal_name, gstin, gstin_state_code,
       gstin_check, purchase_order_reference, item_description, item_topic_id,
       item_batch_id, unit_price_paise, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
       $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $30)`,
    [
      payment.id,
      payment.userId,
      payment.enrolmentId,
      payment.preRegistrationId,
      payment.testAttemptId,
      payment.amountPaise,
      payment.currency,
      payment.provider,
      payment.providerOrderId,
      payment.status,
      payment.billingName,
      payment.billingEmail,
      payment.billingMobile,
      payment.billingState,
      payment.billingCity,
      payment.customerType,
      payment.addressLine1,
      payment.addressLine2,
      payment.pinCode,
      payment.billingStateCode,
      payment.businessLegalName,
      payment.gstin,
      payment.gstinStateCode,
      payment.gstinCheck,
      payment.purchaseOrderReference,
      payment.itemDescription,
      payment.itemTopicId,
      payment.itemBatchId,
      payment.unitPricePaise,
      payment.timestamp,
    ],
  );

export const findPaymentById = (db: DatabaseClient, paymentId: string) =>
  db.get<Row>('SELECT * FROM payments WHERE id = $1', [paymentId]);

// Adds a passwordless student record for a billing email seen for the
// first time; an email that already has one is left as it is
export const insertBuyerIfNew = (
  db: DatabaseClient,
  buyer: { id: string; email: string; role: string; timestamp: string },
) =>
  db.query(
    `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
     VALUES ($1, $2, NULL, $3, $4, $4)
     ON CONFLICT DO NOTHING`,
    [buyer.id, buyer.email, buyer.role, buyer.timestamp],
  );

export const findPaymentByOrderId = (db: DatabaseClient, orderId: string) =>
  db.get<Row>('SELECT * FROM payments WHERE provider_order_id = $1', [orderId]);

export const setPaymentPaid = (
  db: DatabaseClient,
  paymentId: string,
  status: string,
  providerPaymentId: string,
  timestamp: string,
) =>
  db.query(
    `UPDATE payments SET status = $1, provider_payment_id = $2, updated_at = $3,
       paid_at = $3, paid_at_estimated = false
     WHERE id = $4`,
    [status, providerPaymentId, timestamp, paymentId],
  );

// The payment row locked for this transaction, so concurrent webhooks and
// browser confirmations for the same payment are applied one at a time
export const findPaymentByIdForUpdate = (
  db: DatabaseClient,
  paymentId: string,
) =>
  db.get<Row>('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);

export const findPaymentByOrderIdForUpdate = (
  db: DatabaseClient,
  orderId: string,
) =>
  db.get<Row>(
    'SELECT * FROM payments WHERE provider_order_id = $1 FOR UPDATE',
    [orderId],
  );

export const setPaymentAuthorized = (
  db: DatabaseClient,
  paymentId: string,
  providerPaymentId: string | null,
  timestamp: string,
) =>
  db.query(
    `UPDATE payments SET status = 'AUTHORIZED',
       provider_payment_id = COALESCE($2, provider_payment_id),
       authorized_at = COALESCE(authorized_at, $3), updated_at = $3
     WHERE id = $1`,
    [paymentId, providerPaymentId, timestamp],
  );

export const setPaymentFailed = (
  db: DatabaseClient,
  payment: {
    id: string;
    providerPaymentId: string | null;
    failureCode: string | null;
    failureReason: string | null;
  },
  timestamp: string,
) =>
  db.query(
    `UPDATE payments SET status = 'FAILED',
       provider_payment_id = COALESCE($2, provider_payment_id),
       failure_code = $3, failure_reason = $4, failed_at = $5, updated_at = $5
     WHERE id = $1`,
    [
      payment.id,
      payment.providerPaymentId,
      payment.failureCode,
      payment.failureReason,
      timestamp,
    ],
  );

// The seat a payment is for (an enrolment or a pre-registration)
export const findSeatStatus = async (
  db: DatabaseClient,
  payment: {
    enrolmentId: string | null;
    preRegistrationId: string | null;
    testAttemptId: string | null;
  },
) => {
  const [table, id] = payment.enrolmentId
    ? (['enrolments', payment.enrolmentId] as const)
    : payment.preRegistrationId
      ? (['pre_registrations', payment.preRegistrationId] as const)
      : (['test_attempts', payment.testAttemptId] as const);
  const row = await db.get<{ status: string }>(
    `SELECT status FROM ${table} WHERE id = $1`,
    [id],
  );
  return row ? String(row.status) : null;
};

export type NewPaymentEvent = {
  provider: string;
  source: string;
  eventId: string;
  eventType: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  amountPaise: number | null;
  currency: string | null;
  payload: unknown;
  receivedAt: string;
};

// Stores an event once. Returns the new row's id, or null when this
// provider event id was already stored (a repeated delivery)
export const insertPaymentEvent = async (
  db: DatabaseClient,
  event: NewPaymentEvent,
) => {
  const row = await db.get<{ id: string | number }>(
    `INSERT INTO payment_events (provider, source, event_id, event_type,
       provider_payment_id, provider_order_id, amount_paise, currency, payload,
       outcome, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'RECORDED', $10)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING id`,
    [
      event.provider,
      event.source,
      event.eventId,
      event.eventType,
      event.providerPaymentId,
      event.providerOrderId,
      event.amountPaise,
      event.currency,
      JSON.stringify(event.payload),
      event.receivedAt,
    ],
  );
  return row ? String(row.id) : null;
};

export const setPaymentEventOutcome = (
  db: DatabaseClient,
  eventRowId: string,
  outcome: string,
  paymentId: string | null,
) =>
  db.query(
    'UPDATE payment_events SET outcome = $2, payment_id = $3 WHERE id = $1',
    [eventRowId, outcome, paymentId],
  );

export const findPaymentByProviderPaymentIdForUpdate = (
  db: DatabaseClient,
  providerPaymentId: string,
) =>
  db.get<Row>(
    'SELECT * FROM payments WHERE provider_payment_id = $1 FOR UPDATE',
    [providerPaymentId],
  );

// Refunds

// Pending and processed refunds count against a payment; failed ones do not
export const sumActiveRefunds = async (
  db: DatabaseClient,
  paymentId: string,
) => {
  const row = await db.get<{ total: string | number }>(
    `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM payment_refunds
     WHERE payment_id = $1 AND status <> 'FAILED'`,
    [paymentId],
  );
  return Number(row?.total ?? 0);
};

export const findRefundById = (db: DatabaseClient, refundId: string) =>
  db.get<Row>('SELECT * FROM payment_refunds WHERE id = $1', [refundId]);

// The one lock order for refunds, everywhere: the payment row first, then
// the refund row. The refund trigger (payment_refunds_within_captured) also
// locks the payment, so taking the refund first would invert the order
// against the webhook path and could deadlock.
export const lockRefundWithPayment = async (
  db: DatabaseClient,
  paymentId: string,
  refundId: string,
) => {
  await db.query('SELECT id FROM payments WHERE id = $1 FOR UPDATE', [
    paymentId,
  ]);
  return db.get<Row>(
    'SELECT * FROM payment_refunds WHERE id = $1 AND payment_id = $2 FOR UPDATE',
    [refundId, paymentId],
  );
};

export const findRefundByIdForUpdate = (db: DatabaseClient, refundId: string) =>
  db.get<Row>('SELECT * FROM payment_refunds WHERE id = $1 FOR UPDATE', [
    refundId,
  ]);

// A refund Razorpay has not confirmed after the grace period: a person
// must check the Razorpay dashboard. Its amount stays reserved.
export const markRefundRequiresReview = (
  db: DatabaseClient,
  refund: { id: string; reason: string },
  timestamp: string,
) =>
  db.query(
    `UPDATE payment_refunds
     SET status = 'REQUIRES_REVIEW', review_reason = $2, updated_at = $3
     WHERE id = $1 AND status = 'PENDING'`,
    [refund.id, refund.reason, timestamp],
  );

// Whether a finance exception from this source is already on record for a
// refund, so a recurring job records it once and not on every run
export const hasRefundExceptionFromSource = async (
  db: DatabaseClient,
  refundId: string,
  source: string,
) =>
  Boolean(
    await db.get<Row>(
      `SELECT id FROM finance_audit_log
       WHERE action = 'REFUND_EXCEPTION_RECORDED' AND entity_id = $1
         AND details ->> 'source' = $2
       LIMIT 1`,
      [refundId, source],
    ),
  );

// Unresolved refunds (pending or awaiting review) created before the cutoff
export const listPendingRefundsBefore = (
  db: DatabaseClient,
  cutoffIso: string,
) =>
  db.all<Row & { provider_payment_id: string | null }>(
    `SELECT r.*, p.provider_payment_id
     FROM payment_refunds r
     JOIN payments p ON p.id = r.payment_id
     WHERE r.status IN ('PENDING', 'REQUIRES_REVIEW')
       AND r.provider = 'RAZORPAY'
       AND r.created_at <= $1
     ORDER BY r.created_at ASC`,
    [cutoffIso],
  );

export const findRefundByRequestKey = (
  db: DatabaseClient,
  requestKey: string,
) =>
  db.get<Row>('SELECT * FROM payment_refunds WHERE request_key = $1', [
    requestKey,
  ]);

// The refunds a provider report may describe, by its id or by our receipt.
// Read without locking: the caller locks the payment first and then the one
// refund it settles on, so a report about another payment's refund never
// takes a lock out of order. More than one row means the report cannot be
// tied to a single refund.
export const findRefundsForProvider = (
  db: DatabaseClient,
  providerRefundId: string | null,
  receipt: string | null,
) =>
  db.all<Row>(
    `SELECT * FROM payment_refunds
     WHERE ($1::text IS NOT NULL AND provider_refund_id = $1)
        OR ($2::text IS NOT NULL AND receipt = $2)
     ORDER BY id
     LIMIT 3`,
    [providerRefundId, receipt],
  );

export type NewRefund = {
  id: string;
  paymentId: string;
  provider: string;
  providerRefundId: string | null;
  receipt: string | null;
  requestKey: string | null;
  amountPaise: number;
  currency: string;
  status: string;
  reason: string | null;
  source: string;
  requestedBy: string | null;
  timestamp: string;
};

export const insertRefund = (db: DatabaseClient, refund: NewRefund) =>
  db.query(
    `INSERT INTO payment_refunds (id, payment_id, provider, provider_refund_id,
       receipt, request_key, amount_paise, currency, status, reason, source,
       requested_by, created_at, updated_at, processed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13,
       CASE WHEN $9 = 'PROCESSED' THEN $13::timestamptz END)`,
    [
      refund.id,
      refund.paymentId,
      refund.provider,
      refund.providerRefundId,
      refund.receipt,
      refund.requestKey,
      refund.amountPaise,
      refund.currency,
      refund.status,
      refund.reason,
      refund.source,
      refund.requestedBy,
      refund.timestamp,
    ],
  );

// Records what the provider says about a refund. PROCESSED is final.
// FAILED is final except that Razorpay confirming the refund processed
// overrides it: a failure recorded here (an unclear refusal) must never
// hide money Razorpay actually returned. Nothing moves back to PENDING
// from a final state.
export const updateRefundFromProvider = (
  db: DatabaseClient,
  refund: {
    id: string;
    providerRefundId: string | null;
    status: string;
    failureReason: string | null;
  },
  timestamp: string,
) =>
  db.query(
    `UPDATE payment_refunds SET
       provider_refund_id = COALESCE($2, provider_refund_id),
       status = CASE
         WHEN status = 'PROCESSED' THEN status
         WHEN status = 'FAILED' AND $3 <> 'PROCESSED' THEN status
         ELSE $3 END,
       failure_reason = COALESCE($4, failure_reason),
       processed_at = CASE WHEN status <> 'PROCESSED' AND $3 = 'PROCESSED'
         THEN $5::timestamptz ELSE processed_at END,
       failed_at = CASE WHEN status NOT IN ('PROCESSED', 'FAILED') AND $3 = 'FAILED'
         THEN $5::timestamptz ELSE failed_at END,
       updated_at = $5
     WHERE id = $1`,
    [
      refund.id,
      refund.providerRefundId,
      refund.status,
      refund.failureReason,
      timestamp,
    ],
  );

// Disputes

export type DisputeRecord = {
  id: string;
  paymentId: string;
  provider: string;
  providerDisputeId: string;
  phase: string | null;
  status: string;
  reasonCode: string | null;
  amountPaise: number;
  amountDeductedPaise: number;
  currency: string;
  timestamp: string;
};

// The latest state Razorpay reports for a dispute
export const upsertDispute = (db: DatabaseClient, dispute: DisputeRecord) =>
  db.query(
    `INSERT INTO payment_disputes (id, payment_id, provider, provider_dispute_id,
       phase, status, reason_code, amount_paise, amount_deducted_paise,
       currency, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
     ON CONFLICT (provider_dispute_id) DO UPDATE SET
       phase = COALESCE(EXCLUDED.phase, payment_disputes.phase),
       status = EXCLUDED.status,
       reason_code = COALESCE(EXCLUDED.reason_code, payment_disputes.reason_code),
       amount_paise = EXCLUDED.amount_paise,
       amount_deducted_paise = EXCLUDED.amount_deducted_paise,
       updated_at = EXCLUDED.updated_at`,
    [
      dispute.id,
      dispute.paymentId,
      dispute.provider,
      dispute.providerDisputeId,
      dispute.phase,
      dispute.status,
      dispute.reasonCode,
      dispute.amountPaise,
      dispute.amountDeductedPaise,
      dispute.currency,
      dispute.timestamp,
    ],
  );

// Expiry

// Payments still waiting for money, created before the cutoff
export const listUnsettledPaymentsBefore = (
  db: DatabaseClient,
  cutoff: string,
) =>
  db.all<Row>(
    `SELECT id, provider, provider_order_id FROM payments
     WHERE status IN ('CREATED', 'AUTHORIZED') AND created_at < $1
     ORDER BY created_at
     LIMIT 500`,
    [cutoff],
  );

// Marks a payment expired, only if it is still waiting for money
export const setPaymentExpired = async (
  db: DatabaseClient,
  paymentId: string,
  timestamp: string,
) => {
  const result = await db.query(
    `UPDATE payments SET status = 'EXPIRED', expired_at = $2, updated_at = $2
     WHERE id = $1 AND status IN ('CREATED', 'AUTHORIZED')`,
    [paymentId, timestamp],
  );
  return (result.rowCount ?? 0) > 0;
};

// What the confirmation email needs: who paid, how much and for what
export const findPaymentConfirmationRow = (
  db: DatabaseClient,
  paymentId: string,
) =>
  db.get<Row>(
    `SELECT p.id, p.billing_name, p.billing_email, p.amount_paise,
            p.provider_payment_id, b.name AS batch_name,
            COALESCE(enrolled.title, registered.title, tested.title) AS topic_title
     FROM payments p
     LEFT JOIN enrolments e ON e.id = p.enrolment_id
     LEFT JOIN batches b ON b.id = e.batch_id
     LEFT JOIN topics enrolled ON enrolled.id = b.topic_id
     LEFT JOIN pre_registrations r ON r.id = p.pre_registration_id
     LEFT JOIN topics registered ON registered.id = r.topic_id
     LEFT JOIN test_attempts a ON a.id = p.test_attempt_id
     LEFT JOIN topics tested ON tested.id = a.topic_id
     WHERE p.id = $1`,
    [paymentId],
  );

// A topic, for buying an attempt at its test
export const findTopicForTest = (db: DatabaseClient, topicId: string) =>
  db.get<Row>(
    `SELECT t.id AS t_id, t.title AS t_title, t.level AS t_level
     FROM topics t
     WHERE t.id = $1`,
    [topicId],
  );
