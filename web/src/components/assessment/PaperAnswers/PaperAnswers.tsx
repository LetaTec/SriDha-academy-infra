import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import cx from 'classnames/bind';

import { canAnswerPapers, mustSignInToAnswer } from '@/access/papers';
import { PaperClockContext } from '@components/assessment/PaperClock/PaperClock';
import { PaperLoading } from '@components/assessment/PaperLoading/PaperLoading';
import { PaperLock } from '@components/assessment/PaperLock/PaperLock';
import { QuestionFigure } from '@components/assessment/QuestionFigure/QuestionFigure';
import { AccountDialog } from '@components/auth/AccountDialog/AccountDialog';
import { Button } from '@components/ui/Button/Button';
import { Confetti } from '@components/ui/Confetti/Confetti';
import { Text } from '@components/ui/Text/Text';
import {
  SAMPLE_TEST_TEXT as TEXT,
  type SampleTestQuestion,
} from '@constants/assessment';
import { useAuth } from '@context/AuthContext';
import {
  clearActivePaper,
  readActivePaper,
  saveActivePaper,
  showPaperOnScreen,
} from '@hooks/useActivePaper';
import { useCountdown } from '@hooks/useCountdown';

import styles from './PaperAnswers.module.css';

const cn = cx.bind(styles);

const resultMessage = (score: number, total: number) => {
  if (score === total) return TEXT.resultFull;
  // Four in five right counts as nearly there
  if (score >= Math.ceil(total * 0.8)) return TEXT.resultGood;
  return TEXT.resultStart;
};

export type PaperAnswersProps = {
  // null while the questions download; the frame keeps its size meanwhile
  questions: readonly SampleTestQuestion[] | null;
  // How many questions the paper has, known before they arrive
  questionCount: number;
  durationSeconds: number;
  // Shown above the first question
  instruction: string;
  // The clock starts at once instead of with the first answer
  startsOnOpen?: boolean;
  // Compact papers scroll their questions inside the sheet; otherwise the
  // page scrolls and the clock and submit button stay on screen
  scrollsInside?: boolean;
  // Which paper this is and where it lives, so a paper in progress keeps
  // its clock and answers when the student leaves and comes back
  session: { key: string; title: string; href: string };
  // When the clock runs out, set by the server for a paid attempt;
  // otherwise the clock runs the full duration from its start
  endsAt?: number;
  // Told once the paper is submitted or its time runs out
  onFinish?: () => void;
  // Shown instead of "Try again" once marked, e.g. buying another attempt
  retryAction?: ReactNode;
};

// The answering part of a paper: questions with OMR-style bubbles, a
// clock, and marking. Submitting (or running out of time) marks the paper,
// shows the right answers and the score, with confetti for full marks.
// Answering needs an account: a visitor's first click opens sign-up, and
// the answer they picked is recorded once they are in. Once the clock
// starts, the paper is kept as the student's paper in progress: leaving the
// page does not stop the clock, and coming back restores the answers (or
// marks the paper if its time ran out meanwhile).
// Give it a new key to start a fresh paper.
export const PaperAnswers = ({
  questions,
  questionCount,
  durationSeconds,
  instruction,
  startsOnOpen = false,
  scrollsInside = false,
  session,
  endsAt: fixedEndsAt,
  onFinish,
  retryAction,
}: PaperAnswersProps) => {
  const { key: sessionKey, title: sessionTitle, href: sessionHref } = session;
  const publishClock = useContext(PaperClockContext);
  const paperId = useId();
  const auth = useAuth();
  // An answer clicked before signing up, or while the saved session is
  // still being checked
  const [waitingAnswer, setWaitingAnswer] = useState<{
    questionId: string;
    key: string;
  } | null>(null);
  const total = questions?.length ?? questionCount;
  const isLoading = questions === null;
  // Not while the saved session is checked, so it never flashes
  const isLocked = mustSignInToAnswer(auth);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isMarked, setIsMarked] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  // Increases with every attempt, so each full-marks result fires once.
  const [attempt, setAttempt] = useState(1);

  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const handleExpire = useCallback(() => {
    setHasTimedOut(true);
    setIsMarked(true);
    clearActivePaper(sessionKey);
    onFinishRef.current?.();
  }, [sessionKey]);
  const countdown = useCountdown(durationSeconds, handleExpire);
  const { start, isRunning } = countdown;
  // When this attempt's clock runs out; set once it starts
  const endsAt = useRef(0);
  const hasStarted = useRef(false);

  const beginPaper = useCallback(() => {
    hasStarted.current = true;
    endsAt.current = start(fixedEndsAt);
  }, [start, fixedEndsAt]);

  // Coming back to a paper in progress: its answers and running clock, or
  // its marks if the time ran out while the student was away
  useEffect(() => {
    const saved = readActivePaper();
    if (!saved || saved.key !== sessionKey) return;
    hasStarted.current = true;
    setAnswers(saved.answers);
    if (saved.endsAt > Date.now()) {
      endsAt.current = start(saved.endsAt);
    } else {
      setHasTimedOut(true);
      setIsMarked(true);
      clearActivePaper(sessionKey);
      onFinishRef.current?.();
    }
  }, [sessionKey, start]);

  // While this paper is open, the header does not offer to continue it
  useEffect(() => showPaperOnScreen(sessionKey), [sessionKey]);

  // A timed paper's clock starts once its questions are on screen
  useEffect(() => {
    if (startsOnOpen && !isLoading && !hasStarted.current) beginPaper();
  }, [startsOnOpen, isLoading, beginPaper]);

  // While the clock runs, the paper and its answers are kept
  useEffect(() => {
    if (!isRunning || isMarked) return;
    saveActivePaper({
      key: sessionKey,
      title: sessionTitle,
      href: sessionHref,
      endsAt: endsAt.current,
      answers,
    });
  }, [answers, isRunning, isMarked, sessionKey, sessionTitle, sessionHref]);

  // The sheet's header shows the clock
  const secondsShown = Math.ceil(countdown.secondsLeft);
  useEffect(() => {
    publishClock({ secondsLeft: secondsShown, hasTimedOut });
  }, [publishClock, secondsShown, hasTimedOut]);

  const answeredCount = Object.keys(answers).length;
  const score = (questions ?? []).filter(
    question => answers[question.id] === question.answer,
  ).length;
  const isFullMarks = isMarked && score === total;

  const recordAnswer = (questionId: string, key: string) => {
    if (!countdown.isRunning) beginPaper();
    setAnswers(current => ({ ...current, [questionId]: key }));
  };

  const handleSelect = (questionId: string, key: string) => {
    if (isMarked) return;
    if (canAnswerPapers(auth)) recordAnswer(questionId, key);
    else setWaitingAnswer({ questionId, key });
  };

  // A click made while the session was loading counts once it turns out
  // the student is signed in
  const canAnswer = canAnswerPapers(auth);
  useEffect(() => {
    if (!canAnswer || !waitingAnswer) return;
    if (!isRunning) beginPaper();
    setAnswers(current => ({
      ...current,
      [waitingAnswer.questionId]: waitingAnswer.key,
    }));
    setWaitingAnswer(null);
  }, [canAnswer, waitingAnswer, isRunning, beginPaper]);

  const handleSubmit = () => {
    countdown.stop();
    setIsMarked(true);
    clearActivePaper(sessionKey);
    onFinish?.();
  };

  const handleTryAgain = () => {
    clearActivePaper(sessionKey);
    hasStarted.current = false;
    if (startsOnOpen) beginPaper();
    else countdown.reset();
    setAnswers({});
    setIsMarked(false);
    setHasTimedOut(false);
    setAttempt(current => current + 1);
  };

  return (
    <div className={cn('answers', { scrollsInside })}>
      <Text as="p" variant="small" tone="muted" className={cn('instruction')}>
        {instruction}
      </Text>

      {/* Visitors see the questions blurred, with sign-up on top */}
      <div className={cn('questionsArea')}>
        {isLoading ? (
          <div className={cn('questionsLoading')}>
            <PaperLoading />
          </div>
        ) : null}
        <ol
          className={cn('questions', { questionsLocked: isLocked })}
          hidden={isLoading}
          inert={isLocked}
        >
          {(questions ?? []).map((question, index) => {
            const promptId = `${paperId}-${question.id}`;
            const chosen = answers[question.id];
            const correctOption = question.options.find(
              option => option.key === question.answer,
            );

            return (
              <li key={question.id} className={cn('question')}>
                <div className={cn('questionHead')}>
                  <Text variant="numeralSm">
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text variant="strong" id={promptId} className={cn('prompt')}>
                    {question.prompt}
                  </Text>
                  <Text variant="label" tone="muted">
                    {TEXT.marksLabel}
                  </Text>
                </div>
                {question.figure ? (
                  <QuestionFigure figure={question.figure} />
                ) : null}

                <div
                  role="radiogroup"
                  aria-labelledby={promptId}
                  className={cn('options')}
                >
                  {question.options.map(option => {
                    const isChosen = chosen === option.key;
                    const isAnswer = option.key === question.answer;

                    return (
                      <label
                        key={option.key}
                        className={cn('option', {
                          optionMarked: isMarked,
                          optionCorrect: isMarked && isAnswer,
                          optionWrong: isMarked && isChosen && !isAnswer,
                        })}
                      >
                        <input
                          type="radio"
                          name={`${paperId}-${question.id}-${attempt}`}
                          value={option.key}
                          checked={isChosen}
                          disabled={isMarked}
                          onChange={() => handleSelect(question.id, option.key)}
                          className={cn('input')}
                        />
                        <span
                          className={cn('bubble', { bubbleSelected: isChosen })}
                          aria-hidden="true"
                        >
                          {option.key}
                        </span>
                        <Text variant="small">{option.label}</Text>
                      </label>
                    );
                  })}
                </div>

                {isMarked ? (
                  <Text
                    as="p"
                    variant="small"
                    tone={chosen === question.answer ? 'success' : 'danger'}
                    className={cn('feedback')}
                  >
                    {chosen === question.answer
                      ? TEXT.correct
                      : `${chosen ? '' : `${TEXT.notAnswered} · `}${TEXT.correctAnswer(
                          question.answer,
                          correctOption?.label ?? '',
                        )}`}
                  </Text>
                ) : null}
                {isMarked && question.explanation ? (
                  <Text
                    as="p"
                    variant="small"
                    tone="muted"
                    className={cn('explanation')}
                  >
                    {TEXT.why(question.explanation)}
                  </Text>
                ) : null}
              </li>
            );
          })}
        </ol>

        {isLocked ? (
          <PaperLock layout={scrollsInside ? 'compact' : 'wide'} />
        ) : null}
      </div>

      <div className={cn('result')} role="status" aria-live="polite">
        {isMarked ? (
          <>
            {isFullMarks ? (
              <span className={cn('celebration')}>{TEXT.celebrationTitle}</span>
            ) : null}
            <Text variant="numeral">{TEXT.score(score, total)}</Text>
            <Text as="p" variant="small" tone="muted">
              {resultMessage(score, total)}
            </Text>
          </>
        ) : null}
      </div>

      {/* Stays on screen while a long paper scrolls */}
      <div className={cn('bar')}>
        <div className={cn('barText')}>
          <Text variant="label" tone="muted">
            {isMarked
              ? TEXT.marked(score, total)
              : TEXT.answered(answeredCount, total)}
          </Text>
        </div>
        {isMarked && retryAction ? (
          retryAction
        ) : isMarked ? (
          <Button
            variant="secondary"
            endIcon="arrowRight"
            onClick={handleTryAgain}
          >
            {TEXT.tryAgain}
          </Button>
        ) : (
          <Button
            disabled={answeredCount === 0 || isLocked}
            onClick={handleSubmit}
          >
            {TEXT.submit}
          </Button>
        )}
      </div>

      <Confetti burst={isFullMarks ? attempt : 0} />

      <AccountDialog
        open={waitingAnswer !== null && mustSignInToAnswer(auth)}
        onClose={() => setWaitingAnswer(null)}
        onSignedIn={() => {
          if (waitingAnswer) {
            recordAnswer(waitingAnswer.questionId, waitingAnswer.key);
          }
        }}
      />
    </div>
  );
};
