import type { AppContext } from '../../app/context.js';
import type { Row } from '../catalogue/catalogue.repository.js';
import { CHECKOUT_KIND } from '../payments/payments.service.js';

// The most recent orders the team can see at once
const ORDER_LIMIT = 500;

export type TeamOrder = {
  id: string;
  createdAt: string;
  status: string;
  provider: string;
  amountPaise: number;
  providerOrderId: string;
  providerPaymentId: string | null;
  kind: (typeof CHECKOUT_KIND)[keyof typeof CHECKOUT_KIND];
  topic: string;
  batch: string | null;
  seatStatus: string;
  student: {
    accountEmail: string;
    name: string;
    email: string;
    mobile: string;
  };
};

// Every order with who placed it, what for and whether it was paid, newest
// first. Billing details are what the student typed at checkout.
export const listTeamOrders = async ({
  db,
}: AppContext): Promise<TeamOrder[]> => {
  const rows = await db.all<Row>(
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
    [ORDER_LIMIT],
  );

  return rows.map(row => ({
    id: String(row.id),
    createdAt: String(row.created_at),
    status: String(row.status),
    provider: String(row.provider),
    amountPaise: Number(row.amount_paise),
    providerOrderId: String(row.provider_order_id),
    providerPaymentId:
      row.provider_payment_id === null ? null : String(row.provider_payment_id),
    kind:
      row.enrolment_id === null
        ? CHECKOUT_KIND.preRegistration
        : CHECKOUT_KIND.enrolment,
    topic: String(row.topic_title),
    batch: row.batch_name === null ? null : String(row.batch_name),
    seatStatus: String(row.seat_status),
    student: {
      accountEmail: String(row.account_email),
      name: String(row.billing_name),
      email: String(row.billing_email),
      mobile: String(row.billing_mobile),
    },
  }));
};
