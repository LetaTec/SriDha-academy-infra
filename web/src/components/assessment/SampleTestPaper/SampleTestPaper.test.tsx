import { act, fireEvent, render, screen, within } from '@testing-library/react';

import {
  SAMPLE_TEST_DURATION_SECONDS,
  SAMPLE_TEST_QUESTION_COUNT,
  SAMPLE_TEST_TRACKS,
  type SampleTestQuestion,
} from '@constants/assessment';

import { SampleTestPaper } from './SampleTestPaper';

const trackPaper = (trackKey: string, subjectKey: string) =>
  SAMPLE_TEST_TRACKS.find(track => track.key === trackKey)!.subjects.find(
    subject => subject.key === subjectKey,
  )!.questions;

// The paper opens on Class 11 Accountancy
const CLASS_11_ACCOUNTANCY = trackPaper('class11', 'accountancy');

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const answerQuestion = (
  questions: readonly SampleTestQuestion[],
  index: number,
  optionKey: string,
) => {
  const question = questions[index];
  // Two papers can share a prompt; the open paper's group is the only one
  const group = screen.getByRole('radiogroup', { name: question.prompt });
  const option = question.options.find(item => item.key === optionKey);
  fireEvent.click(
    within(group).getByRole('radio', {
      name: new RegExp(escapeRegExp(option!.label)),
    }),
  );
};

const optionLabel = (question: SampleTestQuestion, key: string) =>
  question.options.find(option => option.key === key)!.label;

describe('SampleTestPaper', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('has a 20-question paper with one right answer for every subject of every class and exam', () => {
    expect(SAMPLE_TEST_TRACKS.map(track => track.label)).toEqual([
      'Class 11',
      'Class 12',
      'JEE',
      'NEET',
      'Reasoning & aptitude',
      'CA / CPT',
    ]);
    SAMPLE_TEST_TRACKS.forEach(track =>
      track.subjects.forEach(subject => {
        expect(subject.questions).toHaveLength(SAMPLE_TEST_QUESTION_COUNT);
        subject.questions.forEach(question => {
          expect(question.options).toHaveLength(4);
          expect(
            question.options.filter(option => option.key === question.answer),
          ).toHaveLength(1);
          // No option repeats within a question
          expect(
            new Set(question.options.map(option => option.label)).size,
          ).toBe(4);
        });
        // The right answer is not always in the same place
        expect(
          new Set(subject.questions.map(question => question.answer)).size,
        ).toBeGreaterThan(1);
      }),
    );
  });

  it('picks a class or exam, then a subject, each with a fresh paper', () => {
    render(<SampleTestPaper />);
    answerQuestion(CLASS_11_ACCOUNTANCY, 0, CLASS_11_ACCOUNTANCY[0].answer);
    expect(screen.getByText('Answered 1 of 20')).toBeInTheDocument();

    // JEE offers only its own subjects and opens on the first
    fireEvent.click(screen.getByRole('button', { name: 'JEE' }));
    const subjects = screen.getByRole('group', { name: 'Choose a subject' });
    expect(
      within(subjects)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['Physics', 'Chemistry', 'Mathematics']);
    expect(
      within(subjects).getByRole('button', { name: 'Physics' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('radiogroup', {
        name: trackPaper('jee', 'physics')[0].prompt,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Answered 0 of 20')).toBeInTheDocument();

    fireEvent.click(
      within(subjects).getByRole('button', { name: 'Mathematics' }),
    );
    expect(
      screen.getByRole('radiogroup', {
        name: trackPaper('jee', 'mathematics')[0].prompt,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CA / CPT' }));
    expect(
      within(screen.getByRole('group', { name: 'Choose a subject' })).getByRole(
        'button',
        { name: 'Business law' },
      ),
    ).toBeInTheDocument();
  });

  it('marks a full-marks paper 20 / 20 and congratulates the student', () => {
    render(<SampleTestPaper />);
    expect(
      screen.getByRole('button', { name: 'Submit answers' }),
    ).toBeDisabled();

    CLASS_11_ACCOUNTANCY.forEach((question, index) =>
      answerQuestion(CLASS_11_ACCOUNTANCY, index, question.answer),
    );
    expect(screen.getByText('Answered 20 of 20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

    const result = screen.getByRole('status');
    expect(within(result).getByText('Congratulations!')).toBeInTheDocument();
    expect(within(result).getByText('Score 20 / 20')).toBeInTheDocument();
    expect(screen.getAllByText('Correct')).toHaveLength(20);
  });

  it('shows the right answer for wrong and unanswered questions, then resets', () => {
    render(<SampleTestPaper />);
    const first = CLASS_11_ACCOUNTANCY[0];
    const wrongKey = first.options.find(
      option => option.key !== first.answer,
    )!.key;

    answerQuestion(CLASS_11_ACCOUNTANCY, 0, wrongKey);
    answerQuestion(CLASS_11_ACCOUNTANCY, 1, CLASS_11_ACCOUNTANCY[1].answer);
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

    expect(
      within(screen.getByRole('status')).getByText('Score 1 / 20'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Congratulations!')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        `Correct answer: (${first.answer}) ${optionLabel(first, first.answer)}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Not answered · Correct answer/)).toHaveLength(
      18,
    );
    screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Answered 0 of 20')).toBeInTheDocument();
    expect(screen.getByText('Time left 20:00')).toBeInTheDocument();
    screen
      .getAllByRole('radio')
      .forEach(radio => expect(radio).not.toBeChecked());
  });

  it('starts the 20-minute clock on the first answer and marks the paper when time runs out', () => {
    vi.useFakeTimers();
    render(<SampleTestPaper />);
    expect(screen.getByText('Time left 20:00')).toBeInTheDocument();

    answerQuestion(CLASS_11_ACCOUNTANCY, 0, CLASS_11_ACCOUNTANCY[0].answer);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Time left 19:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SAMPLE_TEST_DURATION_SECONDS * 1000);
    });
    expect(screen.getByText("Time's up")).toBeInTheDocument();
    expect(
      within(screen.getByRole('status')).getByText('Score 1 / 20'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});
