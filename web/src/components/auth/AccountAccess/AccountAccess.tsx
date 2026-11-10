import { useState } from 'react';
import cx from 'classnames/bind';

import { ForgotPasswordForm } from '@components/auth/ForgotPasswordForm/ForgotPasswordForm';
import { LoginForm } from '@components/auth/LoginForm/LoginForm';
import { RegisterForm } from '@components/auth/RegisterForm/RegisterForm';
import { Button } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import {
  ACCOUNT_ACCESS_TEXT,
  AUTH_TEXT,
  AUTH_VIEW,
  type AuthView,
} from '@constants/auth';
import { useAuth } from '@context/AuthContext';
import { useToast } from '@context/ToastContext';
import type { AuthUser } from '@services/auth';

import styles from './AccountAccess.module.css';

const cn = cx.bind(styles);

const VIEW_HEADING: Record<AuthView, string> = {
  [AUTH_VIEW.login]: ACCOUNT_ACCESS_TEXT.loginHeading,
  [AUTH_VIEW.register]: ACCOUNT_ACCESS_TEXT.registerHeading,
  [AUTH_VIEW.forgotPassword]: ACCOUNT_ACCESS_TEXT.forgotHeading,
};

export type AccountAccessProps = {
  // Shown under the heading, for example why the account is needed
  note?: string;
};

// Sign in, register or reset a password in place, without leaving the page.
// Used only where an account is needed (paying, and a student's own seats);
// once signed in, the surrounding page carries on with the new session.
export const AccountAccess = ({ note }: AccountAccessProps) => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState<AuthView>(AUTH_VIEW.login);

  const handleAuthenticated = (user: AuthUser) => {
    login(user);
    showToast(
      view === AUTH_VIEW.register
        ? AUTH_TEXT.registeredToast
        : AUTH_TEXT.loggedInToast,
    );
  };

  return (
    <div className={cn('access')}>
      <div className={cn('head')}>
        <Heading level={3} variant="item">
          {VIEW_HEADING[view]}
        </Heading>
        {note ? (
          <Text as="p" variant="small" tone="muted">
            {note}
          </Text>
        ) : null}
      </div>

      {view === AUTH_VIEW.login ? (
        <LoginForm
          onAuthenticated={handleAuthenticated}
          onForgotPassword={() => setView(AUTH_VIEW.forgotPassword)}
        />
      ) : null}
      {view === AUTH_VIEW.register ? (
        <RegisterForm
          onAuthenticated={handleAuthenticated}
          onSwitchToLogin={() => setView(AUTH_VIEW.login)}
        />
      ) : null}
      {view === AUTH_VIEW.forgotPassword ? (
        <ForgotPasswordForm onBackToLogin={() => setView(AUTH_VIEW.login)} />
      ) : null}

      {view !== AUTH_VIEW.forgotPassword ? (
        <div className={cn('switch')}>
          <Text variant="small" tone="muted">
            {view === AUTH_VIEW.login
              ? AUTH_TEXT.noAccountPrompt
              : AUTH_TEXT.haveAccountPrompt}
          </Text>
          <Button
            variant="editorial"
            onClick={() =>
              setView(
                view === AUTH_VIEW.login ? AUTH_VIEW.register : AUTH_VIEW.login,
              )
            }
          >
            {view === AUTH_VIEW.login
              ? ACCOUNT_ACCESS_TEXT.registerSwitch
              : ACCOUNT_ACCESS_TEXT.loginSwitch}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
