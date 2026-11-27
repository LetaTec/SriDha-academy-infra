import type { DatabaseClient, Row } from '../../db/client.js';

// Every SQL statement for payment exceptions: captured payments that could
// not simply confirm their seat (see payments.lifecycle.ts)

const SELECT_EXCEPTION = `
  SELECT x.id, x.payment_id, x.provider_payment_id, x.kind, x.status,
         x.details, x.created_at, x.resolution, x.resolution_note,
         x.resolved_by, x.resolved_at,
         p.amount_paise, p.billing_email, p.item_description,
         p.enrolment_id, p.pre_registration_id
  FROM payment_exceptions x
  JOIN payments p ON p.id = x.payment_id`;

export const listPaymentExceptionRows = (
  db: DatabaseClient,
  status: 'OPEN' | 'RESOLVED' | null,
  limit: number,
  offset: number,
) =>
  db.all<Row>(
    `${SELECT_EXCEPTION}
     WHERE ($1::text IS NULL OR x.status = $1::text)
     ORDER BY x.created_at DESC, x.id
     LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );

export const findPaymentExceptionForUpdate = (tx: DatabaseClient, id: string) =>
  tx.get<Row>(`${SELECT_EXCEPTION} WHERE x.id = $1 FOR UPDATE OF x`, [id]);

export const findPaymentExceptionRow = (db: DatabaseClient, id: string) =>
  db.get<Row>(`${SELECT_EXCEPTION} WHERE x.id = $1`, [id]);

// Refund totals for a payment: processed (the money is back with the
// buyer, confirmed by Razorpay) and any not failed (pending, under review
// or processed)
export const sumRefunds = async (tx: DatabaseClient, paymentId: string) => {
  const row = await tx.get<{
    processed: string | number | null;
    active: string | number | null;
  }>(
    `SELECT
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'PROCESSED'), 0) AS processed,
       COALESCE(SUM(amount_paise) FILTER (WHERE status <> 'FAILED'), 0) AS active
     FROM payment_refunds WHERE payment_id = $1`,
    [paymentId],
  );
  return {
    processed: Number(row?.processed ?? 0),
    active: Number(row?.active ?? 0),
  };
};

// Locks the payment an exception is about, first: the order capture and
// refund requests use (payment, then batch, then seat)
export const lockPayment = (tx: DatabaseClient, paymentId: string) =>
  tx.query('SELECT id FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);

// The batch of a seat (to lock it before the seat)
export const findBatchIdOfEnrolment = async (
  tx: DatabaseClient,
  enrolmentId: string,
) => {
  const row = await tx.get<{ batch_id: string }>(
    'SELECT batch_id FROM enrolments WHERE id = $1',
    [enrolmentId],
  );
  return row ? String(row.batch_id) : null;
};

// The seat a full-batch exception is about, locked
export const findEnrolmentStatusForUpdate = async (
  tx: DatabaseClient,
  enrolmentId: string,
) => {
  const row = await tx.get<{ status: string }>(
    'SELECT status FROM enrolments WHERE id = $1 FOR UPDATE',
    [enrolmentId],
  );
  return row ? String(row.status) : null;
};

export const markPaymentExceptionResolved = (
  tx: DatabaseClient,
  resolution: {
    id: string;
    resolution: string;
    note: string;
    resolvedBy: string;
    resolvedAt: string;
  },
) =>
  tx.query(
    `UPDATE payment_exceptions
     SET status = 'RESOLVED', resolution = $2, resolution_note = $3,
         resolved_by = $4, resolved_at = $5
     WHERE id = $1 AND status = 'OPEN'`,
    [
      resolution.id,
      resolution.resolution,
      resolution.note,
      resolution.resolvedBy,
      resolution.resolvedAt,
    ],
  );
