import { useId, useState, type KeyboardEvent } from 'react';
import cx from 'classnames/bind';

import { ButtonLink } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { Heading } from '@components/ui/Heading/Heading';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { Text } from '@components/ui/Text/Text';
import { LEARNING_JOURNEY_TEXT } from '@constants/home';
import { HOME_SECTION_ID } from '@constants/routes';

import { JOURNEY_STAGES, type JourneyStage } from './learningJourneyData';
import styles from './LearningJourneySection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'learning-journey-title';

export const LearningJourneySection = () => {
  const sectionId = useId();
  const [activeStageId, setActiveStageId] = useState<string>(
    JOURNEY_STAGES[0].id,
  );

  const activeStage: JourneyStage =
    JOURNEY_STAGES.find(s => s.id === activeStageId) ?? JOURNEY_STAGES[0];

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextIndex = (index + 1) % JOURNEY_STAGES.length;
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nextIndex = (index - 1 + JOURNEY_STAGES.length) % JOURNEY_STAGES.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = JOURNEY_STAGES.length - 1;
    }

    if (nextIndex !== index) {
      const nextStage = JOURNEY_STAGES[nextIndex];
      setActiveStageId(nextStage.id);
      const btn = document.getElementById(
        `${sectionId}-tab-${nextStage.id}`,
      ) as HTMLButtonElement | null;
      btn?.focus();
    }
  };

  const panelId = `${sectionId}-panel-${activeStage.id}`;

  return (
    <section
      id={HOME_SECTION_ID.journey}
      aria-labelledby={TITLE_ID}
      className={cn('section')}
    >
      <Container>
        <SectionHead
          titleId={TITLE_ID}
          title={
            <>
              {LEARNING_JOURNEY_TEXT.title}
              <br />
              <em>{LEARNING_JOURNEY_TEXT.titleEmphasis}</em>
            </>
          }
          description={LEARNING_JOURNEY_TEXT.description}
        />

        {/* Continuous Learning Cycle Banner */}
        <div
          className={cn('cycleBar')}
          role="region"
          aria-label="Continuous learning cycle sequence"
        >
          {LEARNING_JOURNEY_TEXT.cycleLabels.map((phase, idx) => {
            const isActive = phase === activeStage.cyclePhase;
            return (
              <span
                key={phase}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <span
                  className={cn('cyclePhase', {
                    cyclePhaseActive: isActive,
                  })}
                >
                  {phase}
                </span>
                {idx < LEARNING_JOURNEY_TEXT.cycleLabels.length - 1 ? (
                  <span className={cn('cycleArrow')} aria-hidden="true">
                    →
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>

        {/* 6-Stage Step Navigator (Horizontal on Desktop) */}
        <div
          className={cn('stepNav')}
          role="tablist"
          aria-label="Learning journey stages"
        >
          {JOURNEY_STAGES.map((stage, index) => {
            const isSelected = stage.id === activeStageId;
            const tabId = `${sectionId}-tab-${stage.id}`;

            return (
              <button
                key={stage.id}
                id={tabId}
                type="button"
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls={panelId}
                className={cn('stepButton', {
                  stepButtonActive: isSelected,
                })}
                onClick={() => setActiveStageId(stage.id)}
                onKeyDown={e => handleKeyDown(e, index)}
              >
                <span className={cn('stepNum')}>{stage.stepNumber}</span>
                <span className={cn('stepTitle')}>{stage.navTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Active Demonstration Panel */}
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${sectionId}-tab-${activeStage.id}`}
          className={cn('panelGrid')}
        >
          {/* Left: Stage Narrative */}
          <div className={cn('panelCopy')}>
            <Text
              as="div"
              variant="eyebrow"
              tone="accent"
              className={cn('stageEyebrow')}
            >
              {`Stage ${activeStage.stepNumber} of 06 · ${activeStage.cyclePhase}`}
            </Text>

            <Heading level={3} variant="feature" className={cn('stageTitle')}>
              {activeStage.title}
            </Heading>

            <p className={cn('stageLead')}>{activeStage.lead}</p>

            <div className={cn('actionWrapper')}>
              <ButtonLink
                variant="editorial"
                href={activeStage.actionHref}
                endIcon="arrowRight"
              >
                {activeStage.actionText}
              </ButtonLink>
            </div>
          </div>

          {/* Right: Authentic Interface Preview */}
          <div className={cn('previewCard')}>
            <div className={cn('cardHeader')}>
              <span className={cn('cardBadge')}>{activeStage.cardBadge}</span>
            </div>

            <Heading level={4} variant="title" className={cn('cardTitle')}>
              {activeStage.cardTitle}
            </Heading>

            <ul className={cn('itemsList')}>
              {activeStage.items.map(item => (
                <li key={item.label} className={cn('itemBlock')}>
                  <span className={cn('itemLabel')}>{item.label}</span>
                  <span className={cn('itemValue')}>{item.value}</span>
                </li>
              ))}
            </ul>

            <div className={cn('cardFooter')}>
              <span className={cn('cardNote')}>
                SriDha Method Demonstration · Continuous Feedback Cycle
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};
