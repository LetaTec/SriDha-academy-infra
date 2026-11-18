import { randomUUID } from 'node:crypto';

import type { UserRole } from '../../contracts/auth.js';
import { transaction, type Database } from '../../db/client.js';
import { AUDIT_ACTION, recordAudit } from '../finance/audit.service.js';
import {
  findUserIdByEmail,
  findUserRole,
  insertPasswordlessUser,
  listUsersWithRole,
  setUserRole,
} from './auth.repository.js';

export const USER_ROLE = {
  student: 'STUDENT',
  superAdmin: 'SUPER_ADMIN',
  financeAdmin: 'FINANCE_ADMIN',
  operationsAdmin: 'OPERATIONS_ADMIN',
} as const satisfies Record<string, UserRole>;

export type { UserRole };

// Staff sign in with an emailed one-time link and need no student profile
export const STAFF_ROLES: readonly UserRole[] = [
  USER_ROLE.superAdmin,
  USER_ROLE.financeAdmin,
  USER_ROLE.operationsAdmin,
];

export const isStaffRole = (role: unknown) =>
  STAFF_ROLES.includes(role as UserRole);

export const toUserRole = (value: unknown): UserRole =>
  isStaffRole(value) ? (value as UserRole) : USER_ROLE.student;

export type StaffEmails = {
  superAdminEmails: readonly string[];
  financeAdminEmails: readonly string[];
  operationsAdminEmails: readonly string[];
};

// Makes the database match the staff email lists on every start: listed
// emails get their role (an account is created, with no password, if none
// exists), and staff no longer listed under their role go back to being
// students. Every change is written to the finance audit log, by the
// system, in the same transaction.
export const syncStaffRoles = async (
  db: Database,
  emails: StaffEmails,
  now: Date,
) => {
  const wanted = new Map<string, UserRole>();
  for (const [role, list] of [
    [USER_ROLE.superAdmin, emails.superAdminEmails],
    [USER_ROLE.financeAdmin, emails.financeAdminEmails],
    [USER_ROLE.operationsAdmin, emails.operationsAdminEmails],
  ] as const) {
    for (const email of list) wanted.set(email.toLowerCase(), role);
  }
  const timestamp = now.toISOString();

  await transaction(db, async tx => {
    for (const role of STAFF_ROLES) {
      for (const user of await listUsersWithRole(tx, role)) {
        const email = String(user.email).toLowerCase();
        if (wanted.get(email) !== role) {
          await setUserRole(tx, String(user.id), USER_ROLE.student, timestamp);
          await recordAudit(tx, {
            actor: null,
            action: AUDIT_ACTION.roleRevoked,
            entityType: 'user',
            entityId: String(user.id),
            details: { email, role },
            at: now,
          });
        }
      }
    }

    for (const [email, role] of wanted) {
      let userId = await findUserIdByEmail(tx, email);
      const previous = userId ? await findUserRole(tx, userId) : null;

      if (!userId) {
        userId = randomUUID();
        await insertPasswordlessUser(tx, {
          id: userId,
          email,
          role,
          timestamp,
        });
      } else if (previous !== role) {
        await setUserRole(tx, userId, role, timestamp);
      }

      if (previous !== role) {
        await recordAudit(tx, {
          actor: null,
          action: AUDIT_ACTION.roleGranted,
          entityType: 'user',
          entityId: userId,
          details: { email, role },
          at: now,
        });
      }
    }
  });

  return wanted.size;
};
