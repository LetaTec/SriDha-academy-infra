import { TopicPreviewGrid } from '@components/catalogue/TopicPreviewGrid/TopicPreviewGrid';
import { Section } from '@components/ui/Section/Section';
import { SectionHead } from '@components/ui/SectionHead/SectionHead';
import { TOPICS_TEXT } from '@constants/home';
import { HOME_SECTION_ID } from '@constants/routes';
import type { CatalogueState } from '@hooks/useCatalogue';
import { listTopics, type Batch } from '@services/catalogue';

import { InteractiveBook } from '../InteractiveBook/InteractiveBook';

const TITLE_ID = 'topics-title';

export type TopicsSectionProps = {
  catalogue: CatalogueState;
  onOpenTopic: (topicId: string) => void;
  onSelectBatch?: (nextTopicId: string, batch: Batch) => void;
};

// Section 2: Real subject and topic discovery.
// Combines the Living Syllabus interactive book with the topic batch cards.
export const TopicsSection = ({
  catalogue,
  onOpenTopic,
  onSelectBatch = () => {},
}: TopicsSectionProps) => {
  const catalogueTopics = listTopics(catalogue.subjects).map(
    context => context.topic,
  );

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
      <TopicPreviewGrid
        catalogueTopics={catalogueTopics}
        onSelectTopic={onOpenTopic}
        actionLabel={TOPICS_TEXT.openTopicLabel}
      />
    </Section>
  );
};
