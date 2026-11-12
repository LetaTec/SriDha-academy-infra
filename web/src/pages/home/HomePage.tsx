import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ClosingCta } from '@components/brand/ClosingCta/ClosingCta';
import { ModelPaperDialog } from '@components/enquiries/ModelPaperDialog/ModelPaperDialog';
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

import { AiTestDialog } from './components/AiTestDialog/AiTestDialog';
import { AiTestSection } from './components/AiTestSection/AiTestSection';
import { HeroSection } from './components/HeroSection/HeroSection';
import { LearningJourneySection } from './components/LearningJourneySection/LearningJourneySection';
import { ModelPaperDiscoverySection } from './components/ModelPaperDiscoverySection/ModelPaperDiscoverySection';
import { ProgramsSection } from './components/ProgramsSection/ProgramsSection';
import { TopicDialog } from './components/TopicDialog/TopicDialog';
import { TopicsSection } from './components/TopicsSection/TopicsSection';

type HomeDialog = 'modelPaper' | 'aiTest';

const HomePage = () => {
  const catalogue = useCatalogue();
  const { topicId, batchId, openTopic, selectBatch, clearBatch, closeTopic } =
    useTopicSelection();
  const { openCheckout } = useCheckout();
  const [activeDialog, setActiveDialog] = useState<HomeDialog | null>(null);
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

  const closeDialog = () => setActiveDialog(null);

  const browseTopics = (query: string) =>
    navigate({
      pathname: APP_ROUTES.TOPICS,
      search: `?${new URLSearchParams({ [TOPIC_FILTER_PARAM.query]: query })}`,
    });

  return (
    <>
      {/* 1. Search your topic */}
      <HeroSection
        onOpenTopic={openTopic}
        onSelectBatch={selectBatch}
        onBrowseTopics={browseTopics}
      />
      {/* 2. Real Subject Discovery */}
      <TopicsSection
        catalogue={catalogue}
        onOpenTopic={openTopic}
        onSelectBatch={handleSelectBatch}
      />

      {/* 3. Interactive Learning Journey */}
      <LearningJourneySection />

      {/* 4. AI Assessment Experience */}
      <AiTestSection />

      {/* 5. Previous-Year and Model-Paper Discovery */}
      <ModelPaperDiscoverySection
        onJoinWaitlist={() => setActiveDialog('modelPaper')}
      />

      {/* 6. Actual Programs and Available Courses */}
      <ProgramsSection
        onSeeTestFlow={() => setActiveDialog('aiTest')}
        onJoinWaitlist={() => setActiveDialog('modelPaper')}
      />

      {/* 7. Closing CTA */}
      <ClosingCta
        titleId="cta-title"
        eyebrow={CTA_TEXT.eyebrow}
        title={CTA_TEXT.title}
        titleEmphasis={CTA_TEXT.titleEmphasis}
        actionLabel={CTA_TEXT.action}
        to={APP_ROUTES.TOPICS}
      />

      {/* Preserved Modal Dialogs */}
      <TopicDialog
        open={topicContext !== null && activeDialog === null}
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
      <AiTestDialog open={activeDialog === 'aiTest'} onClose={closeDialog} />
      <ModelPaperDialog
        open={activeDialog === 'modelPaper'}
        onClose={closeDialog}
      />
    </>
  );
};

export default HomePage;
