import cx from 'classnames/bind';

import { Text } from '@components/ui/Text/Text';
import { LANDING_TEXT } from '@constants/landing';

import styles from './TopicSubtopicsOverlay.module.css';

const cn = cx.bind(styles);

export type TopicSubtopicsOverlayProps = {
  id: string;
  title: string;
  level: string;
  subtopics: readonly string[];
  className?: string;
};

// What a topic teaches, revealed over its card on hover or keyboard focus.
// The topic and level are named in the description for screen readers.
// It uses phrasing elements only and doubles as the accessible description
// of the card's action button.
export const TopicSubtopicsOverlay = ({
  id,
  title,
  level,
  subtopics,
  className,
}: TopicSubtopicsOverlayProps) => (
  <span id={id} className={cn('overlay', className)}>
    <span className={cn('visuallyHidden')}>{`${title} · ${level}`}</span>
    <Text as="span" variant="numeral" tone="inverse" className={cn('title')}>
      {LANDING_TEXT.overlayTitle}
    </Text>

    <span className={cn('subtopics')}>
      {subtopics.map((subtopic, index) => (
        <span key={subtopic} className={cn('subtopic')}>
          <Text as="span" variant="label" tone="accentInverse">
            {String(index + 1).padStart(2, '0')}
          </Text>
          <Text as="span" variant="small" tone="inverse">
            {subtopic}
          </Text>
        </span>
      ))}
    </span>
  </span>
);
