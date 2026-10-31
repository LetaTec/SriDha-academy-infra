import cx from 'classnames/bind';

import { FeatureIllustration } from '@components/brand/FeatureIllustration/FeatureIllustration';
import { Heading } from '@components/ui/Heading/Heading';
import { Reveal } from '@components/ui/Reveal/Reveal';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import { LANDING_TEXT } from '@constants/landing';

import styles from './FeatureSection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'feature-title';

// How SriDha Academy works, told as three short chapters with a plate each.
// Chapters alternate sides, like facing pages.
export const FeatureSection = () => (
  <Section tone="subtle" labelledBy={TITLE_ID}>
    <Reveal className={cn('head')}>
      <Text as="div" variant="eyebrow" tone="accent">
        {LANDING_TEXT.featuresEyebrow}
      </Text>
      <Heading level={2} variant="display" id={TITLE_ID}>
        {LANDING_TEXT.featuresTitle}{' '}
        <em>{LANDING_TEXT.featuresTitleEmphasis}</em>
      </Heading>
      <Text as="p" tone="muted" className={cn('lead')}>
        {LANDING_TEXT.featuresDescription}
      </Text>
    </Reveal>

    <ol className={cn('chapters')}>
      {LANDING_TEXT.features.map((feature, index) => (
        <Reveal
          as="li"
          key={feature.title}
          className={cn('chapter', { flipped: index % 2 === 1 })}
        >
          <div className={cn('copy')}>
            <Text as="div" variant="label" tone="accent">
              {LANDING_TEXT.featureChapter(index + 1)}
            </Text>
            <span className={cn('numeral')} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <Heading level={3} variant="title">
              {feature.title}
            </Heading>
            <Text as="p" className={cn('supportingHeading')}>
              {feature.supportingHeading}
            </Text>
            <Text as="p" tone="muted" className={cn('description')}>
              {feature.description}
            </Text>
            <Text as="p" className={cn('closingLine')}>
              {feature.closingLine}
            </Text>
          </div>

          <figure className={cn('plate')}>
            <FeatureIllustration variant={feature.illustration} />
            <figcaption>
              <Text as="span" variant="caption" tone="muted">
                {LANDING_TEXT.featurePlate(index + 1)}
              </Text>
            </figcaption>
          </figure>
        </Reveal>
      ))}
    </ol>
  </Section>
);
