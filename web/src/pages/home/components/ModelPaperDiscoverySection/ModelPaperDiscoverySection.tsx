import cx from 'classnames/bind';

import { Button, ButtonLink } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { Reveal } from '@components/ui/Reveal/Reveal';
import { Section } from '@components/ui/Section/Section';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { MODEL_PAPER_DISCOVERY_TEXT } from '@constants/home';
import { HOME_SECTION_ID, toSectionHref } from '@constants/routes';

import styles from './ModelPaperDiscoverySection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'model-paper-discovery-title';

export type ModelPaperDiscoverySectionProps = {
  onJoinWaitlist: () => void;
};

export const ModelPaperDiscoverySection = ({
  onJoinWaitlist,
}: ModelPaperDiscoverySectionProps) => (
  <Section
    id={HOME_SECTION_ID.modelPaper}
    tone="subtle"
    divider
    labelledBy={TITLE_ID}
  >
    <SectionHead
      titleId={TITLE_ID}
      title={
        <>
          {MODEL_PAPER_DISCOVERY_TEXT.title}
          <br />
          <em>{MODEL_PAPER_DISCOVERY_TEXT.titleEmphasis}</em>
        </>
      }
      description={MODEL_PAPER_DISCOVERY_TEXT.description}
    />

    <div className={cn('grid')}>
      {/* Column 1: Verified Previous-Year Questions (PYQs) */}
      <Reveal className={cn('card')}>
        <div className={cn('cardContent')}>
          <div className={cn('badgeRow')}>
            <span className={cn('badge')}>
              {MODEL_PAPER_DISCOVERY_TEXT.pyqBadge}
            </span>
          </div>

          <Heading level={3} variant="feature" className={cn('cardTitle')}>
            {MODEL_PAPER_DISCOVERY_TEXT.pyqTitle}
          </Heading>

          <p className={cn('cardDescription')}>
            {MODEL_PAPER_DISCOVERY_TEXT.pyqDescription}
          </p>

          <ul className={cn('itemsList')}>
            {MODEL_PAPER_DISCOVERY_TEXT.pyqItems.map(item => (
              <li key={item} className={cn('item')}>
                <span className={cn('itemPip')} aria-hidden="true">
                  ■
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn('footer')}>
          <span className={cn('footnote')}>
            Official Board Marking Standards
          </span>
          <ButtonLink
            variant="editorial"
            href={toSectionHref(HOME_SECTION_ID.topics)}
            endIcon="arrowRight"
          >
            {MODEL_PAPER_DISCOVERY_TEXT.pyqAction}
          </ButtonLink>
        </div>
      </Reveal>

      {/* Column 2: Predictive AI Model Papers */}
      <Reveal className={cn('card', 'cardFeatured')}>
        <div className={cn('cardContent')}>
          <div className={cn('badgeRow')}>
            <span className={cn('badge', 'badgeFeatured')}>
              {MODEL_PAPER_DISCOVERY_TEXT.modelPaperBadge}
            </span>
          </div>

          <Heading level={3} variant="feature" className={cn('cardTitle')}>
            {MODEL_PAPER_DISCOVERY_TEXT.modelPaperTitle}
          </Heading>

          <p className={cn('cardDescription')}>
            {MODEL_PAPER_DISCOVERY_TEXT.modelPaperDescription}
          </p>

          <ul className={cn('itemsList')}>
            {MODEL_PAPER_DISCOVERY_TEXT.modelPaperItems.map(item => (
              <li key={item} className={cn('item')}>
                <span className={cn('itemPip')} aria-hidden="true">
                  ■
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn('footer')}>
          <span className={cn('footnote')}>
            Teacher-Reviewed · 7 Days Pre-Exam
          </span>
          <Button
            variant="editorial"
            endIcon="arrowRight"
            onClick={onJoinWaitlist}
          >
            {MODEL_PAPER_DISCOVERY_TEXT.modelPaperAction}
          </Button>
        </div>
      </Reveal>
    </div>
  </Section>
);
