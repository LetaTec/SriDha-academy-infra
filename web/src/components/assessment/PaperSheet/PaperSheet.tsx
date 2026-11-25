import type React from 'react';
import { useState } from 'react';
import cx from 'classnames/bind';

import {
  PaperClock,
  PaperClockContext,
  type PaperClockState,
} from '@components/assessment/PaperClock/PaperClock';
import { Text } from '@components/ui/Text/Text';
import { SAMPLE_TEST_TEXT as TEXT } from '@constants/assessment';

import styles from './PaperSheet.module.css';

const cn = cx.bind(styles);

export type PaperSheetProps = {
  // Read out for the whole sheet, e.g. "Sample test paper"
  label: string;
  questionCount: number;
  // The paper's full time, shown until its clock starts
  durationSeconds: number;
  // The printed line under the title: class, subject or topic, marks
  meta: readonly string[];
  // Wide papers fill a page; compact ones sit beside other content
  layout?: 'compact' | 'wide';
  children: React.ReactNode;
};

// The printed exam sheet every paper sits on: the title and the red clock
// (which stay on screen while a wide paper scrolls), then the line of
// details and question count, with the paper's own content below.
export const PaperSheet = ({
  label,
  questionCount,
  durationSeconds,
  meta,
  layout = 'compact',
  children,
}: PaperSheetProps) => {
  const [clock, setClock] = useState<PaperClockState>({
    secondsLeft: durationSeconds,
    hasTimedOut: false,
  });

  return (
    <section className={cn('sheet', layout)} aria-label={label}>
      <div className={cn('sheetTop')}>
        <div className={cn('sheetTitle')} aria-hidden="true">
          {TEXT.title} {TEXT.titleEnd}
        </div>
        <PaperClock state={clock} />
      </div>
      <div className={cn('meta')}>
        {[...meta, TEXT.count(questionCount)].map(item => (
          <Text key={item} variant="label" tone="muted">
            {item}
          </Text>
        ))}
      </div>
      <PaperClockContext.Provider value={setClock}>
        {children}
      </PaperClockContext.Provider>
    </section>
  );
};
