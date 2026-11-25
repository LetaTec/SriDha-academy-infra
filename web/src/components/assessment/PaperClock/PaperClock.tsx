import { createContext } from 'react';
import cx from 'classnames/bind';

import { Text } from '@components/ui/Text/Text';
import { SAMPLE_TEST_TEXT as TEXT } from '@constants/assessment';
import { formatCountdown } from '@utils/date';

import styles from './PaperClock.module.css';

const cn = cx.bind(styles);

export type PaperClockState = {
  secondsLeft: number;
  hasTimedOut: boolean;
};

// The answers below a paper's header report their clock here, so the
// header can show it while the questions scroll
export const PaperClockContext = createContext<
  (state: PaperClockState) => void
>(() => undefined);

export type PaperClockProps = {
  state: PaperClockState;
  // Smaller, e.g. on the header's "Continue your paper" card
  size?: 'md' | 'sm';
};

// A paper's clock: bold red, counting down
export const PaperClock = ({ state, size = 'md' }: PaperClockProps) => (
  <span className={cn('clock', size)} role="timer" aria-live="off">
    <Text as="span" variant="label" className={cn('label')}>
      {state.hasTimedOut ? TEXT.timeUp : TEXT.timeLeftLabel}
    </Text>
    {state.hasTimedOut ? null : (
      <span className={cn('time')}>{formatCountdown(state.secondsLeft)}</span>
    )}
  </span>
);
