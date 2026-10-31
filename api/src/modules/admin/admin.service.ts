import type { AppContext } from '../../app/context.js';
import { listOrderRows } from './admin.repository.js';
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
  const rows = await listOrderRows(db, ORDER_LIMIT);

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
