import type React from 'react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import cx from 'classnames/bind';

import { canAnswerPapers, mustSignInToAnswer } from '@/access/papers';
import { QUERY_KEY } from '@/app/queryClient';
import { PaperAnswers } from '@components/assessment/PaperAnswers/PaperAnswers';
import { PaperSheet } from '@components/assessment/PaperSheet/PaperSheet';
import { AccountDialog } from '@components/auth/AccountDialog/AccountDialog';
import { TopicsStatus } from '@components/catalogue/TopicsStatus/TopicsStatus';
import { Button, ButtonRouteLink } from '@components/ui/Button/Button';
import { FieldStatus } from '@components/ui/Field/Field';
import { Heading } from '@components/ui/Heading/Heading';
import { RuledList } from '@components/ui/RuledList/RuledList';
import { Section } from '@components/ui/Section/Section';
import { Text } from '@components/ui/Text/Text';
import {
  findTopicTestSize,
  TOPIC_TEST_DURATION_SECONDS,
  TOPIC_TEST_TEXT as TEXT,
} from '@constants/assessment';
import { APP_ROUTES, toTopicTest } from '@constants/routes';
import { useAuth } from '@context/AuthContext';
import { useActivePaper } from '@hooks/useActivePaper';
import { toTestCheckoutPath } from '@hooks/useCheckout';
import { loadTopicPapers, useTopicPaper } from '@hooks/useQuestionBanks';
import { useTestAttempts } from '@hooks/useTestAttempts';
import { useTopicPreviews } from '@hooks/useTopicPreviews';
import type { TopicPreview } from '@services/catalogue';
import {
  finishTestAttempt,
  startTestAttempt,
  type TestAttempt,
} from '@services/payments';
import { formatPrice } from '@utils/currency';

import styles from './TopicTestPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'topic-test-page-title';

const BackLink = () => (
  <ButtonRouteLink to={APP_ROUTES.TOPIC_TESTS} variant="secondary">
    {TEXT.back}
  </ButtonRouteLink>
);

// The paper's key while an attempt is in progress: each paid attempt is
// its own paper, so a new attempt never brings back the last one's answers
const sessionKey = (topicId: string, attemptId: string) =>
  `topic:${topicId}:${attemptId}`;

// The attempt's questions, once they have downloaded. Its clock runs to the
// end the server set when the attempt started.
const TopicPaperQuestions = ({
  topicId,
  attempt,
  title,
  questionCount,
  retryAction,
  onFinish,
}: {
  topicId: string;
  attempt: TestAttempt;
  // e.g. "GST · Class 11", shown on the header's continue card
  title: string;
  questionCount: number;
  retryAction: React.ReactNode;
  onFinish: () => void;
}) => (
  <PaperAnswers
    questions={useTopicPaper(topicId)}
    questionCount={questionCount}
    durationSeconds={TOPIC_TEST_DURATION_SECONDS}
    instruction={TEXT.instruction}
    startsOnOpen
    endsAt={attempt.endsAt ? Date.parse(attempt.endsAt) : undefined}
    session={{
      key: sessionKey(topicId, attempt.id),
      title,
      href: toTopicTest(topicId),
    }}
    retryAction={retryAction}
    onFinish={onFinish}
  />
);

// The rules first, then one paid 45-minute attempt. A visitor signs up
// first; a student with no attempt pays for one at checkout; the clock
// starts on the server only when the student presses start, and keeps
// running if they leave.
const TopicTest = ({
  preview,
  questionCount,
}: {
  preview: TopicPreview;
  questionCount: number;
}) => {
  const auth = useAuth();
  const topicId = preview.catalogueTopicId;
  const canTake = canAnswerPapers(auth);
  const { attempts, available, isLoading, hasError, reload } = useTestAttempts(
    topicId,
    canTake,
  );
  const activePaper = useActivePaper();
  const queryClient = useQueryClient();
  // The attempt this page has open, once started here
  const [openAttempt, setOpenAttempt] = useState<TestAttempt | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const price = preview.topic.testPrice
    ? formatPrice(preview.topic.testPrice)
    : null;

  // Fetch the questions while the student reads the rules
  useEffect(() => {
    void loadTopicPapers();
  }, []);

  // The paper to show: the one opened here, an attempt already running, or
  // one whose time ran out while the student was away (to see its marks)
  const paperAttempt =
    openAttempt ??
    attempts.find(
      attempt => activePaper?.key === sessionKey(topicId, attempt.id),
    ) ??
    (available?.startedAt ? available : null);

  // Once a paper is open it stays, so its marks remain on screen after the
  // attempt ends (and is no longer in progress)
  useEffect(() => {
    if (paperAttempt && !openAttempt) {
      setOpenAttempt(paperAttempt);
    }
  }, [paperAttempt, openAttempt]);

  const handleStart = async () => {
    if (!available) return;
    setIsStarting(true);
    setStartFailed(false);
    try {
      setOpenAttempt(await startTestAttempt(available.id));
    } catch {
      setStartFailed(true);
    } finally {
      setIsStarting(false);
    }
  };

  // Submitting ends the attempt on the server too, so it is used up
  const handleFinish = (attemptId: string) => {
    void finishTestAttempt(attemptId)
      .catch(() => null)
      .then(() =>
        queryClient.invalidateQueries({ queryKey: QUERY_KEY.testAttempts }),
      );
  };

  const buyAction = price ? (
    <ButtonRouteLink to={toTestCheckoutPath(topicId)} endIcon="arrowRight">
      {TEXT.buyAgain(price)}
    </ButtonRouteLink>
  ) : null;

  const renderStart = () => {
    if (!canTake) {
      return (
        <Button
          endIcon="arrowRight"
          disabled={auth.status === 'loading'}
          onClick={() => setIsAccountOpen(true)}
          className={cn('start')}
        >
          {TEXT.signUpToStart}
        </Button>
      );
    }
    if (hasError) {
      return (
        <>
          <FieldStatus tone="error">{TEXT.attemptsError}</FieldStatus>
          <Button variant="secondary" onClick={reload} className={cn('start')}>
            {TEXT.retry}
          </Button>
        </>
      );
    }
    if (isLoading) {
      return (
        <Button loading className={cn('start')}>
          {TEXT.start}
        </Button>
      );
    }
    if (available) {
      return (
        <>
          <Text as="p" variant="small" tone="muted">
            {TEXT.attemptReady}
          </Text>
          {startFailed ? (
            <FieldStatus tone="error">{TEXT.startError}</FieldStatus>
          ) : null}
          <Button
            endIcon="arrowRight"
            loading={isStarting}
            onClick={() => void handleStart()}
            className={cn('start')}
          >
            {TEXT.start}
          </Button>
        </>
      );
    }
    return price ? (
      <ButtonRouteLink
        to={toTestCheckoutPath(topicId)}
        endIcon="arrowRight"
        className={cn('start')}
      >
        {TEXT.buy(price)}
      </ButtonRouteLink>
    ) : null;
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

      {paperAttempt ? (
        <div className={cn('paper')}>
          <PaperSheet
            label={TEXT.paperLabel}
            questionCount={questionCount}
            durationSeconds={TOPIC_TEST_DURATION_SECONDS}
            meta={TEXT.meta(preview.level, preview.title, questionCount)}
            layout="wide"
          >
            <TopicPaperQuestions
              key={paperAttempt.id}
              topicId={topicId}
              attempt={paperAttempt}
              title={TEXT.sessionTitle(preview.title, preview.level)}
              questionCount={questionCount}
              retryAction={buyAction}
              onFinish={() => handleFinish(paperAttempt.id)}
            />
          </PaperSheet>
        </div>
      ) : (
        <section className={cn('rules')} aria-label={TEXT.rulesLabel}>
          <RuledList items={TEXT.rules(questionCount)} />
          {renderStart()}
        </section>
      )}

      <div className={cn('footer')}>
        <BackLink />
      </div>

      <AccountDialog
        open={isAccountOpen && mustSignInToAnswer(auth)}
        onClose={() => setIsAccountOpen(false)}
      />
    </>
  );
};

// One topic's test, at /topic-tests/:topicId. The topic's name and class
// come from the catalogue; its questions from the topic test bank.
const TopicTestPage = () => {
  const { topicId = '' } = useParams();
  // Every topic, including those with a topic test but no batches
  const {
    allPreviews: previews,
    isLoading,
    hasError,
    reload,
  } = useTopicPreviews();
  const preview =
    previews.find(item => item.catalogueTopicId === topicId) ?? null;
  const questionCount = findTopicTestSize(topicId);

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      {isLoading || hasError ? (
        <TopicsStatus hasError={hasError} onRetry={reload} skeleton="spinner" />
      ) : preview && questionCount ? (
        // A different topic is a fresh start
        <TopicTest
          key={topicId}
          preview={preview}
          questionCount={questionCount}
        />
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
