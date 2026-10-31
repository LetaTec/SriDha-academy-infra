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
  amountPaise: number;
  currency: string;
  provider: string;
  providerOrderId: string;
  status: string;
  billingName: string;
  billingEmail: string;
  billingMobile: string;
  timestamp: string;
};

export const insertPayment = (db: DatabaseClient, payment: NewPayment) =>
  db.query(
    `INSERT INTO payments (id, user_id, enrolment_id, pre_registration_id, amount_paise, currency,
       provider, provider_order_id, status, billing_name, billing_email, billing_mobile,
       created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
    [
      payment.id,
      payment.userId,
      payment.enrolmentId,
      payment.preRegistrationId,
      payment.amountPaise,
      payment.currency,
      payment.provider,
      payment.providerOrderId,
      payment.status,
      payment.billingName,
      payment.billingEmail,
      payment.billingMobile,
      payment.timestamp,
    ],
  );

export const findPaymentForUser = (
  db: DatabaseClient,
  paymentId: string,
  userId: string,
) =>
  db.get<Row>('SELECT * FROM payments WHERE id = $1 AND user_id = $2', [
    paymentId,
    userId,
  ]);

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
    `UPDATE payments SET status = $1, provider_payment_id = $2, updated_at = $3
     WHERE id = $4`,
    [status, providerPaymentId, timestamp, paymentId],
  );

// What the confirmation email needs: who paid, how much and for what
export const findPaymentConfirmationRow = (
  db: DatabaseClient,
  paymentId: string,
) =>
  db.get<Row>(
    `SELECT p.id, p.billing_name, p.billing_email, p.amount_paise,
            p.provider_payment_id, b.name AS batch_name,
            COALESCE(enrolled.title, registered.title) AS topic_title
     FROM payments p
     LEFT JOIN enrolments e ON e.id = p.enrolment_id
     LEFT JOIN batches b ON b.id = e.batch_id
     LEFT JOIN topics enrolled ON enrolled.id = b.topic_id
     LEFT JOIN pre_registrations r ON r.id = p.pre_registration_id
     LEFT JOIN topics registered ON registered.id = r.topic_id
     WHERE p.id = $1`,
    [paymentId],
  );
