import { useState } from 'react';

import { ClosingCta } from '@components/brand/ClosingCta/ClosingCta';
import { ModelPaperDialog } from '@components/enquiries/ModelPaperDialog/ModelPaperDialog';
import { CTA_TEXT } from '@constants/home';
import { APP_ROUTES, HOME_SECTION_ID, toPageSection } from '@constants/routes';
import { useCatalogue } from '@hooks/useCatalogue';
import { useCheckout } from '@hooks/useCheckout';
import { useTopicSelection } from '@hooks/useTopicSelection';
import {
  findBatchContext,
  findTopicContext,
  type Batch,
} from '@services/catalogue';

import { AboutSection } from './components/AboutSection/AboutSection';
import { AiTestDialog } from './components/AiTestDialog/AiTestDialog';
import { AiTestSection } from './components/AiTestSection/AiTestSection';
import { HeroSection } from './components/HeroSection/HeroSection';
import { ProgramsSection } from './components/ProgramsSection/ProgramsSection';
import { TeamSection } from './components/TeamSection/TeamSection';
import { TopicDialog } from './components/TopicDialog/TopicDialog';
import { TopicsSection } from './components/TopicsSection/TopicsSection';

type HomeDialog = 'modelPaper' | 'aiTest';

const HomePage = () => {
  const catalogue = useCatalogue();
  const { topicId, batchId, openTopic, selectBatch, clearBatch, closeTopic } =
    useTopicSelection();
  const { openCheckout } = useCheckout();
  const [activeDialog, setActiveDialog] = useState<HomeDialog | null>(null);

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

  return (
    <>
      <HeroSection
        catalogue={catalogue}
        onOpenTopic={openTopic}
        onSelectBatch={handleSelectBatch}
      />
      <TopicsSection catalogue={catalogue} />
      <AiTestSection />
      <ProgramsSection
        onSeeTestFlow={() => setActiveDialog('aiTest')}
        onJoinWaitlist={() => setActiveDialog('modelPaper')}
      />
      <AboutSection />
      <TeamSection />
      <ClosingCta
        titleId="cta-title"
        eyebrow={CTA_TEXT.eyebrow}
        title={CTA_TEXT.title}
        titleEmphasis={CTA_TEXT.titleEmphasis}
        actionLabel={CTA_TEXT.action}
        to={toPageSection(APP_ROUTES.HOME, HOME_SECTION_ID.topics)}
      />

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
