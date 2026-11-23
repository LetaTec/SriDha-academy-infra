import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import cx from 'classnames/bind';

import { canAnswerPapers, mustSignInToAnswer } from '@/access/papers';
import { PaperAnswers } from '@components/assessment/PaperAnswers/PaperAnswers';
import { PaperSheet } from '@components/assessment/PaperSheet/PaperSheet';
import { AccountDialog } from '@components/auth/AccountDialog/AccountDialog';
import { TopicsStatus } from '@components/catalogue/TopicsStatus/TopicsStatus';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { Heading } from '@components/ui/Heading/Heading';
import { RuledList } from '@components/ui/RuledList/RuledList';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import {
  TOPIC_TEST_DURATION_SECONDS,
  TOPIC_TEST_TEXT as TEXT,
  type SampleTestQuestion,
} from '@constants/assessment';
import { APP_ROUTES } from '@constants/routes';
import { findTopicTest } from '@constants/topicTestPapers';
import { useAuth } from '@context/AuthContext';
import { useTopicPreviews } from '@hooks/useTopicPreviews';
import type { TopicPreview } from '@services/catalogue';

import styles from './TopicTestPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'topic-test-page-title';

const BackLink = () => (
  <ButtonRouteLink to={APP_ROUTES.TOPIC_TESTS} variant="secondary">
    {TEXT.back}
  </ButtonRouteLink>
);

// The rules first; the clock starts only when the student presses start.
// A visitor signs up first, so the two hours never run during sign-up.
const TopicTest = ({
  preview,
  questions,
}: {
  preview: TopicPreview;
  questions: readonly SampleTestQuestion[];
}) => {
  const auth = useAuth();
  const [isStarted, setIsStarted] = useState(false);
  // Start was pressed before signing up, or while the session loaded
  const [wantsToStart, setWantsToStart] = useState(false);
  const canStart = canAnswerPapers(auth);

  useEffect(() => {
    if (wantsToStart && canStart) {
      setIsStarted(true);
      setWantsToStart(false);
    }
  }, [wantsToStart, canStart]);

  const handleStart = () => {
    if (canStart) setIsStarted(true);
    else setWantsToStart(true);
  };

  return (
    <>
      <div className={cn('intro')}>
        <Text as="div" variant="eyebrow">
          {TEXT.eyebrow(preview.level)}
        </Text>
        <Heading level={1} variant="hero" id={TITLE_ID}>
          {preview.title}
          <br />
          <em>{TEXT.titleEmphasis}</em>
        </Heading>
      </div>

      {isStarted ? (
        <div className={cn('paper')}>
          <PaperSheet
            label={TEXT.paperLabel}
            questionCount={questions.length}
            meta={TEXT.meta(preview.level, preview.title, questions.length)}
            layout="wide"
          >
            <PaperAnswers
              questions={questions}
              durationSeconds={TOPIC_TEST_DURATION_SECONDS}
              instruction={TEXT.instruction}
              startsOnOpen
            />
          </PaperSheet>
        </div>
      ) : (
        <section className={cn('rules')} aria-label={TEXT.rulesLabel}>
          <RuledList items={TEXT.rules(questions.length)} />
          <Button
            endIcon="arrowRight"
            onClick={handleStart}
            className={cn('start')}
          >
            {TEXT.start}
          </Button>
        </section>
      )}

      <div className={cn('footer')}>
        <BackLink />
      </div>

      <AccountDialog
        open={wantsToStart && mustSignInToAnswer(auth)}
        onClose={() => setWantsToStart(false)}
        onSignedIn={() => setIsStarted(true)}
      />
    </>
  );
};

// One topic's test, at /topic-tests/:topicId. The topic's name and class
// come from the catalogue; its questions from the topic test bank.
const TopicTestPage = () => {
  const { topicId = '' } = useParams();
  const { previews, isLoading, hasError, reload } = useTopicPreviews();
  const preview =
    previews.find(item => item.catalogueTopicId === topicId) ?? null;
  const questions = findTopicTest(topicId);

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      {isLoading || hasError ? (
        <TopicsStatus hasError={hasError} onRetry={reload} />
      ) : preview && questions ? (
        // A different topic is a fresh start
        <TopicTest key={topicId} preview={preview} questions={questions} />
      ) : (
        <div className={cn('intro')}>
          <Heading level={1} variant="title" id={TITLE_ID}>
            {TEXT.notReadyTitle}
          </Heading>
          <Text as="p" tone="muted">
            {TEXT.notReadyMessage}
          </Text>
          <BackLink />
        </div>
      )}
    </Section>
  );
};

export default TopicTestPage;
