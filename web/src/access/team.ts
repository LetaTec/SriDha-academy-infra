import { USER_ROLE, type UserRole } from '@constants/auth';
import type { AuthContextValue } from '@context/AuthContext';

const PAYMENT_VIEWERS: readonly UserRole[] = [
  USER_ROLE.superAdmin,
  USER_ROLE.financeAdmin,
];

// Super and finance admins see orders and payments (the API's viewPayments
// permission). This only shapes the screens; the API checks again.
export const canViewTeamOrders = (auth: AuthContextValue) =>
  auth.user ? PAYMENT_VIEWERS.includes(auth.user.role) : false;

export const canViewRefunds = (auth: AuthContextValue) =>
  auth.user ? PAYMENT_VIEWERS.includes(auth.user.role) : false;

export const canManageRefunds = (auth: AuthContextValue) =>
  auth.user ? PAYMENT_VIEWERS.includes(auth.user.role) : false;
