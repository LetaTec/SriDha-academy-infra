import { USER_ROLE } from '@constants/auth';
import { FEATURES } from '@constants/features';
import type { AuthContextValue } from '@context/AuthContext';

// Students sign in with a password and can change it; the team signs in
// with emailed links and has none. The API checks again.
export const canChangePassword = (auth: AuthContextValue) =>
  auth.user?.role === USER_ROLE.student;

// The header's profile button: for everyone while student accounts are on;
// otherwise only for a signed-in team member, to sign out
export const canSeeProfileMenu = (auth: AuthContextValue) =>
  FEATURES.studentAccounts || auth.status === 'authenticated';
