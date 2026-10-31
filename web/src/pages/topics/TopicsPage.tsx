import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import cx from 'classnames/bind';

import { TopicPreviewGrid } from '@components/catalogue/TopicPreviewGrid/TopicPreviewGrid';
import { Button } from '@components/ui/Button/Button';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { Heading } from '@components/ui/Heading/Heading';
import { Icon } from '@components/ui/Icon/Icon';
import { Input } from '@components/ui/Input/Input';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { LANDING_TEXT } from '@constants/landing';
import { PAGE_TEXT } from '@constants/pages';
import {
  SUBJECT_LABEL,
  TOPIC_FILTER_PARAM,
  TOPIC_PREVIEWS,
  type TopicPreview,
} from '@constants/topics';
import { useCatalogue } from '@hooks/useCatalogue';
import { useCheckout } from '@hooks/useCheckout';
import { listTopics } from '@services/catalogue';

import { SubjectTabs } from './components/SubjectTabs/SubjectTabs';
import { ActiveFilters } from './components/ActiveFilters/ActiveFilters';
import { TopicFilterPanel } from './components/TopicFilterPanel/TopicFilterPanel';
import type { TopicFilterKey } from './topicFilterOptions';
import {
  countTopicsBySubject,
  filterTopics,
  groupTopicsBySubject,
  hasActiveFilters,
  readTopicFilters,
} from './topicFilters';
import styles from './TopicsPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'topics-page-title';

// Every topic we teach, searchable, with class, stream and availability
// filters in a side panel. Subject tabs show one subject at a time; within a subject,
// each class has its own row. "Enrol now" and "Pre-register now" open the
// payment panel over this page.
const TopicsPage = () => {
  const { subjects } = useCatalogue();
  const { openCheckout } = useCheckout();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readTopicFilters(searchParams);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const catalogueTopics = listTopics(subjects).map(context => context.topic);
  const openTopicIds = new Set(
    catalogueTopics
      .filter(topic => topic.batches.length > 0)
      .map(topic => topic.id),
  );
  const isOpen = (preview: TopicPreview) =>
    preview.catalogueTopicId !== undefined &&
    openTopicIds.has(preview.catalogueTopicId);

  // Subject tabs count topics under every other filter, then pick one subject
  const resultsInAnySubject = filterTopics(
    TOPIC_PREVIEWS,
    { ...filters, subject: null },
    isOpen,
  );
  const results = filters.subject
    ? resultsInAnySubject.filter(preview => preview.subject === filters.subject)
    : resultsInAnySubject;
  const groups = groupTopicsBySubject(results);

  // Replacing the history entry keeps Back for leaving the page
  // Builds on the latest change even before the page re-renders, so two
  // quick filter choices both stick
  const latestParams = useRef(searchParams);
  latestParams.current = searchParams;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(latestParams.current);
    if (value) next.set(key, value);
    else next.delete(key);
    latestParams.current = next;
    setSearchParams(next, { replace: true });
  };

  const handleFilterChange = (key: TopicFilterKey, value: string) =>
    setParam(TOPIC_FILTER_PARAM[key], value);

  const clearFilters = () => setSearchParams({}, { replace: true });

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('head')}>
        <Text as="div" variant="eyebrow">
          {PAGE_TEXT.topicsEyebrow}
        </Text>
        <Heading level={1} variant="display" id={TITLE_ID}>
          {PAGE_TEXT.topicsTitle} <em>{PAGE_TEXT.topicsTitleEmphasis}</em>
        </Heading>
        <Text as="p" tone="muted" className={cn('note')}>
          {PAGE_TEXT.topicsNote}
        </Text>
      </div>

      <div className={cn('controls')}>
        <Input
          type="search"
          label={LANDING_TEXT.searchLabel}
          placeholder={LANDING_TEXT.searchPlaceholder}
          value={filters.query}
          onChange={event =>
            setParam(TOPIC_FILTER_PARAM.query, event.target.value)
          }
          endAdornment={<Icon name="search" size="sm" />}
        />
        <ActiveFilters
          filters={filters}
          onOpen={() => setIsFilterPanelOpen(true)}
          onRemove={key => handleFilterChange(key, '')}
        />
        <SubjectTabs
          selected={filters.subject}
          counts={countTopicsBySubject(resultsInAnySubject)}
          total={resultsInAnySubject.length}
          onSelect={subject =>
            setParam(TOPIC_FILTER_PARAM.subject, subject ?? '')
          }
        />
        <Text as="p" variant="small" tone="muted" aria-live="polite">
          {PAGE_TEXT.topicsCount(results.length, TOPIC_PREVIEWS.length)}
        </Text>
      </div>

      {groups.length > 0 ? (
        <div className={cn('groups')}>
          {groups.map(group => {
            const groupTitleId = `topics-group-${group.subject}`;

            return (
              <section
                key={group.subject}
                className={cn('group')}
                aria-labelledby={groupTitleId}
              >
                <div className={cn('groupHead')}>
                  <Heading level={2} variant="title" id={groupTitleId}>
                    {SUBJECT_LABEL[group.subject]}
                  </Heading>
                  <Text as="span" variant="small" tone="muted">
                    {PAGE_TEXT.topicsGroupCount(group.count)}
                  </Text>
                </div>
                {group.classes.map(classGroup => (
                  <div key={classGroup.level} className={cn('classGroup')}>
                    <Heading
                      level={3}
                      variant="item"
                      className={cn('classHead')}
                    >
                      {classGroup.level}
                    </Heading>
                    <TopicPreviewGrid
                      previews={classGroup.topics}
                      catalogueTopics={catalogueTopics}
                      onChooseTopic={openCheckout}
                      showSearch={false}
                    />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={PAGE_TEXT.topicsEmptyTitle}
          message={PAGE_TEXT.topicsEmptyMessage}
          action={
            <Button variant="secondary" onClick={clearFilters}>
              {PAGE_TEXT.topicsClearFilters}
            </Button>
          }
        />
      )}
      <TopicFilterPanel
        open={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onChange={handleFilterChange}
        onClear={clearFilters}
        canClear={hasActiveFilters(filters)}
        resultCount={results.length}
      />
    </Section>
  );
};

export default TopicsPage;
