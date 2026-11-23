import { useState } from 'react';
import cx from 'classnames/bind';

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

type AccountMode = 'signUp' | 'signIn';

export type AccountDialogProps = {
  open: boolean;
  onClose: () => void;
  // Runs once the student is signed in, e.g. to record the answer they
  // clicked
  onSignedIn?: (user: AuthUser) => void;
};

// Create an account (name, email, password) or sign in to one. Opens on
// sign-up; a link switches to sign-in for students coming back.
export const AccountDialog = ({
  open,
  onClose,
  onSignedIn,
}: AccountDialogProps) => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<AccountMode>('signUp');
  const isSignUp = mode === 'signUp';

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
      eyebrow={isSignUp ? TEXT.signUpEyebrow : TEXT.signInEyebrow}
      title={
        <>
          {isSignUp ? TEXT.signUpTitle : TEXT.signInTitle}
          <br />
          <em>
            {isSignUp ? TEXT.signUpTitleEmphasis : TEXT.signInTitleEmphasis}
          </em>
        </>
      }
    >
      <div className={cn('body')}>
        <Text as="p" tone="muted">
          {isSignUp ? TEXT.signUpLead : TEXT.signInLead}
        </Text>
        {/* A new form for each mode, so nothing typed carries over */}
        {isSignUp ? (
          <SignUpForm
            key="signUp"
            onSignedUp={user =>
              finish(user, TEXT.signedUpToast(user.name ?? user.email))
            }
          />
        ) : (
          <SignInForm
            key="signIn"
            onSignedIn={user => finish(user, TEXT.signedInToast)}
          />
        )}
        <Text as="p" variant="small" tone="muted" className={cn('switch')}>
          {isSignUp ? TEXT.haveAccount : TEXT.noAccount}{' '}
          <Button
            variant="plain"
            onClick={() => setMode(isSignUp ? 'signIn' : 'signUp')}
          >
            {isSignUp ? TEXT.switchToSignIn : TEXT.switchToSignUp}
          </Button>
        </Text>
      </div>
    </Modal>
  );
};
