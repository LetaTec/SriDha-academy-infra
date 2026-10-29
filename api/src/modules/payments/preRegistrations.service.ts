import type { AppContext } from '../../app/context.js';
import {
  toPrice,
  type Price,
  type Row,
} from '../catalogue/catalogue.repository.js';
import { PRE_REGISTRATION_STATUS } from './payments.service.js';

export type PreRegistration = {
  id: string;
  status: (typeof PRE_REGISTRATION_STATUS)[keyof typeof PRE_REGISTRATION_STATUS];
  createdAt: string;
  topic: {
    id: string;
    title: string;
    level: string | null;
    price: Price | null;
  };
};

// The signed-in student's pre-registrations, newest first
export const listPreRegistrations = async (
  { db }: AppContext,
  userId: string,
): Promise<PreRegistration[]> => {
  const rows = await db.all<Row>(
    `SELECT r.id, r.status, r.created_at, t.id AS t_id, t.title AS t_title,
            t.level AS t_level, t.price_paise AS t_price_paise,
            t.price_tax_label AS t_price_tax_label
     FROM pre_registrations r JOIN topics t ON t.id = r.topic_id
     WHERE r.user_id = $1 AND r.status <> $2
     ORDER BY r.created_at DESC`,
    [userId, PRE_REGISTRATION_STATUS.cancelled],
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
