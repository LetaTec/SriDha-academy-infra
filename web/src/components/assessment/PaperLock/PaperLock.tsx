import { useState } from 'react';
import cx from 'classnames/bind';

import {
  AccountDialog,
  type AccountMode,
} from '@components/auth/AccountDialog/AccountDialog';
import { Button } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import { ACCOUNT_TEXT as TEXT } from '@constants/auth';

import styles from './PaperLock.module.css';

const cn = cx.bind(styles);

export type PaperLockProps = {
  // Wide papers are tall, so the card stays in view while the page scrolls
  layout: 'compact' | 'wide';
};

// Lies over a paper's questions for visitors: a heavy blur, and in the
// middle, sign up or log in to start the test.
export const PaperLock = ({ layout }: PaperLockProps) => {
  const [mode, setMode] = useState<AccountMode | null>(null);

  return (
    <div className={cn('lock', layout)}>
      <section className={cn('card')} aria-label={TEXT.lockLabel}>
        <Heading level={3} variant="item">
          {TEXT.lockTitle}
        </Heading>
        <Text as="p" variant="small" tone="muted">
          {TEXT.lockLead}
        </Text>
        <div className={cn('actions')}>
          <Button endIcon="arrowRight" onClick={() => setMode('signUp')}>
            {TEXT.lockSignUp}
          </Button>
          <Button variant="secondary" onClick={() => setMode('signIn')}>
            {TEXT.lockLogIn}
          </Button>
        </div>
      </section>
      {/* A new dialog for each choice, so it opens on that form */}
      <AccountDialog
        key={mode ?? 'closed'}
        open={mode !== null}
        initialMode={mode ?? 'signUp'}
        onClose={() => setMode(null)}
      />
    </div>
  );
};
