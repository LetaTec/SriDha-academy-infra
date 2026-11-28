import cx from 'classnames/bind';

import { TutorProfile } from '@components/catalogue/TutorProfile/TutorProfile';
import { Heading } from '@components/ui/Heading/Heading';
import { Icon } from '@components/ui/Icon/Icon';
import { KeyValueList } from '@components/ui/KeyValueList/KeyValueList';
import { Text } from '@components/ui/Text/Text';
import { CHECKOUT_TEXT, TEST_CHECKOUT_TEXT } from '@constants/payments';
import {
  findTeacher,
  type Batch,
  type TopicPreview,
} from '@services/catalogue';

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

// What the student is paying for: the topic and who teaches it.
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
    : [
        {
          label: CHECKOUT_TEXT.firstBatchLabel,
          value: CHECKOUT_TEXT.firstBatchValue,
        },
      ];

  const teacher = test ? null : findTeacher(preview, batch);
  const showDetails = test !== undefined || batch === null;

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

      {showDetails ? (
        <div className={cn('strip')}>
          <KeyValueList items={items} columns={2} />
        </div>
      ) : null}
    </article>
  );
};
