import { useState } from 'react';
import cx from 'classnames/bind';

import { PaperAnswers } from '@components/assessment/PaperAnswers/PaperAnswers';
import { PaperSheet } from '@components/assessment/PaperSheet/PaperSheet';
import { ButtonBase } from '@components/ui/ButtonBase/ButtonBase';
import {
  SAMPLE_TEST_DURATION_SECONDS,
  SAMPLE_TEST_QUESTION_COUNT as TOTAL,
  SAMPLE_TEST_TRACKS,
  SAMPLE_TEST_TEXT as TEXT,
} from '@constants/assessment';
import { toTestPaper } from '@constants/routes';
import { useSamplePaper } from '@hooks/useQuestionBanks';

import styles from './SampleTestPaper.module.css';

const cn = cx.bind(styles);

// The chosen paper, with its questions once they have downloaded
const SamplePaperQuestions = ({
  trackKey,
  subjectKey,
  title,
  scrollsInside,
}: {
  trackKey: string;
  subjectKey: string;
  // e.g. "Class 12 · Physics", shown on the header's continue card
  title: string;
  scrollsInside: boolean;
}) => (
  <PaperAnswers
    questions={useSamplePaper(trackKey, subjectKey)}
    questionCount={TOTAL}
    durationSeconds={SAMPLE_TEST_DURATION_SECONDS}
    instruction={TEXT.instruction}
    scrollsInside={scrollsInside}
    session={{
      key: `sample:${trackKey}:${subjectKey}`,
      title,
      href: toTestPaper(trackKey, subjectKey),
    }}
  />
);

export type SampleTestPaperProps = {
  // The class or exam the paper opens on; the first one by default.
  initialTrack?: string;
  // The subject it opens on; the class's first subject by default
  initialSubject?: string;
  // Told of every new class or subject, e.g. to keep it in the address
  onChange?: (track: string, subject: string) => void;
  // Wide papers fill a page and let it scroll; compact ones scroll inside.
  layout?: 'compact' | 'wide';
};

// A 20-question sample test on a paper sheet. The student picks a class or
// exam (Class 11, JEE, CA / CPT, …), then a subject in it; each choice
// opens a fresh paper. The clock starts with the first answer.
export const SampleTestPaper = ({
  initialTrack = SAMPLE_TEST_TRACKS[0].key,
  initialSubject,
  onChange,
  layout = 'compact',
}: SampleTestPaperProps) => {
  const [trackKey, setTrackKey] = useState(initialTrack);
  const track =
    SAMPLE_TEST_TRACKS.find(item => item.key === trackKey) ??
    SAMPLE_TEST_TRACKS[0];
  const [subjectKey, setSubjectKey] = useState(
    initialSubject ?? track.subjects[0].key,
  );
  const subject =
    track.subjects.find(item => item.key === subjectKey) ?? track.subjects[0];

  const handleTrack = (nextTrack: string) => {
    const next = SAMPLE_TEST_TRACKS.find(item => item.key === nextTrack);
    if (!next || next.key === track.key) return;
    setTrackKey(next.key);
    setSubjectKey(next.subjects[0].key);
    onChange?.(next.key, next.subjects[0].key);
  };

  const handleSubject = (nextSubject: string) => {
    setSubjectKey(nextSubject);
    onChange?.(track.key, nextSubject);
  };

  return (
    <PaperSheet
      label={TEXT.paperLabel}
      questionCount={TOTAL}
      durationSeconds={SAMPLE_TEST_DURATION_SECONDS}
      meta={TEXT.meta(track.label, subject.label, TOTAL)}
      layout={layout}
    >
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
            onClick={() => handleSubject(item.key)}
          >
            {item.label}
          </ButtonBase>
        ))}
      </div>

      {/* A new paper for every class and subject: fresh answers and clock */}
      <SamplePaperQuestions
        key={`${track.key}-${subject.key}`}
        trackKey={track.key}
        subjectKey={subject.key}
        title={TEXT.sessionTitle(track.label, subject.label)}
        scrollsInside={layout === 'compact'}
      />
    </PaperSheet>
  );
};
