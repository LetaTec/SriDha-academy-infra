import cx from 'classnames/bind';

import { TutorProfile } from '@components/catalogue/TutorProfile/TutorProfile';
import { Heading } from '@components/ui/Heading/Heading';
import { Icon } from '@components/ui/Icon/Icon';
import { KeyValueList } from '@components/ui/KeyValueList/KeyValueList';
import { Text } from '@components/ui/Text/Text';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import { CHECKOUT_TEXT } from '@constants/payments';
import type { Batch, TopicPreview } from '@services/catalogue';
import { formatDateOnly, formatWallClockTime } from '@utils/date';

import styles from './CheckoutTopicCard.module.css';

const cn = cx.bind(styles);

export type CheckoutTopicCardProps = {
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
}: CheckoutTopicCardProps) => {
  const items = batch
    ? [
        {
          label: CHECKOUT_TEXT.startsLabel,
          value: orToBeAnnounced(batch.startDate, formatDateOnly),
        },
        {
          label: CHECKOUT_TEXT.timeLabel,
          value: orToBeAnnounced(batch.startTime, formatWallClockTime),
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
          value: orToBeAnnounced(batch.seatsRemaining, String),
        },
      ]
    : [
        {
          label: CHECKOUT_TEXT.firstBatchLabel,
          value: CHECKOUT_TEXT.firstBatchValue,
        },
      ];

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
              {isEnrolment
                ? CHECKOUT_TEXT.liveBatchBadge
                : CHECKOUT_TEXT.preRegisterBadge}
            </Text>
          </div>
          {preview.topic.summary ? (
            <Text as="p" variant="small" tone="muted">
              {preview.topic.summary}
            </Text>
          ) : null}
        </div>
        <span className={cn('icon')} aria-hidden="true">
          <Icon name={preview.icon} size="xl" />
        </span>
      </div>

      {preview.topic.tutor ? (
        <TutorProfile tutor={preview.topic.tutor} className={cn('tutor')} />
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
