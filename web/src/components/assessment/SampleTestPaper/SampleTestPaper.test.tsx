import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AxiosError } from 'axios';

import {
  SAMPLE_TEST_DURATION_SECONDS,
  SAMPLE_TEST_QUESTION_COUNT,
  SAMPLE_TEST_TRACKS,
  type SampleTestQuestion,
} from '@constants/assessment';
import { findSamplePaper } from '@constants/sampleTestPapers';
import { FEATURES } from '@constants/features';
import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import { loadSamplePapers } from '@hooks/useQuestionBanks';
import { getCurrentSession, signUpStudent } from '@services/auth/api';

import { SampleTestPaper } from './SampleTestPaper';

vi.mock('@services/auth/api', () => ({
  getCurrentSession: vi.fn(),
  logoutStudent: vi.fn(),
  signInStudent: vi.fn(),
  signUpStudent: vi.fn(),
}));

const student = {
  id: 'user_1',
  email: 'meera@example.com',
  role: 'STUDENT' as const,
  name: 'Meera Iyer',
  student: null,
};

const signedOut = () =>
  new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config: { headers: {} } as never,
    data: { message: 'Sign in', code: 'UNAUTHENTICATED', details: null },
  });

// The paper as a signed-in student sees it (or a visitor, with
// signedIn: false), once the saved session has been checked
const renderPaper = async ({ signedIn = true } = {}) => {
  if (signedIn) vi.mocked(getCurrentSession).mockResolvedValue(student);
  else vi.mocked(getCurrentSession).mockRejectedValue(signedOut());

  // Rendered inside an awaited act, so React finishes once the questions
  // (their own download) are in
  await act(async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <SampleTestPaper />
        </AuthProvider>
      </ToastProvider>,
    );
  });
  await screen.findAllByRole('radiogroup');
};

const trackPaper = (trackKey: string, subjectKey: string) =>
  findSamplePaper(trackKey, subjectKey)!;

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

// The paper's own result line (toasts are a status region too)
const paperResult = () =>
  within(screen.getByRole('region', { name: 'Sample test paper' })).getByRole(
    'status',
  );

const optionLabel = (question: SampleTestQuestion, key: string) =>
  question.options.find(option => option.key === key)!.label;

describe('SampleTestPaper', () => {
  // The questions are their own download; fetch them once up front
  beforeAll(async () => {
    await loadSamplePapers();
  });

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
        const questions = trackPaper(track.key, subject.key);
        expect(questions).toHaveLength(SAMPLE_TEST_QUESTION_COUNT);
        questions.forEach(question => {
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
          new Set(questions.map(question => question.answer)).size,
        ).toBeGreaterThan(1);
      }),
    );
  });

  it('picks a class or exam, then a subject, each with a fresh paper', async () => {
    await renderPaper();
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

  it('marks a full-marks paper 20 / 20 and congratulates the student', async () => {
    await renderPaper();
    expect(
      screen.getByRole('button', { name: 'Submit answers' }),
    ).toBeDisabled();

    CLASS_11_ACCOUNTANCY.forEach((question, index) =>
      answerQuestion(CLASS_11_ACCOUNTANCY, index, question.answer),
    );
    expect(screen.getByText('Answered 20 of 20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

    const result = paperResult();
    expect(within(result).getByText('Congratulations!')).toBeInTheDocument();
    expect(within(result).getByText('Score 20 / 20')).toBeInTheDocument();
    expect(screen.getAllByText('Correct')).toHaveLength(20);
  });

  it('shows the right answer for wrong and unanswered questions, then resets', async () => {
    await renderPaper();
    const first = CLASS_11_ACCOUNTANCY[0];
    const wrongKey = first.options.find(
      option => option.key !== first.answer,
    )!.key;

    answerQuestion(CLASS_11_ACCOUNTANCY, 0, wrongKey);
    answerQuestion(CLASS_11_ACCOUNTANCY, 1, CLASS_11_ACCOUNTANCY[1].answer);
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

    expect(within(paperResult()).getByText('Score 1 / 20')).toBeInTheDocument();
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

  it('starts the 20-minute clock on the first answer and marks the paper when time runs out', async () => {
    await renderPaper();
    vi.useFakeTimers();
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
    expect(within(paperResult()).getByText('Score 1 / 20')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('locks the paper for a visitor until they sign up', async () => {
    vi.mocked(signUpStudent).mockResolvedValue(student);
    await renderPaper({ signedIn: false });
    const first = CLASS_11_ACCOUNTANCY[0];

    // The questions are covered, with sign-up and log-in in the middle
    const lock = screen.getByRole('region', {
      name: 'Sign in to start this paper',
    });
    expect(
      within(lock).getByRole('heading', {
        name: 'Sign up or log in to start the test',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit answers' }),
    ).toBeDisabled();

    // Log in opens the sign-in form; the visitor switches to sign-up there
    fireEvent.click(within(lock).getByRole('button', { name: 'Log in' }));
    expect(
      screen.getByRole('dialog', { name: /Sign in to/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    const dialog = screen.getByRole('dialog', { name: /Create your/ });

    fireEvent.change(within(dialog).getByLabelText('Full name'), {
      target: { value: 'Meera Iyer' },
    });
    fireEvent.change(within(dialog).getByLabelText('Email ID'), {
      target: { value: 'meera@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Create a password'), {
      target: { value: 'correct-horse-1' },
    });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Create account' }),
      );
    });

    expect(signUpStudent).toHaveBeenCalledWith({
      fullName: 'Meera Iyer',
      email: 'meera@example.com',
      password: 'correct-horse-1',
    });
    // Signed in: the lock is gone and the paper can be answered
    expect(
      screen.queryByRole('region', { name: 'Sign in to start this paper' }),
    ).not.toBeInTheDocument();
    answerQuestion(CLASS_11_ACCOUNTANCY, 0, first.answer);
    expect(screen.getByText('Answered 1 of 20')).toBeInTheDocument();
  });

  it('shows no lock to a signed-in student', async () => {
    await renderPaper();
    expect(
      screen.queryByRole('region', { name: 'Sign in to start this paper' }),
    ).not.toBeInTheDocument();
  });

  it('opens the paper to visitors while student accounts are off', async () => {
    FEATURES.studentAccounts = false;
    try {
      await renderPaper({ signedIn: false });
      expect(
        screen.queryByRole('region', { name: 'Sign in to start this paper' }),
      ).not.toBeInTheDocument();
      answerQuestion(CLASS_11_ACCOUNTANCY, 0, CLASS_11_ACCOUNTANCY[0].answer);
      expect(screen.getByText('Answered 1 of 20')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      FEATURES.studentAccounts = true;
    }
  });
});
