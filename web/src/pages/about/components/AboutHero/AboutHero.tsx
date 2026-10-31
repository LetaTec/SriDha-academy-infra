import cx from 'classnames/bind';

import { TopicStatList } from '@components/catalogue/TopicStatList/TopicStatList';
import { Heading } from '@components/ui/Heading/Heading';
import { Photo } from '@components/ui/Photo/Photo';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { ABOUT_PAGE_TEXT } from '@constants/about';
import { STUDENT_PHOTOS } from '@constants/photos';

import styles from './AboutHero.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'about-page-title';
const { hero, stats } = ABOUT_PAGE_TEXT;
const photo = STUDENT_PHOTOS[hero.photo];

export const AboutHero = () => (
  <Section labelledBy={TITLE_ID} className={cn('hero')}>
    <div className={cn('grid')}>
      <div className={cn('copy')}>
        <Text as="div" variant="eyebrow">
          {hero.eyebrow}
        </Text>
        <Heading level={1} variant="hero" id={TITLE_ID}>
          {hero.title}
          <br />
          <em>{hero.titleEmphasis}</em>
        </Heading>
        <Text as="p" variant="lead" tone="muted" className={cn('lead')}>
          {hero.lead}
        </Text>
        <TopicStatList items={stats} className={cn('stats')} />
      </div>

      <Photo
        src={photo.src}
        alt={photo.alt}
        credit={photo.credit}
        ratio="portrait"
        className={cn('photo')}
      />
    </div>
  </Section>
);
