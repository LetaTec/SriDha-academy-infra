import { render, screen } from '@testing-library/react';

import { SAMPLE_TEST_TRACKS } from '@constants/assessment';
import { findSamplePaper } from '@constants/sampleTestPapers';
import { TOPIC_TEST_BANK } from '@constants/topicTestPapers';

import { QuestionFigure } from './QuestionFigure';

const figureQuestions = [
  ...SAMPLE_TEST_TRACKS.flatMap(track =>
    track.subjects.flatMap(
      subject => findSamplePaper(track.key, subject.key) ?? [],
    ),
  ),
  ...Object.values(TOPIC_TEST_BANK).flat(),
].filter(question => question.figure);

describe('QuestionFigure', () => {
  it('draws a figure for every question that has one', () => {
    expect(figureQuestions.length).toBeGreaterThanOrEqual(15);
    figureQuestions.forEach(question => {
      const { container, unmount } = render(
        <QuestionFigure figure={question.figure!} />,
      );
      expect(
        container.querySelector('table, svg, [aria-label]'),
      ).not.toBeNull();
      unmount();
    });
  });

  it('lists the corners of a feasible region for screen readers', () => {
    render(
      <QuestionFigure
        figure={{
          kind: 'region',
          corners: [
            [0, 0],
            [0, 2],
            [3, 4],
            [7, 0],
          ],
          xMax: 8,
          yMax: 5,
        }}
      />,
    );
    expect(
      screen.getByRole('img', { name: /\(0, 2\), \(3, 4\), \(7, 0\)/ }),
    ).toBeInTheDocument();
  });

  it('shows lists to match as a table with headings', () => {
    render(
      <QuestionFigure
        figure={{
          kind: 'table',
          head: ['List-I', 'List-II'],
          rows: [['P. dsp²', '1. [FeF₆]⁴⁻']],
        }}
      />,
    );
    expect(
      screen.getByRole('columnheader', { name: 'List-II' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'P. dsp²' })).toBeInTheDocument();
  });
});
