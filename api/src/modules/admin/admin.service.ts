import type { AppContext } from '../../app/context.js';
import type { TeamOrder, TeamTodayLogin } from '../../contracts/admin.js';
import { listOrderRows, listTodayLoginRows } from './admin.repository.js';
import { toUserRole } from '../auth/roles.js';
import { CHECKOUT_KIND } from '../payments/payments.service.js';

// The most recent orders the team can see at once
const ORDER_LIMIT = 500;

export type { TeamOrder };

// Every order with who placed it, what for and whether it was paid, newest
// first. Billing details are what the student typed at checkout.
export const listTeamOrders = async ({
  db,
}: AppContext): Promise<TeamOrder[]> => {
  const rows = await listOrderRows(db, ORDER_LIMIT);

  return rows.map(row => ({
    id: String(row.id),
    createdAt: String(row.created_at),
    status: String(row.status) as TeamOrder['status'],
    provider: String(row.provider) as TeamOrder['provider'],
    amountPaise: Number(row.amount_paise),
    providerOrderId: String(row.provider_order_id),
    providerPaymentId:
      row.provider_payment_id === null ? null : String(row.provider_payment_id),
    kind:
      row.enrolment_id !== null
        ? CHECKOUT_KIND.enrolment
        : row.pre_registration_id !== null
          ? CHECKOUT_KIND.preRegistration
          : CHECKOUT_KIND.testAttempt,
    topic: String(row.topic_title),
    batch: row.batch_name === null ? null : String(row.batch_name),
    seatStatus: String(row.seat_status) as TeamOrder['seatStatus'],
    student: {
      accountEmail: String(row.account_email),
      name: String(row.billing_name),
      email: String(row.billing_email),
      mobile: String(row.billing_mobile),
      state: row.billing_state === null ? null : String(row.billing_state),
      city: row.billing_city === null ? null : String(row.billing_city),
    },
  }));
};

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfIndiaDay = (now: Date) => {
  const indiaNow = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(
      indiaNow.getUTCFullYear(),
      indiaNow.getUTCMonth(),
      indiaNow.getUTCDate(),
    ) - IST_OFFSET_MS,
  );
};

export const listTodayTeamLogins = async ({
  db,
  now,
}: AppContext): Promise<TeamTodayLogin[]> => {
  const startAt = startOfIndiaDay(now());
  const endAt = new Date(startAt.getTime() + DAY_MS);
  const rows = await listTodayLoginRows(
    db,
    startAt.toISOString(),
    endAt.toISOString(),
  );

  return rows.map(row => ({
    email: String(row.email),
    role: toUserRole(row.role),
    startedAt:
      row.started_at instanceof Date
        ? row.started_at.toISOString()
        : new Date(String(row.started_at)).toISOString(),
  }));
};
