import cx from 'classnames/bind';

import { TopicStatList } from '@components/catalogue/TopicStatList/TopicStatList';
import { ButtonLink, ButtonRouteLink } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import { HERO_TEXT } from '@constants/home';
import { APP_ROUTES, HOME_SECTION_ID, toSectionHref } from '@constants/routes';

import {
  InteractiveBook,
  type InteractiveBookProps,
} from '../InteractiveBook/InteractiveBook';
import styles from './HeroSection.module.css';

const cn = cx.bind(styles);

export type HeroSectionProps = InteractiveBookProps;

export const HeroSection = (bookProps: HeroSectionProps) => (
  <section id={HOME_SECTION_ID.home} className={cn('hero')}>
    <Container className={cn('grid')}>
      <div className={cn('copy')}>
        <Text as="div" variant="eyebrow" tone="accent" className={cn('kicker')}>
          <span className={cn('kickerRule')} aria-hidden="true" />
          {HERO_TEXT.kicker}
        </Text>
        <Heading level={1} variant="hero" className={cn('title')}>
          {HERO_TEXT.title}
          <br />
          <em>{HERO_TEXT.titleEmphasis}</em>
          <br />
          {HERO_TEXT.titleEnd}
        </Heading>
        <Text as="p" variant="lead" tone="muted" className={cn('lead')}>
          {HERO_TEXT.lead}
        </Text>
        <div className={cn('actions')}>
          <ButtonLink
            href={toSectionHref(HOME_SECTION_ID.topics)}
            endIcon="arrowUpRight"
          >
            {HERO_TEXT.primaryAction}
          </ButtonLink>
          <ButtonRouteLink variant="secondary" to={APP_ROUTES.MY_LEARNING}>
            {HERO_TEXT.secondaryAction}
          </ButtonRouteLink>
        </div>
        <TopicStatList items={HERO_TEXT.stats} className={cn('stats')} />
      </div>

      <InteractiveBook {...bookProps} />
    </Container>
  </section>
);
