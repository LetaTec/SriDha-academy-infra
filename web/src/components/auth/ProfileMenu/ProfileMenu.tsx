import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import cx from 'classnames/bind';

import { AccountDialog } from '@components/auth/AccountDialog/AccountDialog';
import { Button } from '@components/ui/Button/Button';
import { IconButton } from '@components/ui/IconButton/IconButton';
import { Text } from '@components/ui/Text/Text';
import { ACCOUNT_TEXT as TEXT } from '@constants/auth';
import { useAuth } from '@context/AuthContext';

import styles from './ProfileMenu.module.css';

const cn = cx.bind(styles);

export type ProfileMenuProps = {
  onSignOut: () => void;
  isSigningOut: boolean;
};

// The profile button in the header. Signed out, it opens sign-up; signed
// in, it shows who is signed in and a way to sign out.
export const ProfileMenu = ({ onSignOut, isSigningOut }: ProfileMenuProps) => {
  const { status, user } = useAuth();
  const location = useLocation();
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, status]);

  // Escape or a click elsewhere closes the panel
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  if (status !== 'authenticated' || !user) {
    return (
      <>
        <IconButton
          icon="profile"
          size="lg"
          label={TEXT.signInLabel}
          disabled={status === 'loading'}
          onClick={() => setIsAccountOpen(true)}
        />
        <AccountDialog
          open={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
        />
      </>
    );
  }

  return (
    <div ref={wrapperRef} className={cn('wrapper')}>
      <IconButton
        icon="profile"
        size="lg"
        label={TEXT.profileLabel}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={cn({ active: isOpen })}
        onClick={() => setIsOpen(open => !open)}
      />
      {isOpen ? (
        <div id={panelId} className={cn('panel')}>
          <div className={cn('who')}>
            {user.name ? <Text variant="strong">{user.name}</Text> : null}
            <Text variant="small" tone="muted" className={cn('email')}>
              {user.email}
            </Text>
          </div>
          <Button
            variant="secondary"
            loading={isSigningOut}
            onClick={onSignOut}
          >
            {TEXT.signOut}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
