import cx from 'classnames/bind';

import { HeroScene } from '@components/brand/HeroScene/HeroScene';
import { Heading } from '@components/ui/Heading/Heading';
import { Reveal } from '@components/ui/Reveal/Reveal';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { ABOUT_PAGE_TEXT } from '@constants/about';

import styles from './InspirationSection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'inspiration-title';
const { inspiration } = ABOUT_PAGE_TEXT;

export const InspirationSection = () => (
  <Section tone="subtle" labelledBy={TITLE_ID}>
    <div className={cn('grid')}>
      <HeroScene
        scene={inspiration.illustration}
        className={cn('illustration')}
      />

      <Reveal className={cn('story')}>
        <Heading level={2} variant="display" id={TITLE_ID}>
          {inspiration.title} <em>{inspiration.titleEmphasis}</em>
        </Heading>
        <blockquote className={cn('quote')}>
          <p>{inspiration.quote}</p>
        </blockquote>
        {inspiration.paragraphs.map(paragraph => (
          <Text key={paragraph} as="p" tone="muted" className={cn('paragraph')}>
            {paragraph}
          </Text>
        ))}
      </Reveal>
    </div>
  </Section>
);
