import type { DatabaseClient, Row } from '../../db/client.js';

export type HistoricalPaymentRow = Row & {
  payment_id: string;
  created_at: string;
  paid_at: string | null;
  paid_at_estimated: boolean;
  status: string;
  amount_paise: number;
  currency: string;
  provider: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  billing_name: string;
  billing_email: string;
  billing_mobile: string;
  billing_state: string | null;
  billing_city: string | null;
  batch_name: string | null;
  topic_title: string | null;
  seat_status: string | null;
  refund_count: number | string;
  refunded_amount_paise: number | string;
  refund_pending_paise: number | string;
  refund_under_review_paise: number | string;
  refund_failed_paise: number | string;
  tax_status: string;
};

export const countHistoricalPayments = async (
  db: DatabaseClient,
  since: Date,
): Promise<number> =>
  Number(
    (
      await db.get<{ n: string | number }>(
        'SELECT COUNT(*) AS n FROM payments WHERE created_at >= $1',
        [since.toISOString()],
      )
    )?.n ?? 0,
  );

// Lists every payment on or after `since` with its current catalogue details
// and refund summary. Read-only.
export const listHistoricalPaymentRows = (
  db: DatabaseClient,
  since: Date,
): Promise<HistoricalPaymentRow[]> =>
  db.all<HistoricalPaymentRow>(
    `SELECT
       p.id AS payment_id,
       p.created_at,
       p.paid_at,
       p.paid_at_estimated,
       p.status,
       p.amount_paise,
       p.currency,
       p.provider,
       p.provider_order_id,
       p.provider_payment_id,
       p.billing_name,
       p.billing_email,
       p.billing_mobile,
       p.billing_state,
       p.billing_city,
       p.tax_status,
       b.name AS batch_name,
       COALESCE(enrolled.title, registered.title, tested.title) AS topic_title,
       COALESCE(e.status, r.status, ta.status) AS seat_status,
       COALESCE(ref.refund_count, 0) AS refund_count,
       COALESCE(ref.refunded_amount_paise, 0) AS refunded_amount_paise,
       COALESCE(ref.refund_pending_paise, 0) AS refund_pending_paise,
       COALESCE(ref.refund_under_review_paise, 0) AS refund_under_review_paise,
       COALESCE(ref.refund_failed_paise, 0) AS refund_failed_paise
     FROM payments p
     LEFT JOIN enrolments e ON e.id = p.enrolment_id
     LEFT JOIN batches b ON b.id = e.batch_id
     LEFT JOIN topics enrolled ON enrolled.id = b.topic_id
     LEFT JOIN pre_registrations r ON r.id = p.pre_registration_id
     LEFT JOIN topics registered ON registered.id = r.topic_id
     LEFT JOIN test_attempts ta ON ta.id = p.test_attempt_id
     LEFT JOIN topics tested ON tested.id = ta.topic_id
     LEFT JOIN (
       SELECT payment_id,
              COUNT(*) AS refund_count,
              COALESCE(SUM(amount_paise) FILTER (WHERE status = 'PROCESSED'), 0) AS refunded_amount_paise,
              COALESCE(SUM(amount_paise) FILTER (WHERE status = 'PENDING'), 0) AS refund_pending_paise,
              COALESCE(SUM(amount_paise) FILTER (WHERE status = 'REQUIRES_REVIEW'), 0) AS refund_under_review_paise,
              COALESCE(SUM(amount_paise) FILTER (WHERE status = 'FAILED'), 0) AS refund_failed_paise
       FROM payment_refunds
       GROUP BY payment_id
     ) ref ON ref.payment_id = p.id
     WHERE p.created_at >= $1
     ORDER BY p.created_at ASC`,
    [since.toISOString()],
  );

// Refund activity finance must resolve by hand: refunds awaiting review,
// and refunds (other than failed ones) on payments not captured here
export const listOpenRefundExceptions = (db: DatabaseClient) =>
  db.all<Row>(
    `SELECT r.id, r.payment_id, r.provider_refund_id, r.receipt,
       r.amount_paise, r.status, r.review_reason, r.created_at,
       p.status AS payment_status, p.provider_payment_id
     FROM payment_refunds r
     JOIN payments p ON p.id = r.payment_id
     WHERE r.status = 'REQUIRES_REVIEW'
        OR (p.status <> 'PAID' AND r.status <> 'FAILED')
     ORDER BY r.created_at DESC
     LIMIT 200`,
  );

// Razorpay refund reports that did not match the refund on record
export const listRefundMismatchReports = (db: DatabaseClient) =>
  db.all<Row>(
    `SELECT id, occurred_at, entity_id, details FROM finance_audit_log
     WHERE action = 'REFUND_EXCEPTION_RECORDED'
     ORDER BY id DESC
     LIMIT 200`,
  );
