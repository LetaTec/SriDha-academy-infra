import { useState } from 'react';
import cx from 'classnames/bind';

import { ResetPasswordForm } from '@components/auth/ResetPasswordForm/ResetPasswordForm';
import { SignInForm } from '@components/auth/SignInForm/SignInForm';
import { SignUpForm } from '@components/auth/SignUpForm/SignUpForm';
import { Button } from '@components/ui/Button/Button';
import { Modal } from '@components/ui/Modal/Modal';
import { Text } from '@components/ui/Text/Text';
import { ACCOUNT_TEXT as TEXT } from '@constants/auth';
import { useAuth } from '@context/AuthContext';
import { useToast } from '@context/ToastContext';
import type { AuthUser } from '@services/auth';

import styles from './AccountDialog.module.css';

const cn = cx.bind(styles);

type AccountMode = 'signUp' | 'signIn' | 'reset';

// Each mode's heading and lead line
const MODE_HEAD = {
  signUp: {
    eyebrow: TEXT.signUpEyebrow,
    title: TEXT.signUpTitle,
    emphasis: TEXT.signUpTitleEmphasis,
    lead: TEXT.signUpLead,
  },
  signIn: {
    eyebrow: TEXT.signInEyebrow,
    title: TEXT.signInTitle,
    emphasis: TEXT.signInTitleEmphasis,
    lead: TEXT.signInLead,
  },
  reset: {
    eyebrow: TEXT.resetEyebrow,
    title: TEXT.resetTitle,
    emphasis: TEXT.resetTitleEmphasis,
    lead: null,
  },
} as const;

export type AccountDialogProps = {
  open: boolean;
  onClose: () => void;
  // Runs once the student is signed in, e.g. to record the answer they
  // clicked
  onSignedIn?: (user: AuthUser) => void;
};

// Create an account (name, email, password) or sign in to one. Opens on
// sign-up; links switch to sign-in for students coming back, and from there
// to "Forgot password", which emails a 6-digit code.
export const AccountDialog = ({
  open,
  onClose,
  onSignedIn,
}: AccountDialogProps) => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<AccountMode>('signUp');
  const head = MODE_HEAD[mode];

  const handleClose = () => {
    setMode('signUp');
    onClose();
  };

  const finish = (user: AuthUser, message: string) => {
    login(user);
    showToast(message);
    setMode('signUp');
    onSignedIn?.(user);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      eyebrow={head.eyebrow}
      title={
        <>
          {head.title}
          <br />
          <em>{head.emphasis}</em>
        </>
      }
    >
      <div className={cn('body')}>
        {head.lead ? (
          <Text as="p" tone="muted">
            {head.lead}
          </Text>
        ) : null}
        {/* A new form for each mode, so nothing typed carries over */}
        {mode === 'signUp' ? (
          <SignUpForm
            key="signUp"
            onSignedUp={user =>
              finish(user, TEXT.signedUpToast(user.name ?? user.email))
            }
          />
        ) : null}
        {mode === 'signIn' ? (
          <SignInForm
            key="signIn"
            onSignedIn={user => finish(user, TEXT.signedInToast)}
          />
        ) : null}
        {mode === 'reset' ? (
          <ResetPasswordForm
            key="reset"
            onReset={user => finish(user, TEXT.resetToast)}
          />
        ) : null}

        <div className={cn('links')}>
          {mode === 'signIn' ? (
            <Button variant="plain" onClick={() => setMode('reset')}>
              {TEXT.forgotPassword}
            </Button>
          ) : null}
          {mode === 'reset' ? (
            <Button variant="plain" onClick={() => setMode('signIn')}>
              {TEXT.backToSignIn}
            </Button>
          ) : (
            <Text as="p" variant="small" tone="muted" className={cn('switch')}>
              {mode === 'signUp' ? TEXT.haveAccount : TEXT.noAccount}{' '}
              <Button
                variant="plain"
                onClick={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
              >
                {mode === 'signUp' ? TEXT.switchToSignIn : TEXT.switchToSignUp}
              </Button>
            </Text>
          )}
        </div>
      </div>
    </Modal>
  );
};
