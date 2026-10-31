import { useId, useState, type KeyboardEvent } from 'react';
import cx from 'classnames/bind';

import { Button, ButtonLink } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import { CONCEPT_MAP_TEXT } from '@constants/home';
import { HOME_SECTION_ID, toSectionHref } from '@constants/routes';

import {
  CONCEPT_MAP_SUBJECTS,
  type ConceptNode,
  type MapSubject,
} from '../conceptMapData';
import styles from './ConceptMap.module.css';

const cn = cx.bind(styles);

export type ConceptMapProps = {
  onOpenTopic?: (topicId: string) => void;
  className?: string;
};

export const ConceptMap = ({ onOpenTopic, className }: ConceptMapProps) => {
  const mapId = useId();
  const [activeSubjectId, setActiveSubjectId] = useState<string>(
    CONCEPT_MAP_SUBJECTS[0].id,
  );

  const currentSubject: MapSubject =
    CONCEPT_MAP_SUBJECTS.find(s => s.id === activeSubjectId) ??
    CONCEPT_MAP_SUBJECTS[0];

  const [activeNodeId, setActiveNodeId] = useState<string>(
    currentSubject.initialNodeId,
  );

  // When subject changes, reset selected node to initialNodeId
  const handleSelectSubject = (subjectId: string) => {
    setActiveSubjectId(subjectId);
    const sub = CONCEPT_MAP_SUBJECTS.find(s => s.id === subjectId);
    if (sub) {
      setActiveNodeId(sub.initialNodeId);
    }
  };

  const selectedNode: ConceptNode =
    currentSubject.nodes.find(node => node.id === activeNodeId) ??
    currentSubject.nodes[0];

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const nodes = currentSubject.nodes;
    let nextIndex = index;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (index + 1) % nodes.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (index - 1 + nodes.length) % nodes.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = nodes.length - 1;
    }

    if (nextIndex !== index) {
      const nextNode = nodes[nextIndex];
      setActiveNodeId(nextNode.id);
      const btn = document.getElementById(
        `${mapId}-node-${nextNode.id}`,
      ) as HTMLButtonElement | null;
      btn?.focus();
    }
  };

  const panelId = `${mapId}-panel-${selectedNode.id}`;

  return (
    <div
      className={cn('conceptMap', className)}
      role="region"
      aria-label="Interactive concept map"
    >
      {/* Header & Subject Selector */}
      <div className={cn('header')}>
        <div className={cn('topRow')}>
          <Text
            as="span"
            variant="eyebrow"
            tone="accentInverse"
            className={cn('eyebrowTag')}
          >
            {CONCEPT_MAP_TEXT.eyebrow}
          </Text>
          <span className={cn('badge')}>{currentSubject.level}</span>
        </div>

        <div
          className={cn('subjectTabs')}
          role="tablist"
          aria-label={CONCEPT_MAP_TEXT.switchSubjectLabel}
        >
          {CONCEPT_MAP_SUBJECTS.map(subject => {
            const isActive = subject.id === activeSubjectId;
            return (
              <button
                key={subject.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn('subjectButton', {
                  subjectButtonActive: isActive,
                })}
                onClick={() => handleSelectSubject(subject.id)}
              >
                {subject.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigable Nodes Grid */}
      <div className={cn('nodesTrackContainer')}>
        <div
          className={cn('nodesTrack')}
          role="tablist"
          aria-label={CONCEPT_MAP_TEXT.conceptsLabel}
        >
          {currentSubject.nodes.map((node, index) => {
            const isSelected = node.id === activeNodeId;
            const tabId = `${mapId}-node-${node.id}`;

            return (
              <button
                key={node.id}
                id={tabId}
                type="button"
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls={panelId}
                className={cn('nodeButton', {
                  nodeButtonActive: isSelected,
                })}
                onClick={() => setActiveNodeId(node.id)}
                onKeyDown={e => handleKeyDown(e, index)}
              >
                <div className={cn('nodeHeader')}>
                  <span className={cn('nodeStep')}>{node.step}</span>
                </div>
                <span className={cn('nodeTitle')}>{node.title}</span>
                <span className={cn('nodeCategory')}>{node.category}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Concept Details Panel */}
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${mapId}-node-${selectedNode.id}`}
        className={cn('detailsPanel')}
      >
        <div className={cn('detailsHeader')}>
          <div className={cn('detailsMetaRow')}>
            <Text
              as="span"
              variant="eyebrow"
              tone="accentInverse"
              className={cn('detailsCategory')}
            >
              {`Concept ${selectedNode.step} · ${selectedNode.category}`}
            </Text>
            <span className={cn('detailsStatus')}>
              {selectedNode.statusLabel}
            </span>
          </div>

          <Heading level={3} variant="title" className={cn('detailsTitle')}>
            {selectedNode.title}
          </Heading>

          <p className={cn('detailsSummary')}>{selectedNode.summary}</p>
        </div>

        {/* Subtopic Checklist */}
        <ul className={cn('subtopicsList')}>
          {selectedNode.subtopics.map(subtopic => (
            <li key={subtopic} className={cn('subtopicItem')}>
              <span className={cn('subtopicPip')} aria-hidden="true">
                ■
              </span>
              <span>{subtopic}</span>
            </li>
          ))}
        </ul>

        {/* Working Actions */}
        <div className={cn('detailsActions')}>
          {selectedNode.catalogueTopicId && onOpenTopic ? (
            <Button
              variant="primary"
              endIcon="arrowRight"
              className={cn('actionButton')}
              onClick={() => onOpenTopic(selectedNode.catalogueTopicId!)}
            >
              {CONCEPT_MAP_TEXT.openBatchAction}
            </Button>
          ) : (
            <ButtonLink
              variant="secondary"
              tone="inverse"
              href={toSectionHref(HOME_SECTION_ID.topics)}
              endIcon="arrowRight"
              className={cn('actionButton')}
            >
              {CONCEPT_MAP_TEXT.exploreTopicAction}
            </ButtonLink>
          )}

          <span className={cn('statusNote')}>
            {selectedNode.catalogueTopicId
              ? 'Active batches available for enrollment'
              : 'Class 12 academic syllabus module'}
          </span>
        </div>
      </div>
    </div>
  );
};
