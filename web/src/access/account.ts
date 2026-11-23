import { USER_ROLE } from '@constants/auth';
import type { AuthContextValue } from '@context/AuthContext';

// Students sign in with a password and can change it; the team signs in
// with emailed links and has none. The API checks again.
export const canChangePassword = (auth: AuthContextValue) =>
  auth.user?.role === USER_ROLE.student;
