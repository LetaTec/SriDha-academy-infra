import type { DatabaseClient, Row } from '../../db/client.js';

// Every order with the account, seat and topic it was for, newest first
export const listOrderRows = (db: DatabaseClient, limit: number) =>
  db.all<Row>(
    `SELECT p.id, p.created_at, p.status, p.provider, p.amount_paise,
            p.provider_order_id, p.provider_payment_id, p.billing_name,
            p.billing_email, p.billing_mobile, u.email AS account_email,
            p.enrolment_id, b.name AS batch_name,
            COALESCE(enrolled.title, registered.title) AS topic_title,
            COALESCE(e.status, r.status) AS seat_status
     FROM payments p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN enrolments e ON e.id = p.enrolment_id
     LEFT JOIN batches b ON b.id = e.batch_id
     LEFT JOIN topics enrolled ON enrolled.id = b.topic_id
     LEFT JOIN pre_registrations r ON r.id = p.pre_registration_id
     LEFT JOIN topics registered ON registered.id = r.topic_id
     ORDER BY p.created_at DESC
     LIMIT $1`,
    [limit],
  );
