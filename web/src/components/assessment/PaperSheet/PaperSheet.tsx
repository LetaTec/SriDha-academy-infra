import type React from 'react';
import cx from 'classnames/bind';

import { Text } from '@components/ui/Text/Text';
import { SAMPLE_TEST_TEXT as TEXT } from '@constants/assessment';

import styles from './PaperSheet.module.css';

const cn = cx.bind(styles);

export type PaperSheetProps = {
  // Read out for the whole sheet, e.g. "Sample test paper"
  label: string;
  questionCount: number;
  // The printed line under the title: class, subject or topic, marks
  meta: readonly string[];
  // Wide papers fill a page; compact ones sit beside other content
  layout?: 'compact' | 'wide';
  children: React.ReactNode;
};

// The printed exam sheet every paper sits on: brand line, title and the
// line of details, with the paper's own content below.
export const PaperSheet = ({
  label,
  questionCount,
  meta,
  layout = 'compact',
  children,
}: PaperSheetProps) => (
  <section className={cn('sheet', layout)} aria-label={label}>
    <div className={cn('sheetTop')}>
      <Text variant="label">{TEXT.brand}</Text>
      <Text variant="label">{TEXT.count(questionCount)}</Text>
    </div>
    <div className={cn('sheetTitle')} aria-hidden="true">
      {TEXT.title}
      <br />
      {TEXT.titleEnd}
    </div>
    <div className={cn('meta')}>
      {meta.map(item => (
        <Text key={item} variant="label" tone="muted">
          {item}
        </Text>
      ))}
    </div>
    {children}
  </section>
);
