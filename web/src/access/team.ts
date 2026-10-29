import { USER_ROLE } from '@constants/auth';
import type { AuthContextValue } from '@context/AuthContext';

// Only super admins see orders and payments. The API checks again.
export const canViewTeamOrders = (auth: AuthContextValue) =>
  auth.user?.role === USER_ROLE.superAdmin;
