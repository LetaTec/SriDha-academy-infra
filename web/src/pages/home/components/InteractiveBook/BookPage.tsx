import cx from 'classnames/bind';

import { BrandLogo } from '@components/brand/BrandLogo/BrandLogo';
import { formatTopicPrice } from '@components/catalogue/batchDetails';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { RuledList } from '@components/ui/RuledList/RuledList';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import {
  BATCH_AVAILABILITY_COLOR,
  BATCH_AVAILABILITY_LABEL,
  CATALOGUE_TEXT,
} from '@constants/catalogue';
import { BOOK_TEXT } from '@constants/home';
import { APP_ROUTES } from '@constants/routes';
import { isBatchOpen, type Batch } from '@services/catalogue';
import { formatDateOnly, formatWallClockTime } from '@utils/date';

import type { BookPageContent } from './bookPages';
import styles from './BookPage.module.css';

const cn = cx.bind(styles);

export type BookPageActions = {
  onOpenTopic: (topicId: string) => void;
  onSelectBatch: (topicId: string, batch: Batch) => void;
  onRetry: () => void;
};

type BookPageProps = BookPageActions & {
  page: BookPageContent;
};

const getBatchMeta = (batch: Batch) =>
  [
    batch.startDate ? formatDateOnly(batch.startDate) : null,
    batch.startTime ? formatWallClockTime(batch.startTime) : null,
    batch.sessionCount ? CATALOGUE_TEXT.sessionCount(batch.sessionCount) : null,
  ]
    .filter(Boolean)
    .join(' · ');

export const BookPage = ({
  page,
  onOpenTopic,
  onSelectBatch,
  onRetry,
}: BookPageProps) => {
  switch (page.kind) {
    case 'chapter':
      return (
        <div className={cn('page')}>
          <Text as="div" variant="sheetLabel" tone="accent">
            {page.chapter.label}
          </Text>
          <Heading level={3} variant="sheet" className={cn('heading')}>
            {page.chapter.title}
            <br />
            <em>{page.chapter.titleEmphasis}</em>
          </Heading>
          <Text
            as="p"
            variant="sheetBody"
            tone="sheetMuted"
            className={cn('copy')}
          >
            {page.chapter.description}
          </Text>
          <RuledList
            size="sheet"
            items={page.chapter.items}
            className={cn('list')}
          />
        </div>
      );

    case 'topic': {
      const { topic } = page.context;

      return (
        <div className={cn('page')}>
          <Text as="div" variant="sheetLabel" tone="accent">
            {BOOK_TEXT.topicLabel(topic.level)}
          </Text>
          <Heading
            level={3}
            variant="sheet"
            className={cn('heading', 'headingCompact')}
          >
            {/* The label above already gives the class */}
            {topic.shortTitle}
          </Heading>
          <Text as="div" variant="sheetLabel" tone="sheetMuted">
            {BOOK_TEXT.lessonsHeading}
          </Text>
          <RuledList
            ordered
            size="sheet"
            items={topic.lessons.map(lesson => lesson.title)}
            className={cn('list', 'listTight')}
          />
          <div className={cn('pageAction')}>
            <Button variant="editorial" onClick={() => onOpenTopic(topic.id)}>
              {CATALOGUE_TEXT.viewTopicDetails}
            </Button>
          </div>
        </div>
      );
    }

    case 'batchList':
      return (
        <div className={cn('page')}>
          <Text as="div" variant="sheetLabel" tone="accent">
            {BOOK_TEXT.batchListLabel(page.part)}
          </Text>
          {page.entries.length > 0 ? (
            <ul className={cn('batches')}>
              {page.entries.map(({ topic, batch }) => (
                <li key={batch.id} className={cn('batch')}>
                  <Text as="div" variant="sheetLabel" tone="sheetMuted">
                    {topic.title} · {formatTopicPrice(topic.price)}
                  </Text>
                  <Text as="div" variant="sheetTitle" tone="primary">
                    {batch.scheduleLabel}
                  </Text>
                  <Text
                    as="div"
                    variant="sheetLabel"
                    tone="sheetMuted"
                    className={cn('batchMeta')}
                  >
                    {getBatchMeta(batch)}
                  </Text>
                  <div className={cn('batchFooter')}>
                    <span className={cn('batchStatus')}>
                      <StatusDot
                        color={BATCH_AVAILABILITY_COLOR[batch.availability]}
                        label={BATCH_AVAILABILITY_LABEL[batch.availability]}
                      />
                    </span>
                    <Button
                      variant="editorial"
                      disabled={!isBatchOpen(batch)}
                      aria-label={CATALOGUE_TEXT.selectBatchLabel(
                        topic.title,
                        batch.scheduleLabel,
                      )}
                      onClick={() => onSelectBatch(topic.id, batch)}
                    >
                      {CATALOGUE_TEXT.selectBatch}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Text
              as="p"
              variant="sheetBody"
              tone="sheetMuted"
              className={cn('emptyBatches')}
            >
              {BOOK_TEXT.moreBatchesSoon}
            </Text>
          )}
          {page.showMoreLink ? (
            <div className={cn('pageAction')}>
              <ButtonRouteLink
                to={APP_ROUTES.BATCHES}
                endIcon="arrowRight"
                className={cn('moreLink')}
              >
                {BOOK_TEXT.exploreMoreBatches}
              </ButtonRouteLink>
            </div>
          ) : null}
        </div>
      );

    case 'status':
      return (
        <div className={cn('page')}>
          <Heading level={3} variant="sheet" className={cn('heading')}>
            {page.status === 'loading'
              ? BOOK_TEXT.loadingTitle
              : BOOK_TEXT.errorTitle}
            <br />
            <em>
              {page.status === 'loading'
                ? BOOK_TEXT.loadingTitleEmphasis
                : BOOK_TEXT.errorTitleEmphasis}
            </em>
          </Heading>
          {page.status === 'error' ? (
            <>
              <Text
                as="p"
                variant="sheetBody"
                tone="sheetMuted"
                className={cn('copy')}
              >
                {CATALOGUE_TEXT.loadError}
              </Text>
              <div className={cn('pageAction')}>
                <Button variant="editorial" onClick={onRetry}>
                  {CATALOGUE_TEXT.retry}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      );

    case 'blank':
      return (
        <div className={cn('page', 'endPage')}>
          <BrandLogo variant="stacked" size="md" />
        </div>
      );

    default:
      return null;
  }
};
