import { describe, expect, it } from 'vitest';

import type { UserRole } from '@constants/auth';
import type { AuthContextValue } from '@context/AuthContext';

import { canManageRefunds, canViewRefunds, canViewTeamOrders } from './team';

const signedInAs = (role: UserRole) =>
  ({ user: { role } }) as unknown as AuthContextValue;

describe('canViewTeamOrders', () => {
  it('matches the API: super and finance admins only', () => {
    expect(canViewTeamOrders(signedInAs('SUPER_ADMIN'))).toBe(true);
    expect(canViewTeamOrders(signedInAs('FINANCE_ADMIN'))).toBe(true);
    expect(canViewTeamOrders(signedInAs('OPERATIONS_ADMIN'))).toBe(false);
    expect(canViewTeamOrders(signedInAs('STUDENT'))).toBe(false);
    expect(
      canViewTeamOrders({ user: null } as unknown as AuthContextValue),
    ).toBe(false);
  });
});

describe('canViewRefunds', () => {
  it('allows super and finance admins only', () => {
    expect(canViewRefunds(signedInAs('SUPER_ADMIN'))).toBe(true);
    expect(canViewRefunds(signedInAs('FINANCE_ADMIN'))).toBe(true);
    expect(canViewRefunds(signedInAs('OPERATIONS_ADMIN'))).toBe(false);
    expect(canViewRefunds(signedInAs('STUDENT'))).toBe(false);
    expect(canViewRefunds({ user: null } as unknown as AuthContextValue)).toBe(
      false,
    );
  });
});

describe('canManageRefunds', () => {
  it('allows super and finance admins to resolve refund exceptions', () => {
    expect(canManageRefunds(signedInAs('SUPER_ADMIN'))).toBe(true);
    expect(canManageRefunds(signedInAs('FINANCE_ADMIN'))).toBe(true);
    expect(canManageRefunds(signedInAs('OPERATIONS_ADMIN'))).toBe(false);
    expect(canManageRefunds(signedInAs('STUDENT'))).toBe(false);
    expect(
      canManageRefunds({ user: null } as unknown as AuthContextValue),
    ).toBe(false);
  });
});
