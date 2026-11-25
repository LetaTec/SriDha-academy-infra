import { USER_ROLE } from '@constants/auth';
import type { AuthContextValue } from '@context/AuthContext';

// Students sign in with a password and can change it; the team signs in
// with emailed links and has none. The API checks again.
export const canChangePassword = (auth: AuthContextValue) =>
  auth.user?.role === USER_ROLE.student;

// A student's own batches, under the profile menu. The API lists only the
// signed-in account's seats.
export const canViewMyBatches = (auth: AuthContextValue) =>
  auth.user?.role === USER_ROLE.student;
