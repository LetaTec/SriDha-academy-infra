import type { AuthContextValue } from '@context/AuthContext';
import type { AuthUser } from '@services/auth';

import { canChangePassword } from './account';

const auth = (role: AuthUser['role'] | null): AuthContextValue => ({
  status: role ? 'authenticated' : 'anonymous',
  user: role
    ? { id: 'u1', email: 'a@example.com', role, name: null, student: null }
    : null,
  isLoggedIn: role !== null,
  login: () => undefined,
  clearSession: () => undefined,
});

describe('account access', () => {
  it('lets students change their password, but not the team or visitors', () => {
    expect(canChangePassword(auth('STUDENT'))).toBe(true);
    expect(canChangePassword(auth('SUPER_ADMIN'))).toBe(false);
    expect(canChangePassword(auth('FINANCE_ADMIN'))).toBe(false);
    expect(canChangePassword(auth(null))).toBe(false);
  });
});
