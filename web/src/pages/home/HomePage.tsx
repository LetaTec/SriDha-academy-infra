import { useNavigate } from 'react-router-dom';

import { ClosingCta } from '@components/brand/ClosingCta/ClosingCta';
import { CTA_TEXT } from '@constants/home';
import { APP_ROUTES } from '@constants/routes';
import { useCatalogue } from '@hooks/useCatalogue';
import { TOPIC_FILTER_PARAM } from '@constants/topics';
import { useCheckout } from '@hooks/useCheckout';
import { useTopicSelection } from '@hooks/useTopicSelection';
import {
  findBatchContext,
  findTopicContext,
  type Batch,
} from '@services/catalogue';

import { AiTestSection } from './components/AiTestSection/AiTestSection';
import { HeroSection } from './components/HeroSection/HeroSection';
import { LearningJourneySection } from './components/LearningJourneySection/LearningJourneySection';
import { ProgramsSection } from './components/ProgramsSection/ProgramsSection';
import { TopicDialog } from './components/TopicDialog/TopicDialog';
import { TopicsSection } from './components/TopicsSection/TopicsSection';

const HomePage = () => {
  const catalogue = useCatalogue();
  const { topicId, batchId, openTopic, selectBatch, clearBatch, closeTopic } =
    useTopicSelection();
  const { openCheckout } = useCheckout();
  const navigate = useNavigate();

  const topicContext = findTopicContext(catalogue.subjects, topicId);
  const batchContext = findBatchContext(catalogue.subjects, batchId);
  const selection =
    batchContext &&
    topicContext &&
    batchContext.topic.id === topicContext.topic.id
      ? batchContext
      : null;
  const hasUnknownBatch =
    !catalogue.isLoading && Boolean(batchId) && selection === null;

  const handleSelectBatch = (nextTopicId: string, batch: Batch) =>
    selectBatch(nextTopicId, batch.id);

  const browseTopics = (query: string) =>
    navigate({
      pathname: APP_ROUTES.TOPICS,
      search: `?${new URLSearchParams({ [TOPIC_FILTER_PARAM.query]: query })}`,
    });

  return (
    <>
      {/* 1. Search your topic */}
      <HeroSection
        onOpenTopic={topicId => openCheckout(topicId)}
        onSelectBatch={openCheckout}
        onBrowseTopics={browseTopics}
      />
      {/* 2. AI Assessment Experience, right under the search */}
      <AiTestSection />

      {/* 3. Real Subject Discovery */}
      <TopicsSection
        catalogue={catalogue}
        onOpenTopic={openTopic}
        onSelectBatch={handleSelectBatch}
      />

      {/* 4. Interactive Learning Journey */}
      <LearningJourneySection />

      {/* 5. The three paths: classes, past papers, topic tests */}
      <ProgramsSection />

      {/* 6. Closing CTA */}
      <ClosingCta
        titleId="cta-title"
        eyebrow={CTA_TEXT.eyebrow}
        title={CTA_TEXT.title}
        titleEmphasis={CTA_TEXT.titleEmphasis}
        actionLabel={CTA_TEXT.action}
        to={APP_ROUTES.TOPICS}
      />

      {/* A topic opened from the topics section, kept in the URL */}
      <TopicDialog
        open={topicContext !== null}
        context={topicContext}
        selection={selection}
        hasUnknownBatch={hasUnknownBatch}
        onClose={closeTopic}
        onSelectBatch={batch =>
          topicContext && handleSelectBatch(topicContext.topic.id, batch)
        }
        onClearBatch={clearBatch}
        onContinueToPayment={selection =>
          openCheckout(selection.topic.id, selection.batch.id)
        }
      />
    </>
  );
};

export default HomePage;
