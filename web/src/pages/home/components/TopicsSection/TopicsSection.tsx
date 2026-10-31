import cx from 'classnames/bind';

import { TopicPreviewGrid } from '@components/catalogue/TopicPreviewGrid/TopicPreviewGrid';
import { TopicsStatus } from '@components/catalogue/TopicsStatus/TopicsStatus';
import { ButtonRouteLink } from '@components/ui/Button/Button';
import { Section } from '@components/ui/Section/Section';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { TOPICS_TEXT } from '@constants/home';
import { APP_ROUTES, HOME_SECTION_ID } from '@constants/routes';
import { HOME_TOPIC_COUNT } from '@constants/topics';
import type { CatalogueState } from '@hooks/useCatalogue';
import { useCheckout } from '@hooks/useCheckout';
import { useTopicPreviews } from '@hooks/useTopicPreviews';
import type { Batch } from '@services/catalogue';

import { InteractiveBook } from '../InteractiveBook/InteractiveBook';
import styles from './TopicsSection.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'topics-title';

export type TopicsSectionProps = {
  catalogue: CatalogueState;
  onOpenTopic?: (topicId: string) => void;
  onSelectBatch?: (nextTopicId: string, batch: Batch) => void;
};

// Section 2: Real subject and topic discovery.
// Combines the Living Syllabus interactive book with topic batch previews and direct checkout.
export const TopicsSection = ({
  catalogue,
  onOpenTopic = () => {},
  onSelectBatch = () => {},
}: TopicsSectionProps) => {
  const { openCheckout } = useCheckout();
  const { previews, isLoading, hasError, reload } = useTopicPreviews();

  return (
    <Section id={HOME_SECTION_ID.topics} labelledBy={TITLE_ID}>
      <SectionHead
        titleId={TITLE_ID}
        title={
          <>
            {TOPICS_TEXT.title}
            <br />
            <em>{TOPICS_TEXT.titleEmphasis}</em>
          </>
        }
        description={TOPICS_TEXT.description}
      />

      {/* Living Syllabus Interactive Book */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <InteractiveBook
          catalogue={catalogue}
          onOpenTopic={onOpenTopic}
          onSelectBatch={onSelectBatch}
        />
      </div>

      {/* Topic Batch Previews */}
      {isLoading || hasError ? (
        <TopicsStatus hasError={hasError} onRetry={reload} />
      ) : (
        <>
          <TopicPreviewGrid
            previews={previews}
            onChooseTopic={openCheckout}
            limit={HOME_TOPIC_COUNT}
          />
          <div className={cn('more')}>
            <ButtonRouteLink
              to={APP_ROUTES.TOPICS}
              variant="secondary"
              endIcon="arrowRight"
            >
              {TOPICS_TEXT.seeAll(previews.length)}
            </ButtonRouteLink>
          </div>
        </>
      )}
    </Section>
  );
};
