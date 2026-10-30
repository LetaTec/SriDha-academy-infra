import React from 'react';
import cx from 'classnames/bind';

import { Button } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Icon } from '@components/ui/Icon/Icon';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import { LANDING_TEXT } from '@constants/landing';
import { findNextBatch, type Topic } from '@services/catalogue';
import { formatPrice } from '@utils/currency';
import { formatDateOnly } from '@utils/date';

import type { ShowcaseSubject } from './showcaseData';
import type { DeckSlot } from './useSubjectShuffle';
import styles from './ShowcaseCard.module.css';

const cn = cx.bind(styles);

export type ShowcaseCardProps = {
  subject: ShowcaseSubject;
  catalogueTopic: Topic | null;
  onSelect: (topicId: string) => void;
  slot?: DeckSlot;
  innerRef?: React.Ref<HTMLDivElement>;
};

export const ShowcaseCard = ({
  subject,
  catalogueTopic,
  onSelect,
  innerRef,
}: ShowcaseCardProps) => {
  const hasBatches = Boolean(
    catalogueTopic && catalogueTopic.batches.length > 0,
  );
  const nextBatch = catalogueTopic ? findNextBatch(catalogueTopic) : null;
  const effectiveTopicId =
    subject.catalogueTopicId || 'topic_accounts_gst_class_11';

  const highlights = subject.highlights ?? [
    'Structured topic-wise sessions',
    'AI-generated assessment paper included',
    'Concept verification & doubt clearing',
  ];

  return (
    <article
      ref={innerRef}
      className={cn('card', subject.theme)}
      aria-label={`${subject.title} subject preview`}
    >
      {/* Top Meta Bar */}
      <div className={cn('metaBar')}>
        <span className={cn('disciplineTag')}>{subject.discipline}</span>
        <span className={cn('levelBadge')}>{subject.level}</span>
      </div>

      {/* Main Title & Icon */}
      <div className={cn('titleRow')}>
        <div className={cn('iconBadge')} aria-hidden="true">
          <Icon name={subject.icon} size="md" strokeWidth={1.75} />
        </div>
        <div className={cn('titleContent')}>
          <Heading level={3} variant="title" className={cn('subjectTitle')}>
            {subject.title}
          </Heading>
        </div>
      </div>

      {/* Concise Description */}
      <Text as="p" variant="caption" tone="muted" className={cn('description')}>
        {subject.experience}
      </Text>

      {/* Milestone Points */}
      <ul
        className={cn('milestoneList')}
        aria-label={`${subject.title} syllabus milestones`}
      >
        {highlights.map((milestone, idx) => (
          <li key={idx} className={cn('milestoneItem')}>
            <span className={cn('milestoneDot')} aria-hidden="true" />
            <span className={cn('milestoneText')}>{milestone}</span>
          </li>
        ))}
      </ul>

      {/* Batch & Price Status Row */}
      <div className={cn('statusRow')}>
        {hasBatches && catalogueTopic ? (
          <>
            <div className={cn('priceBlock')}>
              <Text as="span" variant="caption" tone="muted">
                Tuition fee
              </Text>
              <Text as="span" variant="price" className={cn('priceValue')}>
                {catalogueTopic.price
                  ? formatPrice(catalogueTopic.price)
                  : CATALOGUE_TEXT.priceOnRequest}
              </Text>
            </div>
            <StatusDot
              color="positive"
              label={
                nextBatch?.startDate
                  ? LANDING_TEXT.topicStarts(
                      formatDateOnly(nextBatch.startDate),
                    )
                  : LANDING_TEXT.topicOpen
              }
            />
          </>
        ) : (
          <div className={cn('upcomingStatus')}>
            <StatusDot color="neutral" label={LANDING_TEXT.topicSoon} />
            <span className={cn('upcomingNote')}>Live batches planned</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className={cn('actionRow')}>
        <Button
          variant="primary"
          endIcon="arrowRight"
          fullWidth
          onClick={() => onSelect(effectiveTopicId)}
        >
          {hasBatches ? 'View topics & batches' : 'Explore subject'}
        </Button>
      </div>
    </article>
  );
};
