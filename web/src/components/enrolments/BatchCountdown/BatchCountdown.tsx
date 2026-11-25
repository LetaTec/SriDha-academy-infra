import cx from 'classnames/bind';

import { Text } from '@components/ui/Text/Text';
import { MY_BATCHES_TEXT as TEXT } from '@constants/catalogue';
import { splitCountdown } from '@utils/date';

import styles from './BatchCountdown.module.css';

const cn = cx.bind(styles);

export type BatchCountdownProps = {
  // What is counted down to, e.g. "Class starts in"
  label: string;
  secondsLeft: number;
};

// Days, hours, minutes and seconds to a batch's next class, in boxes
export const BatchCountdown = ({ label, secondsLeft }: BatchCountdownProps) => {
  const parts = splitCountdown(secondsLeft);
  const units = [
    { value: parts.days, unit: TEXT.units.days },
    { value: parts.hours, unit: TEXT.units.hours },
    { value: parts.minutes, unit: TEXT.units.minutes },
    { value: parts.seconds, unit: TEXT.units.seconds },
  ];

  return (
    <div
      className={cn('countdown')}
      role="timer"
      aria-label={`${label} ${TEXT.countdownLabel(parts)}`}
    >
      <Text as="span" variant="label" className={cn('label')}>
        {label}
      </Text>
      <div className={cn('units')} aria-hidden="true">
        {units.map(({ value, unit }) => (
          <span key={unit} className={cn('unit')}>
            <span className={cn('value')}>
              {String(value).padStart(2, '0')}
            </span>
            <Text as="span" variant="caption" className={cn('unitName')}>
              {unit}
            </Text>
          </span>
        ))}
      </div>
    </div>
  );
};
