import cx from 'classnames/bind';

import { ButtonLink, ButtonRouteLink } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import { HERO_TEXT } from '@constants/home';
import { APP_ROUTES, HOME_SECTION_ID, toSectionHref } from '@constants/routes';
import type { CatalogueState } from '@hooks/useCatalogue';
import type { Batch } from '@services/catalogue';

import { ConceptMap } from './ConceptMap/ConceptMap';
import styles from './HeroSection.module.css';

const cn = cx.bind(styles);

export type HeroSectionProps = {
  catalogue?: CatalogueState;
  onOpenTopic?: (topicId: string) => void;
  onSelectBatch?: (nextTopicId: string, batch: Batch) => void;
};

export const HeroSection = ({ onOpenTopic }: HeroSectionProps) => (
  <section
    id={HOME_SECTION_ID.home}
    className={cn('heroSection')}
    aria-label="SriDha Academy homepage hero introduction"
  >
    <Container className={cn('container')}>
      <div className={cn('grid')}>
        {/* Left Column: Headline and Primary Actions (~44%) */}
        <div className={cn('copyColumn')}>
          <div className={cn('kicker')}>
            <Text
              as="span"
              variant="eyebrow"
              tone="accentInverse"
              className={cn('kickerText')}
            >
              {HERO_TEXT.kicker}
            </Text>
          </div>

          <Heading
            level={1}
            variant="hero"
            tone="inverse"
            className={cn('title')}
          >
            {HERO_TEXT.title}
            <br />
            <em>
              {HERO_TEXT.titleEmphasis} {HERO_TEXT.titleEnd}
            </em>
          </Heading>

          <Text
            as="p"
            variant="lead"
            tone="inverseMuted"
            className={cn('lead')}
          >
            {HERO_TEXT.lead}
          </Text>

          <div className={cn('actions')}>
            <ButtonLink
              href={toSectionHref(HOME_SECTION_ID.topics)}
              variant="primary"
              endIcon="arrowUpRight"
              className={cn('primaryCta')}
            >
              {HERO_TEXT.primaryAction}
            </ButtonLink>
            <ButtonRouteLink
              to={APP_ROUTES.REGISTER}
              variant="secondary"
              tone="inverse"
              className={cn('secondaryCta')}
            >
              {HERO_TEXT.secondaryAction}
            </ButtonRouteLink>
          </div>

          <div className={cn('methodPillRow')} aria-hidden="true">
            <span className={cn('methodPill')}>Live Topic Batches</span>
            <span className={cn('methodPill')}>Clear Topic Milestones</span>
            <span className={cn('methodPill')}>Practice Tests</span>
          </div>
        </div>

        {/* Right Column: Interactive Concept Map (~56%) */}
        <div className={cn('demoColumn')}>
          <ConceptMap onOpenTopic={onOpenTopic} />
        </div>
      </div>
    </Container>
  </section>
);
