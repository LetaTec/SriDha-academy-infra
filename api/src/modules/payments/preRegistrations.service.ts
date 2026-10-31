import type { AppContext } from '../../app/context.js';
import type { PreRegistration } from '../../contracts/payments.js';
import { toPrice } from '../catalogue/catalogue.repository.js';
import { listPreRegistrationRows } from './payments.repository.js';
import { PRE_REGISTRATION_STATUS } from './payments.service.js';

export type { PreRegistration };

// The signed-in student's pre-registrations, newest first
export const listPreRegistrations = async (
  { db }: AppContext,
  userId: string,
): Promise<PreRegistration[]> => {
  const rows = await listPreRegistrationRows(
    db,
    userId,
    PRE_REGISTRATION_STATUS.cancelled,
  );

  return rows.map(row => ({
    id: String(row.id),
    status: row.status as PreRegistration['status'],
    createdAt: String(row.created_at),
    topic: {
      id: String(row.t_id),
      title: String(row.t_title),
      level: row.t_level === null ? null : String(row.t_level),
      price: toPrice(row.t_price_paise, row.t_price_tax_label),
    },
  }));
};
