import cx from 'classnames/bind';

import { formatBatchSeats } from '@components/catalogue/batchDetails';
import { TutorProfile } from '@components/catalogue/TutorProfile/TutorProfile';
import { Heading } from '@components/ui/Heading/Heading';
import { Icon } from '@components/ui/Icon/Icon';
import { KeyValueList } from '@components/ui/KeyValueList/KeyValueList';
import { Text } from '@components/ui/Text/Text';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import { CHECKOUT_TEXT, TEST_CHECKOUT_TEXT } from '@constants/payments';
import {
  findTeacher,
  type Batch,
  type TopicPreview,
} from '@services/catalogue';
import {
  formatDateOnly,
  formatWallClockRange,
  formatWallClockTime,
} from '@utils/date';

import styles from './CheckoutTopicCard.module.css';

const cn = cx.bind(styles);

export type CheckoutTopicCardProps = {
  // Buying an attempt at the topic's test: its questions and time, no
  // teacher or batch
  test?: { questionCount: number; minutes: number };
  preview: TopicPreview;
  // The chosen batch; null for a pre-registration or before one is chosen
  batch: Batch | null;
  isEnrolment: boolean;
};

const orToBeAnnounced = <T,>(value: T | null, format: (value: T) => string) =>
  value === null ? CATALOGUE_TEXT.toBeAnnounced : format(value);

// What the student is paying for: the topic, who teaches it, then a strip
// with the chosen batch's dates, like the stay dates on a booking.
export const CheckoutTopicCard = ({
  preview,
  batch,
  isEnrolment,
  test,
}: CheckoutTopicCardProps) => {
  const items = test
    ? [
        {
          label: TEST_CHECKOUT_TEXT.questionsLabel,
          value: String(test.questionCount),
        },
        {
          label: TEST_CHECKOUT_TEXT.timeLabel,
          value: TEST_CHECKOUT_TEXT.minutes(test.minutes),
        },
        {
          label: TEST_CHECKOUT_TEXT.attemptsLabel,
          value: TEST_CHECKOUT_TEXT.oneAttempt,
        },
      ]
    : batch
      ? [
          {
            label: CHECKOUT_TEXT.startsLabel,
            value: orToBeAnnounced(batch.startDate, formatDateOnly),
          },
          {
            label: CHECKOUT_TEXT.timeLabel,
            value: orToBeAnnounced(batch.startTime, start =>
              batch.sessionDurationMinutes
                ? formatWallClockRange(start, batch.sessionDurationMinutes)
                : formatWallClockTime(start),
            ),
          },
          {
            label: CHECKOUT_TEXT.sessionsLabel,
            value: orToBeAnnounced(
              batch.sessionCount,
              CATALOGUE_TEXT.sessionCount,
            ),
          },
          {
            label: CHECKOUT_TEXT.seatsLabel,
            value: orToBeAnnounced(formatBatchSeats(batch), seats => seats),
          },
        ]
      : [
          {
            label: CHECKOUT_TEXT.firstBatchLabel,
            value: CHECKOUT_TEXT.firstBatchValue,
          },
        ];

  const teacher = test ? null : findTeacher(preview, batch);

  return (
    <article className={cn('card')}>
      <div className={cn('head')}>
        <div className={cn('text')}>
          <Heading level={2} variant="title">
            {preview.title}
          </Heading>
          <div className={cn('badges')}>
            <Text as="span" variant="caption" className={cn('badge')}>
              {preview.level}
            </Text>
            <Text
              as="span"
              variant="caption"
              className={cn('badge', 'badgeAccent')}
            >
              {test
                ? TEST_CHECKOUT_TEXT.chip
                : isEnrolment
                  ? CHECKOUT_TEXT.liveBatchBadge
                  : CHECKOUT_TEXT.preRegisterBadge}
            </Text>
          </div>
          {test ? (
            <Text as="p" variant="small" tone="muted">
              {TEST_CHECKOUT_TEXT.summary(test.questionCount, test.minutes)}
            </Text>
          ) : preview.topic.summary ? (
            <Text as="p" variant="small" tone="muted">
              {preview.topic.summary}
            </Text>
          ) : null}
        </div>
        <span className={cn('icon')} aria-hidden="true">
          <Icon name={preview.icon} size="xl" />
        </span>
      </div>

      {teacher ? (
        <TutorProfile tutor={teacher} className={cn('tutor')} />
      ) : null}

      <div className={cn('strip')}>
        {batch ? (
          <Text as="p" variant="strong" className={cn('batchName')}>
            {batch.name}
          </Text>
        ) : null}
        <KeyValueList items={items} columns={2} />
      </div>
    </article>
  );
};
