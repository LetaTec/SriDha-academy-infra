import cx from 'classnames/bind';

import { StudentIllustration } from '@components/brand/StudentIllustration/StudentIllustration';
import { TopicSearch } from '@components/catalogue/TopicSearch/TopicSearch';
import { Button } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import { HERO_ILLUSTRATIONS, HERO_TEXT } from '@constants/home';
import { HOME_SECTION_ID } from '@constants/routes';
import { useTopicPreviews } from '@hooks/useTopicPreviews';
import { hasBatches, type TopicPreview } from '@services/catalogue';

import styles from './HeroSection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'hero-title';

// Featured topics come first in the catalogue's previews
const POPULAR_TOPIC_COUNT = 4;

// Static, like every illustration on the site; the first of each side stays
// on phones. Decorative: the search beside them says what the page is for.
const IllustrationColumn = ({
  side,
}: {
  side: keyof typeof HERO_ILLUSTRATIONS;
}) => (
  <div className={cn('photos', side)} aria-hidden="true">
    {HERO_ILLUSTRATIONS[side].map((item, index) => (
      <div key={item.scene} className={cn('photo', { photoExtra: index > 0 })}>
        <StudentIllustration scene={item.scene} palette={item.palette} />
      </div>
    ))}
  </div>
);

export type HeroSectionProps = {
  onOpenTopic: (topicId: string) => void;
  onSelectBatch: (topicId: string, batchId: string) => void;
  // Opens the Topics page searched for the query
  onBrowseTopics: (query: string) => void;
};

// Section 1: "Search your topic". The first thing every visitor sees, with no
// account needed: search by topic or class, then open a topic or a batch.
export const HeroSection = ({
  onOpenTopic,
  onSelectBatch,
  onBrowseTopics,
}: HeroSectionProps) => {
  const { previews } = useTopicPreviews();
  const popular = previews.slice(0, POPULAR_TOPIC_COUNT);

  const choosePopular = (preview: TopicPreview) => {
    if (hasBatches(preview)) onOpenTopic(preview.topic.id);
    else onBrowseTopics(preview.title);
  };

  return (
    <section
      id={HOME_SECTION_ID.home}
      className={cn('heroSection')}
      aria-labelledby={TITLE_ID}
    >
      <Container className={cn('layout')}>
        <IllustrationColumn side="start" />
        <div className={cn('center')}>
          <Text as="div" variant="eyebrow" tone="accent">
            {HERO_TEXT.kicker}
          </Text>

          <Heading
            level={1}
            variant="hero"
            id={TITLE_ID}
            className={cn('title')}
          >
            {HERO_TEXT.title} <em>{HERO_TEXT.titleEmphasis}</em>
          </Heading>

          <Text as="p" variant="lead" tone="muted" className={cn('lead')}>
            {HERO_TEXT.lead}
          </Text>

          <div className={cn('searchRow')}>
            <TopicSearch
              size="large"
              label={HERO_TEXT.searchLabel}
              previews={previews}
              onOpenTopic={onOpenTopic}
              onSelectBatch={onSelectBatch}
              onBrowseTopics={onBrowseTopics}
            />
          </div>

          {popular.length > 0 ? (
            <div className={cn('popular')}>
              <Text as="span" variant="small" tone="muted">
                {HERO_TEXT.popularLabel}
              </Text>
              {popular.map(preview => (
                <Button
                  key={preview.catalogueTopicId}
                  variant="secondary"
                  className={cn('popularTopic')}
                  onClick={() => choosePopular(preview)}
                >
                  {preview.title}
                </Button>
              ))}
            </div>
          ) : null}

          <ul className={cn('highlights')}>
            {HERO_TEXT.highlights.map(item => (
              <li key={item} className={cn('highlight')}>
                <span className={cn('highlightDot')} aria-hidden="true" />
                <Text as="span" variant="small" tone="muted">
                  {item}
                </Text>
              </li>
            ))}
          </ul>
        </div>
        <IllustrationColumn side="end" />
      </Container>
    </section>
  );
};
