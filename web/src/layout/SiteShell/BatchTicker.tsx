import type { CSSProperties } from 'react';
import cx from 'classnames/bind';

import { ButtonBase } from '@components/ui/ButtonBase/ButtonBase';
import { Icon } from '@components/ui/Icon/Icon';
import { Text } from '@components/ui/Text/Text';
import { TICKER_TEXT } from '@constants/home';
import { useCatalogue } from '@hooks/useCatalogue';
import { useCheckout } from '@hooks/useCheckout';
import { isBatchOpen, listTopics, type Batch } from '@services/catalogue';
import { formatDateOnly, formatWallClockTime } from '@utils/date';

import styles from './BatchTicker.module.css';

const cn = cx.bind(styles);

type TickerItem = {
  topicId: string;
  topic: string;
  level: string;
  batch: Batch;
};

const describeBatch = (batch: Batch) =>
  [
    batch.name,
    batch.startDate
      ? [
          `${TICKER_TEXT.starts} ${formatDateOnly(batch.startDate)}`,
          batch.startTime ? formatWallClockTime(batch.startTime) : null,
        ]
          .filter(Boolean)
          .join(', ')
      : batch.scheduleLabel,
    batch.seatsRemaining !== null
      ? TICKER_TEXT.seatsLeft(batch.seatsRemaining)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

// "Now enrolling": every open batch, running slowly along the top of the
// page. It pauses under the pointer or keyboard focus, and stands still for
// people who prefer reduced motion. Choosing a batch opens its payment.
export const BatchTicker = () => {
  const { subjects } = useCatalogue();
  const { openCheckout } = useCheckout();

  const items: TickerItem[] = listTopics(subjects).flatMap(({ topic }) =>
    topic.batches.filter(isBatchOpen).map(batch => ({
      topicId: topic.id,
      topic: topic.shortTitle,
      level: topic.level ?? '',
      batch,
    })),
  );

  // The list is shown twice so the loop has no seam; only the first copy
  // is read out or reachable by keyboard
  const renderItems = (copy: 'first' | 'repeat') =>
    items.map(item => (
      <li key={`${copy}-${item.batch.id}`} className={cn('item')}>
        <ButtonBase
          className={cn('entry')}
          aria-label={TICKER_TEXT.enrolLabel(item.topic, item.batch.name)}
          onClick={() => openCheckout(item.topicId, item.batch.id)}
        >
          <Text as="span" variant="strong" className={cn('topic')}>
            {item.topic}
          </Text>
          <Text as="span" variant="small" className={cn('level')}>
            {item.level}
          </Text>
          <Text as="span" variant="small" className={cn('details')}>
            {describeBatch(item.batch)}
          </Text>
          <span className={cn('enrol')}>
            <Text as="span" variant="small">
              {TICKER_TEXT.enrol}
            </Text>
            <Icon name="arrowRight" size="sm" />
          </span>
        </ButtonBase>
      </li>
    ));

  return (
    <section className={cn('ticker')} aria-label={TICKER_TEXT.regionLabel}>
      <Text as="span" variant="label" className={cn('label')}>
        {TICKER_TEXT.label}
      </Text>
      <div className={cn('window')}>
        {items.length > 0 ? (
          <div
            className={cn('track')}
            style={{ '--ticker-items': items.length } as CSSProperties}
          >
            <ul className={cn('list')}>{renderItems('first')}</ul>
            <ul className={cn('list', 'repeat')} aria-hidden="true" inert>
              {renderItems('repeat')}
            </ul>
          </div>
        ) : (
          <Text as="span" variant="small" className={cn('quiet')}>
            {TICKER_TEXT.quiet}
          </Text>
        )}
      </div>
    </section>
  );
};
