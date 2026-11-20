import { useCallback, useId, useRef, useState } from 'react';
import cx from 'classnames/bind';

import { QuestionFigure } from '@components/assessment/QuestionFigure/QuestionFigure';
import { Button } from '@components/ui/Button/Button';
import { ButtonBase } from '@components/ui/ButtonBase/ButtonBase';
import { Confetti } from '@components/ui/Confetti/Confetti';
import { Text } from '@components/ui/Text/Text';
import {
  SAMPLE_TEST_DURATION_SECONDS,
  SAMPLE_TEST_QUESTION_COUNT as TOTAL,
  SAMPLE_TEST_TRACKS,
  SAMPLE_TEST_TEXT as TEXT,
} from '@constants/assessment';
import { useCountdown } from '@hooks/useCountdown';
import { formatCountdown } from '@utils/date';

import styles from './SampleTestPaper.module.css';

const cn = cx.bind(styles);

// Four in five right counts as nearly there
const GOOD_SCORE = Math.ceil(TOTAL * 0.8);

const resultMessage = (score: number) => {
  if (score === TOTAL) return TEXT.resultFull;
  if (score >= GOOD_SCORE) return TEXT.resultGood;
  return TEXT.resultStart;
};

export type SampleTestPaperProps = {
  // The class or exam the paper opens on; the first one by default.
  initialTrack?: string;
  // Wide papers fill a page and let it scroll; compact ones scroll inside.
  layout?: 'compact' | 'wide';
};

// A 20-question sample test on a paper sheet. The student picks a class or
// exam (Class 11, JEE, CA / CPT, …), then a subject in it. The clock starts
// with the first answer; submitting (or running out of time) marks the
// paper, shows the right answers and a score out of 20, with confetti for
// full marks.
export const SampleTestPaper = ({
  initialTrack = SAMPLE_TEST_TRACKS[0].key,
  layout = 'compact',
}: SampleTestPaperProps) => {
  const paperId = useId();
  const questionsRef = useRef<HTMLOListElement>(null);
  const [trackKey, setTrackKey] = useState(initialTrack);
  const track =
    SAMPLE_TEST_TRACKS.find(item => item.key === trackKey) ??
    SAMPLE_TEST_TRACKS[0];
  const [subjectKey, setSubjectKey] = useState(track.subjects[0].key);
  const subject =
    track.subjects.find(item => item.key === subjectKey) ?? track.subjects[0];
  const questions = subject.questions;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isMarked, setIsMarked] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  // Increases with every attempt, so each full-marks result fires once.
  const [attempt, setAttempt] = useState(1);

  const handleExpire = useCallback(() => {
    setHasTimedOut(true);
    setIsMarked(true);
  }, []);
  const countdown = useCountdown(SAMPLE_TEST_DURATION_SECONDS, handleExpire);

  const answeredCount = Object.keys(answers).length;
  const score = questions.filter(
    question => answers[question.id] === question.answer,
  ).length;
  const isFullMarks = isMarked && score === TOTAL;

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
    countdown.reset();
    setAnswers({});
    setIsMarked(false);
    setHasTimedOut(false);
    setAttempt(current => current + 1);
  };

  // A new paper: fresh answers, a fresh clock, back to question 1
  const openPaper = (nextTrack: string, nextSubject: string) => {
    if (nextTrack === track.key && nextSubject === subject.key) return;
    setTrackKey(nextTrack);
    setSubjectKey(nextSubject);
    handleTryAgain();
    if (questionsRef.current) questionsRef.current.scrollTop = 0;
  };

  const handleTrack = (nextTrack: string) => {
    const next = SAMPLE_TEST_TRACKS.find(item => item.key === nextTrack);
    if (next) openPaper(next.key, next.subjects[0].key);
  };

  return (
    <section
      className={cn('sheet', layout, { celebrating: isFullMarks })}
      aria-label={TEXT.paperLabel}
    >
      <div className={cn('sheetTop')}>
        <Text variant="label">{TEXT.brand}</Text>
        <Text variant="label">{TEXT.count(TOTAL)}</Text>
      </div>
      <div className={cn('sheetTitle')} aria-hidden="true">
        {TEXT.title}
        <br />
        {TEXT.titleEnd}
      </div>
      <div className={cn('meta')}>
        {TEXT.meta(track.label, subject.label, TOTAL).map(item => (
          <Text key={item} variant="label" tone="muted">
            {item}
          </Text>
        ))}
      </div>
      <div
        className={cn('subjects', 'tracks')}
        role="group"
        aria-label={TEXT.tracksLabel}
      >
        {SAMPLE_TEST_TRACKS.map(item => (
          <ButtonBase
            key={item.key}
            className={cn('subject', { subjectActive: item.key === track.key })}
            aria-pressed={item.key === track.key}
            onClick={() => handleTrack(item.key)}
          >
            {item.label}
          </ButtonBase>
        ))}
      </div>
      <div
        className={cn('subjects')}
        role="group"
        aria-label={TEXT.subjectsLabel}
      >
        {track.subjects.map(item => (
          <ButtonBase
            key={item.key}
            className={cn('subject', {
              subjectActive: item.key === subject.key,
            })}
            aria-pressed={item.key === subject.key}
            onClick={() => openPaper(track.key, item.key)}
          >
            {item.label}
          </ButtonBase>
        ))}
      </div>
      <Text as="p" variant="small" tone="muted" className={cn('instruction')}>
        {TEXT.instruction}
      </Text>

      <ol ref={questionsRef} className={cn('questions')}>
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
            <Text variant="numeral">{TEXT.score(score, TOTAL)}</Text>
            <Text as="p" variant="small" tone="muted">
              {resultMessage(score)}
            </Text>
          </>
        ) : null}
      </div>

      <div className={cn('sheetFooter')}>
        <Text variant="label" tone="muted">
          {TEXT.answered(answeredCount, TOTAL)}
        </Text>
        <Text
          variant="label"
          tone={
            countdown.isRunning && countdown.secondsLeft <= 60
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

      <div className={cn('actions')}>
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
    </section>
  );
};
