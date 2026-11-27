import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import {
  confirmPasswordReset,
  confirmSignUp,
  getCurrentSession,
  requestPasswordReset,
  requestSignUp,
} from '@services/auth/api';

import { AccountDialog } from './AccountDialog';

vi.mock('@services/auth/api', () => ({
  getCurrentSession: vi.fn(),
  logoutStudent: vi.fn(),
  signInStudent: vi.fn(),
  requestSignUp: vi.fn(),
  confirmSignUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

const student = {
  id: 'user_1',
  email: 'meera@example.com',
  role: 'STUDENT' as const,
  name: 'Meera Iyer',
  student: null,
};

const type = (field: HTMLElement, value: string) =>
  fireEvent.change(field, { target: { value } });

describe('AccountDialog', () => {
  it('creates an account only after the emailed code is confirmed', async () => {
    vi.mocked(getCurrentSession).mockRejectedValue(new Error('signed out'));
    vi.mocked(requestSignUp).mockResolvedValue(undefined);
    vi.mocked(confirmSignUp).mockResolvedValue(student);
    const onSignedIn = vi.fn();
    const onClose = vi.fn();

    render(
      <ToastProvider>
        <AuthProvider>
          <AccountDialog open onClose={onClose} onSignedIn={onSignedIn} />
        </AuthProvider>
      </ToastProvider>,
    );
    const dialog = screen.getByRole('dialog');

    type(within(dialog).getByLabelText('Full name'), 'Meera Iyer');
    type(within(dialog).getByLabelText('Email ID'), 'meera@example.com');
    type(within(dialog).getByLabelText('Create a password'), 'correct-horse-1');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Create account' }),
      );
    });
    expect(requestSignUp).toHaveBeenCalledWith({
      fullName: 'Meera Iyer',
      email: 'meera@example.com',
      password: 'correct-horse-1',
    });
    // Not signed in yet: the dialog asks for the code
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText(/sent to meera@example\.com/),
    ).toBeInTheDocument();

    // A wrong-looking code is caught before anything is sent
    type(within(dialog).getByLabelText('6-digit code'), '12ab');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Confirm and sign in' }),
      );
    });
    expect(confirmSignUp).not.toHaveBeenCalled();

    type(within(dialog).getByLabelText('6-digit code'), '042917');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Confirm and sign in' }),
      );
    });
    expect(confirmSignUp).toHaveBeenCalledWith({
      email: 'meera@example.com',
      code: '042917',
      password: 'correct-horse-1',
    });
    expect(onSignedIn).toHaveBeenCalledWith(student);
    expect(onClose).toHaveBeenCalled();
  });

  it('resets a forgotten password with an emailed code and signs the student in', async () => {
    vi.mocked(getCurrentSession).mockRejectedValue(new Error('signed out'));
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);
    vi.mocked(confirmPasswordReset).mockResolvedValue(student);
    const onSignedIn = vi.fn();
    const onClose = vi.fn();

    render(
      <ToastProvider>
        <AuthProvider>
          <AccountDialog open onClose={onClose} onSignedIn={onSignedIn} />
        </AuthProvider>
      </ToastProvider>,
    );
    const dialog = screen.getByRole('dialog');

    // Sign-up first, then sign-in, then "Forgot password?"
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Forgot password?' }),
    );
    expect(
      within(dialog).getByRole('heading', { name: /Choose a new/ }),
    ).toBeInTheDocument();

    type(within(dialog).getByLabelText('Email ID'), 'meera@example.com');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Email me a code' }),
      );
    });
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: 'meera@example.com',
    });
    expect(
      within(dialog).getByText(/sent to meera@example\.com/),
    ).toBeInTheDocument();

    // A wrong-looking code is caught before anything is sent
    type(within(dialog).getByLabelText('6-digit code'), '12ab');
    type(within(dialog).getByLabelText('New password'), 'new-password-2');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', {
          name: 'Set password and sign in',
        }),
      );
    });
    expect(confirmPasswordReset).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText('Enter the 6-digit code from the email'),
    ).toBeInTheDocument();

    type(within(dialog).getByLabelText('6-digit code'), '042917');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', {
          name: 'Set password and sign in',
        }),
      );
    });
    expect(confirmPasswordReset).toHaveBeenCalledWith({
      email: 'meera@example.com',
      code: '042917',
      password: 'new-password-2',
    });
    expect(onSignedIn).toHaveBeenCalledWith(student);
    expect(onClose).toHaveBeenCalled();
  });
});
