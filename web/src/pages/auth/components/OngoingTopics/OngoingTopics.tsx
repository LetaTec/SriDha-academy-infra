import React from 'react';
import { useNavigate } from 'react-router-dom';
import cx from 'classnames/bind';

import { ButtonRouteLink } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Icon } from '@components/ui/Icon/Icon';
import { Text } from '@components/ui/Text/Text';
import { AUTH_QUERY_PARAM } from '@constants/auth';
import { CATALOGUE_QUERY_PARAM } from '@constants/catalogue';
import { LANDING_TEXT } from '@constants/landing';
import { APP_ROUTES, AUTH_SECTION_ID, toPageSection } from '@constants/routes';
import type { Topic } from '@services/catalogue';

import { ShowcaseCard } from './ShowcaseCard';
import { useSubjectShuffle } from './useSubjectShuffle';
import styles from './OngoingTopics.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'ongoing-topics-title';

export type OngoingTopicsProps = {
  catalogueTopics: readonly Topic[];
};

export const OngoingTopics = ({ catalogueTopics }: OngoingTopicsProps) => {
  const navigate = useNavigate();

  const {
    activeSubject,
    selectorSubjects,
    selectSubject,
    pause,
    resume,
    isPaused,
    prefersReducedMotion,
  } = useSubjectShuffle();

  const handleSelectTopic = (topicId: string) => {
    const destination = `${APP_ROUTES.HOME}?${new URLSearchParams({
      [CATALOGUE_QUERY_PARAM.topic]: topicId,
    })}`;
    navigate(
      `${APP_ROUTES.REGISTER}?${new URLSearchParams({
        [AUTH_QUERY_PARAM.redirectTo]: destination,
      })}`,
    );
  };

  const findCatalogueTopic = (topicId?: string) =>
    topicId ? (catalogueTopics.find(t => t.id === topicId) ?? null) : null;

  const handleKeyDownTab = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % selectorSubjects.length;
      selectSubject(selectorSubjects[nextIndex].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex =
        (currentIndex - 1 + selectorSubjects.length) % selectorSubjects.length;
      selectSubject(selectorSubjects[prevIndex].id);
    }
  };

  return (
    <section
      className={cn('panel')}
      aria-labelledby={TITLE_ID}
      onMouseEnter={pause}
      onMouseLeave={() => {
        if (!isPaused) resume();
      }}
      onFocusCapture={pause}
    >
      {/* Explorer Header */}
      <div className={cn('headerRow')}>
        <Text
          as="div"
          variant="eyebrow"
          tone="accent"
          className={cn('eyebrow')}
        >
          Curriculum Preview
        </Text>
      </div>

      <Heading level={2} variant="title" id={TITLE_ID} className={cn('title')}>
        {LANDING_TEXT.ongoingTitle}
      </Heading>

      <Text as="p" variant="caption" tone="muted" className={cn('subhead')}>
        Select a subject to preview topic-wise batches, milestone structures,
        and live schedules.
      </Text>

      {/* Interactive Subject Selector Bar */}
      <div
        role="tablist"
        aria-label="Curriculum subjects"
        className={cn('selectorList')}
      >
        {selectorSubjects.map((subject, index) => {
          const isSelected = activeSubject.id === subject.id;
          return (
            <button
              key={subject.id}
              role="tab"
              id={`subject-tab-${subject.id}`}
              aria-selected={isSelected}
              aria-controls="featured-subject-preview"
              tabIndex={isSelected ? 0 : -1}
              className={cn('selectorPill', { active: isSelected })}
              onClick={() => selectSubject(subject.id)}
              onKeyDown={e => handleKeyDownTab(e, index)}
              type="button"
            >
              <Icon name={subject.icon} size="sm" strokeWidth={1.75} />
              <span className={cn('pillTitle')}>{subject.title}</span>
            </button>
          );
        })}
      </div>

      {/* Single Featured Subject Slot */}
      <div
        id="featured-subject-preview"
        role="tabpanel"
        aria-labelledby={`subject-tab-${activeSubject.id}`}
        className={cn('featuredSlot', { reducedMotion: prefersReducedMotion })}
      >
        <ShowcaseCard
          key={activeSubject.id}
          subject={activeSubject}
          catalogueTopic={findCatalogueTopic(activeSubject.catalogueTopicId)}
          onSelect={handleSelectTopic}
        />
      </div>

      {/* Primary Registration / Exploration CTA */}
      <div className={cn('action')}>
        <ButtonRouteLink
          to={toPageSection(APP_ROUTES.REGISTER, AUTH_SECTION_ID.access)}
          endIcon="arrowRight"
          fullWidth
          wrapLabel
        >
          {LANDING_TEXT.ongoingAction}
        </ButtonRouteLink>
      </div>
    </section>
  );
};
