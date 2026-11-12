import { useId, useRef, useState, type KeyboardEvent } from 'react';
import cx from 'classnames/bind';

import { ButtonBase } from '@components/ui/ButtonBase/ButtonBase';
import { Icon } from '@components/ui/Icon/Icon';
import { Input } from '@components/ui/Input/Input';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import {
  BATCH_AVAILABILITY_COLOR,
  BATCH_AVAILABILITY_LABEL,
  CATALOGUE_TEXT,
} from '@constants/catalogue';
import { HEADER_TEXT } from '@constants/home';
import { TAUGHT_CLASS_NUMBERS } from '@constants/topics';
import {
  hasBatches,
  isBatchOpen,
  type Batch,
  type TopicPreview,
} from '@services/catalogue';
import { formatClassLevel } from '@utils/classLevel';
import { formatPrice } from '@utils/currency';
import { formatWallClockTime } from '@utils/date';
import { searchTopicPreviews } from '@utils/topicSearch';

import styles from './TopicSearch.module.css';

const cn = cx.bind(styles);

// Enough to keep the dropdown short; the Topics page has the rest.
const MAX_BATCHES = 3;
const MAX_RESULTS = 5;

export type TopicSearchProps = {
  // Every topic card, from the catalogue
  previews: readonly TopicPreview[];
  // A chosen topic: with batches to enrol in, or opening soon for
  // pre-registration
  onOpenTopic: (topicId: string) => void;
  // A chosen open batch, to enrol in straight away
  onSelectBatch: (topicId: string, batchId: string) => void;
  // Opens the Topics page searched for the query, for every result beyond
  // the first few
  onBrowseTopics: (query: string) => void;
  // compact sits in the header; large is the homepage's main search; full
  // spans its container at the normal control height (the Topics page)
  size?: 'compact' | 'large' | 'full';
  // The search box's accessible name, shown above the box when showLabel
  label?: string;
  showLabel?: boolean;
  placeholder?: string;
  // Pass both to let the page own the text, for example to filter a list as
  // the student types; the text then stays after a result is chosen
  query?: string;
  onQueryChange?: (query: string) => void;
};

const TAUGHT_CLASSES = TAUGHT_CLASS_NUMBERS.map(formatClassLevel).join(', ');

const batchTiming = (batch: Batch) =>
  [
    batch.scheduleLabel,
    batch.startTime ? formatWallClockTime(batch.startTime) : null,
  ]
    .filter(Boolean)
    .join(' · ');

const batchStatus = (batch: Batch) =>
  isBatchOpen(batch) && batch.seatsRemaining !== null
    ? CATALOGUE_TEXT.seatsRemaining(batch.seatsRemaining)
    : BATCH_AVAILABILITY_LABEL[batch.availability];

// Topic search: in the header, as the homepage's main search and on the
// Topics page. Matches a class ("class 11", "12th", "XI")
// as well as topic names and subtopics, and lists
// each open topic's fee and batches: choosing a topic opens its lessons and
// batches, choosing a batch goes straight to reserving it.
export const TopicSearch = ({
  previews,
  onOpenTopic,
  onSelectBatch,
  onBrowseTopics,
  size = 'compact',
  label = HEADER_TEXT.searchLabel,
  showLabel = false,
  placeholder = HEADER_TEXT.searchPlaceholder,
  query: controlledQuery,
  onQueryChange,
}: TopicSearchProps) => {
  const resultsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ownQuery, setOwnQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = controlledQuery !== undefined;
  const query = isControlled ? controlledQuery : ownQuery;
  const setQuery = (next: string) =>
    isControlled ? onQueryChange?.(next) : setOwnQuery(next);

  const normalisedQuery = query.trim().toLowerCase();
  const { classNumber, results } = normalisedQuery
    ? searchTopicPreviews(previews, normalisedQuery)
    : { classNumber: null, results: [] };
  const classLabel =
    classNumber === null ? null : formatClassLevel(classNumber);
  const showResults = isOpen && normalisedQuery.length > 0;

  const findOpenTopic = (preview: TopicPreview) =>
    hasBatches(preview) ? preview.topic : null;

  const finish = () => {
    setIsOpen(false);
    if (!isControlled) setQuery('');
  };

  const chooseTopic = (preview: TopicPreview) => {
    finish();
    onOpenTopic(preview.catalogueTopicId);
  };

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn('search', {
        searchLarge: size === 'large',
        searchFull: size === 'full',
      })}
      onFocus={() => setIsOpen(true)}
      onBlur={event => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          setIsOpen(false);
        }
      }}
    >
      <Input
        type="search"
        label={label}
        hideLabel={!showLabel}
        placeholder={placeholder}
        value={query}
        aria-controls={resultsId}
        aria-expanded={showResults}
        autoComplete="off"
        endAdornment={
          <Icon name="search" size={size === 'large' ? 'md' : 'sm'} />
        }
        className={cn('input')}
        onChange={event => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={event => {
          closeOnEscape(event);
          if (event.key === 'Enter' && results[0]) {
            event.preventDefault();
            chooseTopic(results[0]);
          }
        }}
      />

      <div
        id={resultsId}
        role="region"
        aria-label={HEADER_TEXT.searchResultsLabel}
        aria-live="polite"
        className={cn('results', { resultsOpen: showResults })}
      >
        {showResults && classLabel && results.length > 0 ? (
          <Text
            as="p"
            variant="eyebrow"
            tone="accent"
            className={cn('classHeading')}
          >
            {HEADER_TEXT.searchClassResults(classLabel, results.length)}
          </Text>
        ) : null}

        {showResults && results.length === 0 ? (
          <Text as="p" variant="small" tone="muted" className={cn('empty')}>
            {classLabel
              ? HEADER_TEXT.searchClassEmpty(classLabel, TAUGHT_CLASSES)
              : HEADER_TEXT.searchEmpty}
          </Text>
        ) : null}

        {showResults
          ? results.slice(0, MAX_RESULTS).map(preview => {
              const topic = findOpenTopic(preview);
              const batches = topic?.batches.slice(0, MAX_BATCHES) ?? [];

              return (
                <div key={preview.title} className={cn('group')}>
                  <ButtonBase
                    className={cn('topic')}
                    onClick={() => chooseTopic(preview)}
                    onKeyDown={closeOnEscape}
                  >
                    <span className={cn('topicIcon')} aria-hidden="true">
                      <Icon name={preview.icon} size="md" />
                    </span>
                    <span className={cn('topicText')}>
                      <Text as="span" variant="strong">
                        {preview.title}
                      </Text>
                      <Text as="span" variant="caption" tone="muted">
                        {preview.level}
                      </Text>
                    </span>
                    {topic ? (
                      <Text as="span" variant="strong" tone="accent">
                        {topic.price
                          ? formatPrice(topic.price)
                          : CATALOGUE_TEXT.priceOnRequest}
                      </Text>
                    ) : (
                      <StatusDot
                        color="neutral"
                        label={HEADER_TEXT.searchSoon}
                      />
                    )}
                  </ButtonBase>

                  {topic
                    ? batches.map(batch => (
                        <ButtonBase
                          key={batch.id}
                          className={cn('batch')}
                          aria-label={HEADER_TEXT.searchBatchLabel(
                            preview.title,
                            batch.name,
                            batchTiming(batch),
                          )}
                          onClick={() => {
                            finish();
                            if (isBatchOpen(batch)) {
                              onSelectBatch(topic.id, batch.id);
                            } else {
                              onOpenTopic(topic.id);
                            }
                          }}
                          onKeyDown={closeOnEscape}
                        >
                          <span className={cn('batchText')}>
                            <Text as="span" variant="small">
                              {batch.name}
                            </Text>
                            <Text as="span" variant="caption" tone="muted">
                              {batchTiming(batch)}
                            </Text>
                          </span>
                          <StatusDot
                            color={BATCH_AVAILABILITY_COLOR[batch.availability]}
                            label={batchStatus(batch)}
                          />
                        </ButtonBase>
                      ))
                    : null}
                </div>
              );
            })
          : null}

        {showResults && results.length > MAX_RESULTS ? (
          <ButtonBase
            className={cn('seeAll')}
            onClick={() => {
              const searched = query.trim();
              finish();
              onBrowseTopics(searched);
            }}
            onKeyDown={closeOnEscape}
          >
            <Text as="span" variant="small">
              {HEADER_TEXT.searchSeeAll(results.length)}
            </Text>
            <Icon name="arrowRight" size="sm" />
          </ButtonBase>
        ) : null}
      </div>
    </div>
  );
};
