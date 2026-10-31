import { memo, useId, useState } from 'react';
import cx from 'classnames/bind';

import { TopicSubtopicsOverlay } from '@components/catalogue/TopicSubtopicsOverlay/TopicSubtopicsOverlay';
import { ButtonBase } from '@components/ui/ButtonBase/ButtonBase';
import { Card } from '@components/ui/Card/Card';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { Icon } from '@components/ui/Icon/Icon';
import { Input } from '@components/ui/Input/Input';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import { LANDING_TEXT } from '@constants/landing';
import { CHECKOUT_TEXT } from '@constants/payments';
import {
  findNextBatch,
  hasBatches,
  type Topic,
  type TopicPreview,
} from '@services/catalogue';
import { formatPrice } from '@utils/currency';
import { formatDateOnly } from '@utils/date';
import { searchTopicPreviews } from '@utils/topicSearch';

import styles from './TopicPreviewGrid.module.css';

const cn = cx.bind(styles);

// The fee and when the next batch starts, or that batches open soon
const TopicOffer = ({ topic }: { topic: Topic }) => {
  const hasBatches = topic.batches.length > 0;
  const nextBatch = findNextBatch(topic);

  return (
    <>
      <Text as="span" variant="price">
        {topic.price ? formatPrice(topic.price) : CATALOGUE_TEXT.priceOnRequest}
      </Text>
      <StatusDot
        color={hasBatches ? 'positive' : 'neutral'}
        label={
          !hasBatches
            ? LANDING_TEXT.topicSoon
            : nextBatch?.startDate
              ? LANDING_TEXT.topicStarts(formatDateOnly(nextBatch.startDate))
              : LANDING_TEXT.topicOpen
        }
      />
    </>
  );
};

export type TopicPreviewGridProps = {
  // The topic cards to show, from the catalogue (useTopicPreviews)
  previews: readonly TopicPreview[];
  // Opens the payment panel for the topic's catalogue id
  onChooseTopic: (topicId: string) => void;
  // The full grid has a search box and four columns; the compact panel
  // beside the sign-in form has neither.
  showSearch?: boolean;
  columns?: 2 | 4;
  // Show only the first few topics, e.g. in the compact sign-in panel
  limit?: number;
};

// Grid of topic cards. The whole card is one button that opens the payment
// panel: "Enrol now" when batches are published, "Pre-register now" when
// they are not. Hovering the card reveals what the topic teaches.
const TopicPreviewGridView = ({
  onChooseTopic,
  showSearch = true,
  columns = 4,
  limit,
  previews,
}: TopicPreviewGridProps) => {
  const overlayId = useId();
  const [query, setQuery] = useState('');
  const topics = searchTopicPreviews(previews, query).results.slice(0, limit);

  return (
    <div className={cn('grid')}>
      {showSearch ? (
        <Input
          type="search"
          label={LANDING_TEXT.searchLabel}
          placeholder={LANDING_TEXT.searchPlaceholder}
          value={query}
          onChange={event => setQuery(event.target.value)}
          endAdornment={<Icon name="search" size="sm" />}
        />
      ) : null}

      {topics.length > 0 ? (
        <CardGrid variant="boxed" columns={columns}>
          {topics.map((preview, index) => {
            const descriptionId = `${overlayId}-${index}`;
            const action = hasBatches(preview)
              ? CHECKOUT_TEXT.enrolAction
              : CHECKOUT_TEXT.preRegisterAction;

            return (
              <ButtonBase
                key={`${preview.title}-${preview.level}`}
                className={cn('topic')}
                aria-label={CHECKOUT_TEXT.actionLabel(
                  action,
                  preview.title,
                  preview.level,
                )}
                aria-describedby={descriptionId}
                onClick={() => onChooseTopic(preview.catalogueTopicId)}
              >
                <span className={cn('preview')}>
                  <Card
                    variant="centered"
                    className={cn('card')}
                    media={
                      <Icon name={preview.icon} size="xl" strokeWidth={1.25} />
                    }
                    title={preview.title}
                    description={preview.level}
                  />
                  <TopicSubtopicsOverlay
                    id={descriptionId}
                    title={preview.title}
                    level={preview.level}
                    subtopics={preview.subtopics}
                    className={cn('overlay')}
                  />
                </span>
                <span className={cn('offer')}>
                  <TopicOffer topic={preview.topic} />
                  <span className={cn('action')}>
                    <Text as="span" variant="strong">
                      {action}
                    </Text>
                    <Icon name="arrowRight" size="sm" />
                  </span>
                </span>
              </ButtonBase>
            );
          })}
        </CardGrid>
      ) : (
        <EmptyState
          title={LANDING_TEXT.noTopicsTitle}
          message={LANDING_TEXT.noTopicsMessage}
        />
      )}
    </div>
  );
};

// Memoised: a page can hold all 156 cards, and opening the payment panel
// changes the URL, which must not rebuild them while the panel slides in
export const TopicPreviewGrid = memo(TopicPreviewGridView);
