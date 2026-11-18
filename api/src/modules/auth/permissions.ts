import type { RequestHandler } from 'express';

import type { AppContext } from '../../app/context.js';
import type { UserRole } from '../../contracts/auth.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { findUserRole } from './auth.repository.js';
import { toUserRole, USER_ROLE } from './roles.js';
import { getRequiredAuth } from './session.js';

// Who may do what. Checked on the server for every request (the website's
// own checks only shape the screens). The role is read from the database
// each time, so a role removed from configuration stops working at the next
// start, not when a session happens to expire.
export const PERMISSION = {
  // Orders and payments with full billing details
  viewPayments: [USER_ROLE.superAdmin, USER_ROLE.financeAdmin],
  // Starting refunds and recording finance actions
  manageRefunds: [USER_ROLE.superAdmin, USER_ROLE.financeAdmin],
  // Finance reports and exports
  viewFinanceReports: [USER_ROLE.superAdmin, USER_ROLE.financeAdmin],
  // The append-only audit trail
  viewAuditLog: [USER_ROLE.superAdmin],
  // Recording or revoking the CA's tax configuration approval (one of the
  // two switches for invoicing). Super admins only until the owner decides
  // otherwise.
  manageTaxConfiguration: [USER_ROLE.superAdmin],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSION;

// The signed-in staff member, for audit records
export type StaffActor = { userId: string; role: UserRole };

declare module 'express-serve-static-core' {
  interface Request {
    staff?: StaffActor;
  }
}

// Use after requireAuth. Refuses with 403 unless the account's current role
// holds the permission, and records who is acting on req.staff.
export const requirePermission =
  ({ db }: AppContext, permission: Permission): RequestHandler =>
  async (req, _res, next) => {
    const { userId } = getRequiredAuth(req.auth);
    const role = toUserRole(await findUserRole(db, userId));

    if (!(PERMISSION[permission] as readonly UserRole[]).includes(role)) {
      throw new ApiError(
        403,
        ERROR_CODE.forbidden,
        'Only the SriDha Academy team can see this',
      );
    }

    req.staff = { userId, role };
    next();
  };
