import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import cx from 'classnames/bind';

import { TopicsStatus } from '@components/catalogue/TopicsStatus/TopicsStatus';
import { Button } from '@components/ui/Button/Button';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { Heading } from '@components/ui/Heading/Heading';
import { Icon } from '@components/ui/Icon/Icon';
import { Input } from '@components/ui/Input/Input';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import {
  findTopicTestSize,
  TOPIC_TESTS_PAGE_TEXT as TEXT,
} from '@constants/assessment';
import { LANDING_TEXT } from '@constants/landing';
import { TOPIC_FILTER_PARAM } from '@constants/topics';
import { useTopicPreviews } from '@hooks/useTopicPreviews';
import type { TopicPreview } from '@services/catalogue';
import { searchTopicPreviews } from '@utils/topicSearch';

import { TopicTestCard } from './components/TopicTestCard/TopicTestCard';
import styles from './TopicTestsPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'topic-tests-page-title';
const READY_TITLE_ID = 'topic-tests-ready';
const SOON_TITLE_ID = 'topic-tests-soon';

const TopicTestGroup = ({
  titleId,
  title,
  previews,
}: {
  titleId: string;
  title: string;
  previews: readonly TopicPreview[];
}) => (
  <section className={cn('group')} aria-labelledby={titleId}>
    <Heading level={2} variant="title" id={titleId}>
      {title}
    </Heading>
    <CardGrid variant="boxed" columns={4}>
      {previews.map(preview => (
        <TopicTestCard
          key={preview.catalogueTopicId}
          preview={preview}
          questionCount={findTopicTestSize(preview.catalogueTopicId)}
        />
      ))}
    </CardGrid>
  </section>
);

// The Topic Test Paper page: every topic from the catalogue, searchable.
// Topics with a test come first and open it; the rest say it is coming.
const TopicTestsPage = () => {
  // Every topic, including those with a topic test but no batches
  const {
    allPreviews: previews,
    isLoading,
    hasError,
    reload,
  } = useTopicPreviews();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get(TOPIC_FILTER_PARAM.query) ?? '';

  const { results, ready, soon } = useMemo(() => {
    const matches = searchTopicPreviews(previews, query).results;
    const hasTest = (preview: TopicPreview) =>
      findTopicTestSize(preview.catalogueTopicId) !== null;
    return {
      results: matches,
      ready: matches.filter(hasTest),
      soon: matches.filter(preview => !hasTest(preview)),
    };
  }, [previews, query]);
  const readyCount = previews.filter(
    preview => findTopicTestSize(preview.catalogueTopicId) !== null,
  ).length;

  // Replacing the history entry keeps Back for leaving the page
  const setQuery = (value: string) =>
    setSearchParams(value ? { [TOPIC_FILTER_PARAM.query]: value } : {}, {
      replace: true,
    });

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('intro')}>
        <Heading level={1} variant="hero" id={TITLE_ID}>
          {TEXT.title}
          <br />
          <em>{TEXT.titleEmphasis}</em>
        </Heading>
      </div>

      <div className={cn('controls')}>
        <Input
          type="search"
          label={LANDING_TEXT.searchLabel}
          placeholder={LANDING_TEXT.searchPlaceholder}
          value={query}
          onChange={event => setQuery(event.target.value)}
          endAdornment={<Icon name="search" size="sm" />}
        />
        <Text as="p" variant="small" tone="muted" aria-live="polite">
          {TEXT.count(results.length, readyCount)}
        </Text>
      </div>

      {isLoading || hasError ? (
        <TopicsStatus hasError={hasError} onRetry={reload} />
      ) : results.length > 0 ? (
        <div className={cn('groups')}>
          {ready.length > 0 ? (
            <TopicTestGroup
              titleId={READY_TITLE_ID}
              title={TEXT.readyTitle}
              previews={ready}
            />
          ) : null}
          {soon.length > 0 ? (
            <TopicTestGroup
              titleId={SOON_TITLE_ID}
              title={TEXT.soonTitle}
              previews={soon}
            />
          ) : null}
        </div>
      ) : (
        <EmptyState
          title={TEXT.emptyTitle}
          message={TEXT.emptyMessage}
          action={
            <Button variant="secondary" onClick={() => setQuery('')}>
              {TEXT.clearSearch}
            </Button>
          }
        />
      )}
    </Section>
  );
};

export default TopicTestsPage;
