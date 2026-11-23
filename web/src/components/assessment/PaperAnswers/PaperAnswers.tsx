import { useCallback, useEffect, useId, useState } from 'react';
import cx from 'classnames/bind';

import { QuestionFigure } from '@components/assessment/QuestionFigure/QuestionFigure';
import { Button } from '@components/ui/Button/Button';
import { Confetti } from '@components/ui/Confetti/Confetti';
import { Text } from '@components/ui/Text/Text';
import {
  SAMPLE_TEST_TEXT as TEXT,
  type SampleTestQuestion,
} from '@constants/assessment';
import { useCountdown } from '@hooks/useCountdown';
import { formatCountdown } from '@utils/date';

import styles from './PaperAnswers.module.css';

const cn = cx.bind(styles);

// The clock turns red for the last minute
const WARNING_SECONDS = 60;

const resultMessage = (score: number, total: number) => {
  if (score === total) return TEXT.resultFull;
  // Four in five right counts as nearly there
  if (score >= Math.ceil(total * 0.8)) return TEXT.resultGood;
  return TEXT.resultStart;
};

export type PaperAnswersProps = {
  questions: readonly SampleTestQuestion[];
  durationSeconds: number;
  // Shown above the first question
  instruction: string;
  // The clock starts at once instead of with the first answer
  startsOnOpen?: boolean;
  // Compact papers scroll their questions inside the sheet; otherwise the
  // page scrolls and the clock and submit button stay on screen
  scrollsInside?: boolean;
};

// The answering part of a paper: questions with OMR-style bubbles, a
// clock, and marking. Submitting (or running out of time) marks the paper,
// shows the right answers and the score, with confetti for full marks.
// Give it a new key to start a fresh paper.
export const PaperAnswers = ({
  questions,
  durationSeconds,
  instruction,
  startsOnOpen = false,
  scrollsInside = false,
}: PaperAnswersProps) => {
  const paperId = useId();
  const total = questions.length;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isMarked, setIsMarked] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  // Increases with every attempt, so each full-marks result fires once.
  const [attempt, setAttempt] = useState(1);

  const handleExpire = useCallback(() => {
    setHasTimedOut(true);
    setIsMarked(true);
  }, []);
  const countdown = useCountdown(durationSeconds, handleExpire);
  const { start } = countdown;

  useEffect(() => {
    if (startsOnOpen) start();
  }, [startsOnOpen, start]);

  const answeredCount = Object.keys(answers).length;
  const score = questions.filter(
    question => answers[question.id] === question.answer,
  ).length;
  const isFullMarks = isMarked && score === total;

  const handleSelect = (questionId: string, key: string) => {
    if (isMarked) return;
    if (!countdown.isRunning) countdown.start();
    setAnswers(current => ({ ...current, [questionId]: key }));
  };

  const handleSubmit = () => {
    countdown.stop();
    setIsMarked(true);
  };

  const handleTryAgain = () => {
    if (startsOnOpen) countdown.start();
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

      <ol className={cn('questions')}>
        {questions.map((question, index) => {
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
            </li>
          );
        })}
      </ol>

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
          <Text
            variant="label"
            tone={
              countdown.isRunning && countdown.secondsLeft <= WARNING_SECONDS
                ? 'danger'
                : 'muted'
            }
            className={cn('clock')}
          >
            {hasTimedOut
              ? TEXT.timeUp
              : TEXT.timeLeft(formatCountdown(countdown.secondsLeft))}
          </Text>
        </div>
        {isMarked ? (
          <Button
            variant="secondary"
            endIcon="arrowRight"
            onClick={handleTryAgain}
          >
            {TEXT.tryAgain}
          </Button>
        ) : (
          <Button disabled={answeredCount === 0} onClick={handleSubmit}>
            {TEXT.submit}
          </Button>
        )}
      </div>

      <Confetti burst={isFullMarks ? attempt : 0} />
    </div>
  );
};
