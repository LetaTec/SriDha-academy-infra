import cx from 'classnames/bind';

import { ButtonRouteLink } from '@components/ui/Button/Button';
import { Card } from '@components/ui/Card/Card';
import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { Container } from '@components/ui/Container/Container';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { LEARNING_JOURNEY_TEXT as TEXT } from '@constants/home';
import { HOME_SECTION_ID } from '@constants/routes';

import styles from './LearningJourneySection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'learning-journey-title';

// How studying with SriDha works: four numbered steps, each linking to the
// part of the site that does it.
export const LearningJourneySection = () => (
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
            {TEXT.title}
            <br />
            <em>{TEXT.titleEmphasis}</em>
          </>
        }
        description={TEXT.description}
      />

      <CardGrid variant="ruled" columns={4} className={cn('steps')}>
        {TEXT.steps.map((step, index) => (
          <Card
            key={step.title}
            label={String(index + 1).padStart(2, '0')}
            title={step.title}
            description={step.description}
            footer={
              <ButtonRouteLink
                to={step.to}
                variant="editorial"
                endIcon="arrowRight"
              >
                {step.action}
              </ButtonRouteLink>
            }
          />
        ))}
      </CardGrid>
    </Container>
  </section>
);
