import { act, fireEvent, render, screen, within } from '@testing-library/react';

import {
  SAMPLE_TEST_DURATION_SECONDS,
  SAMPLE_TEST_PAPERS,
} from '@constants/assessment';

import { SampleTestPaper } from './SampleTestPaper';

// The paper opens on the first subject, Accountancy
const SAMPLE_TEST_QUESTIONS = SAMPLE_TEST_PAPERS.accountancy;

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const answerQuestion = (index: number, optionKey: string) => {
  const question = SAMPLE_TEST_QUESTIONS[index];
  const group = screen.getByRole('radiogroup', { name: question.prompt });
  const option = question.options.find(item => item.key === optionKey);
  fireEvent.click(
    within(group).getByRole('radio', {
      name: new RegExp(escapeRegExp(option!.label)),
    }),
  );
};

const answerAll = (pick: (index: number) => string) =>
  SAMPLE_TEST_QUESTIONS.forEach((_, index) =>
    answerQuestion(index, pick(index)),
  );

describe('SampleTestPaper', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('switches to another subject paper with fresh answers', () => {
    render(<SampleTestPaper />);
    answerQuestion(0, SAMPLE_TEST_QUESTIONS[0].answer);
    expect(screen.getByText('Answered 1 of 5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Physics' }));

    expect(screen.getByRole('button', { name: 'Physics' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('radiogroup', {
        name: SAMPLE_TEST_PAPERS.physics[0].prompt,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Answered 0 of 5')).toBeInTheDocument();
  });

  it('has a five-question paper for every subject', () => {
    Object.values(SAMPLE_TEST_PAPERS).forEach(paper => {
      expect(paper).toHaveLength(5);
      paper.forEach(question =>
        expect(
          question.options.some(option => option.key === question.answer),
        ).toBe(true),
      );
    });
  });

  it('marks a full-marks paper 5 / 5 and congratulates the student', () => {
    render(<SampleTestPaper />);
    expect(
      screen.getByRole('button', { name: 'Submit answers' }),
    ).toBeDisabled();

    answerAll(index => SAMPLE_TEST_QUESTIONS[index].answer);
    expect(screen.getByText('Answered 5 of 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

    const result = screen.getByRole('status');
    expect(within(result).getByText('Congratulations!')).toBeInTheDocument();
    expect(within(result).getByText('Score 5 / 5')).toBeInTheDocument();
    expect(screen.getAllByText('Correct')).toHaveLength(5);
  });

  it('shows the right answer for wrong and unanswered questions, then resets', () => {
    render(<SampleTestPaper />);
    const wrongKey = SAMPLE_TEST_QUESTIONS[0].options.find(
      option => option.key !== SAMPLE_TEST_QUESTIONS[0].answer,
    )!.key;

    answerQuestion(0, wrongKey);
    answerQuestion(1, SAMPLE_TEST_QUESTIONS[1].answer);
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

    expect(
      within(screen.getByRole('status')).getByText('Score 1 / 5'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Congratulations!')).not.toBeInTheDocument();
    expect(
      screen.getByText(/^Correct answer: \(b\) CGST and SGST$/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Not answered · Correct answer/)).toHaveLength(
      3,
    );
    screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Answered 0 of 5')).toBeInTheDocument();
    expect(screen.getByText('Time left 05:00')).toBeInTheDocument();
    screen
      .getAllByRole('radio')
      .forEach(radio => expect(radio).not.toBeChecked());
  });

  it('starts the five-minute clock on the first answer and marks the paper when time runs out', () => {
    vi.useFakeTimers();
    render(<SampleTestPaper />);
    expect(screen.getByText('Time left 05:00')).toBeInTheDocument();

    answerQuestion(0, SAMPLE_TEST_QUESTIONS[0].answer);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Time left 04:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SAMPLE_TEST_DURATION_SECONDS * 1000);
    });
    expect(screen.getByText("Time's up")).toBeInTheDocument();
    expect(
      within(screen.getByRole('status')).getByText('Score 1 / 5'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});
