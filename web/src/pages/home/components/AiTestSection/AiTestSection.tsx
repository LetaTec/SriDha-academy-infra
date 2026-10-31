import { useRef } from 'react';
import cx from 'classnames/bind';

import { SampleTestPaper } from '@components/assessment/SampleTestPaper/SampleTestPaper';
import { Button } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Reveal } from '@components/ui/Reveal/Reveal';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { AI_TEST_TEXT } from '@constants/home';
import { HOME_SECTION_ID } from '@constants/routes';

import styles from './AiTestSection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'ai-test-title';

// Live interactive assessment preview: Try a sample test paper right in the browser.
// Focuses the first answer option when clicking "Start sample test".
export const AiTestSection = () => {
  const paperRef = useRef<HTMLDivElement>(null);

  const handleStartSample = () => {
    const paper = paperRef.current;
    if (!paper) return;
    paper.scrollIntoView({ block: 'center' });
    paper
      .querySelector<HTMLInputElement>('input')
      ?.focus({ preventScroll: true });
  };

  return (
    <Section id={HOME_SECTION_ID.aiTest} tone="inverse" labelledBy={TITLE_ID}>
      <div className={cn('grid')}>
        <Reveal className={cn('copy')}>
          <Text as="div" variant="eyebrow" tone="accentInverse">
            {AI_TEST_TEXT.eyebrow}
          </Text>
          <Heading
            level={2}
            variant="feature"
            tone="inverse"
            id={TITLE_ID}
            className={cn('title')}
          >
            {AI_TEST_TEXT.title}
            <br />
            <em>{AI_TEST_TEXT.titleEmphasis}</em>
          </Heading>
          <Text as="p" tone="inverseMuted" className={cn('description')}>
            {AI_TEST_TEXT.description}
          </Text>

          <ul className={cn('featuresList')}>
            <li className={cn('featureItem')}>
              <span>Algorithmic paper generation from syllabus blueprints</span>
            </li>
            <li className={cn('featureItem')}>
              <span>Instant step-marking with detailed reasoning</span>
            </li>
            <li className={cn('featureItem')}>
              <span>Client-side demonstration · No login required</span>
            </li>
          </ul>

          <Button
            variant="secondary"
            tone="inverse"
            endIcon="arrowRight"
            className={cn('action')}
            onClick={handleStartSample}
          >
            {AI_TEST_TEXT.action}
          </Button>
        </Reveal>

        <div ref={paperRef} className={cn('paperWrapper')}>
          <Reveal>
            <div className={cn('paperBanner')}>
              <span>Interactive Assessment Preview</span>
              <span className={cn('bannerPip')}>
                5 Questions · Auto-Marking
              </span>
            </div>
            <SampleTestPaper />
          </Reveal>
        </div>
      </div>
    </Section>
  );
};
