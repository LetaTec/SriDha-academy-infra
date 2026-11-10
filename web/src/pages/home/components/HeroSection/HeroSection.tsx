import cx from 'classnames/bind';

import { TopicSearch } from '@components/catalogue/TopicSearch/TopicSearch';
import { Button } from '@components/ui/Button/Button';
import { Container } from '@components/ui/Container/Container';
import { Heading } from '@components/ui/Heading/Heading';
import { Photo } from '@components/ui/Photo/Photo';
import { Text } from '@components/ui/Text/Text';
import { HERO_PHOTOS, HERO_TEXT } from '@constants/home';
import { STUDENT_PHOTOS, type StudentPhotoKey } from '@constants/photos';
import { HOME_SECTION_ID } from '@constants/routes';
import { useTopicPreviews } from '@hooks/useTopicPreviews';
import { hasBatches, type TopicPreview } from '@services/catalogue';

import styles from './HeroSection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'hero-title';

// Featured topics come first in the catalogue's previews
const POPULAR_TOPIC_COUNT = 4;

// Static, like every photo on the site; the first of each side stays on phones
const PhotoColumn = ({
  photos,
  side,
}: {
  photos: readonly StudentPhotoKey[];
  side: 'start' | 'end';
}) => (
  <div className={cn('photos', side)}>
    {photos.map((key, index) => {
      const photo = STUDENT_PHOTOS[key];
      return (
        <Photo
          key={key}
          src={photo.src}
          alt={photo.alt}
          credit={photo.credit}
          ratio={
            (index === 0) === (side === 'start') ? 'portrait' : 'landscape'
          }
          frame="offset"
          tone="inverse"
          loading="eager"
          className={cn('photo', { photoExtra: index > 0 })}
        />
      );
    })}
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
        <PhotoColumn photos={HERO_PHOTOS.start} side="start" />
        <div className={cn('center')}>
          <Text as="div" variant="eyebrow" tone="accentInverse">
            {HERO_TEXT.kicker}
          </Text>

          <Heading
            level={1}
            variant="hero"
            tone="inverse"
            id={TITLE_ID}
            className={cn('title')}
          >
            {HERO_TEXT.title} <em>{HERO_TEXT.titleEmphasis}</em>
          </Heading>

          <Text
            as="p"
            variant="lead"
            tone="inverseMuted"
            className={cn('lead')}
          >
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
              <Text as="span" variant="small" tone="inverseMuted">
                {HERO_TEXT.popularLabel}
              </Text>
              {popular.map(preview => (
                <Button
                  key={preview.catalogueTopicId}
                  variant="secondary"
                  tone="inverse"
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
                <Text as="span" variant="small" tone="inverseMuted">
                  {item}
                </Text>
              </li>
            ))}
          </ul>
        </div>
        <PhotoColumn photos={HERO_PHOTOS.end} side="end" />
      </Container>
    </section>
  );
};
