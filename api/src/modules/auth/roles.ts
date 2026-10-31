import { randomUUID } from 'node:crypto';

import type { UserRole } from '../../contracts/auth.js';
import { transaction, type Database } from '../../db/client.js';
import {
  findUserIdByEmail,
  insertPasswordlessUser,
  listUsersWithRole,
  setUserRole,
} from './auth.repository.js';

export const USER_ROLE = {
  student: 'STUDENT',
  superAdmin: 'SUPER_ADMIN',
} as const satisfies Record<string, UserRole>;

export type { UserRole };

export const toUserRole = (value: unknown): UserRole =>
  value === USER_ROLE.superAdmin ? USER_ROLE.superAdmin : USER_ROLE.student;

// Makes the database match SUPER_ADMIN_EMAILS on every start: listed emails
// become super admins (an account is created, with no password, if none
// exists) and anyone no longer listed goes back to being a student.
export const syncSuperAdmins = async (
  db: Database,
  emails: readonly string[],
  now: Date,
) => {
  const listed = new Set(emails.map(email => email.toLowerCase()));
  const timestamp = now.toISOString();

  await transaction(db, async tx => {
    const current = await listUsersWithRole(tx, USER_ROLE.superAdmin);

    for (const user of current) {
      if (!listed.has(String(user.email).toLowerCase())) {
        await setUserRole(tx, String(user.id), USER_ROLE.student, timestamp);
      }
    }

    for (const email of listed) {
      const existingId = await findUserIdByEmail(tx, email);

      if (existingId) {
        await setUserRole(tx, existingId, USER_ROLE.superAdmin, timestamp);
      } else {
        await insertPasswordlessUser(tx, {
          id: randomUUID(),
          email,
          role: USER_ROLE.superAdmin,
          timestamp,
        });
      }
    }
  });

  return listed.size;
};
