import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTodayTeamLogins } from '@hooks/useTodayTeamLogins';

import { TodayLoginsPanel } from './TodayLoginsPanel';

vi.mock('@hooks/useTodayTeamLogins', () => ({
  useTodayTeamLogins: vi.fn(),
}));

describe('TodayLoginsPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows today's account sign-ins and account types", () => {
    vi.mocked(useTodayTeamLogins).mockReturnValue({
      logins: [
        {
          email: 'student@example.com',
          role: 'STUDENT',
          startedAt: '2026-10-10T09:00:00.000Z',
        },
      ],
      isLoading: false,
      hasError: false,
      reload: vi.fn(),
    });

    render(<TodayLoginsPanel />);

    const table = screen.getByRole('table', {
      name: 'Accounts that signed in today, newest first',
    });
    expect(within(table).getByText('student@example.com')).toBeInTheDocument();
    expect(within(table).getByText('Student')).toBeInTheDocument();
  });
});
