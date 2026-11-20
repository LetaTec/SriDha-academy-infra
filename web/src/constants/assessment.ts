import { SAMPLE_TEST_BANK } from './sampleTestPapers';

// Sample tests students can actually take: a 20-question paper for each
// subject of each class or exam, a 20-minute timer and a score out of 20.

export type SampleTestOption = {
  key: string;
  label: string;
};

export type SampleTestQuestion = {
  id: string;
  prompt: string;
  options: readonly SampleTestOption[];
  answer: string;
};

type SampleTestSubject = {
  key: string;
  label: string;
  questions: readonly SampleTestQuestion[];
};

export type SampleTestTrack = {
  key: string;
  label: string;
  subjects: readonly SampleTestSubject[];
};

const CLASS_SUBJECTS = (bank: typeof SAMPLE_TEST_BANK.class11) => [
  { key: 'accountancy', label: 'Accountancy', questions: bank.accountancy },
  {
    key: 'businessStudies',
    label: 'Business Studies',
    questions: bank.businessStudies,
  },
  { key: 'economics', label: 'Economics', questions: bank.economics },
  { key: 'physics', label: 'Physics', questions: bank.physics },
  { key: 'chemistry', label: 'Chemistry', questions: bank.chemistry },
  { key: 'mathematics', label: 'Mathematics', questions: bank.mathematics },
  { key: 'biology', label: 'Biology', questions: bank.biology },
];

// Choose a class or exam, then a subject within it
export const SAMPLE_TEST_TRACKS: readonly SampleTestTrack[] = [
  {
    key: 'class11',
    label: 'Class 11',
    subjects: CLASS_SUBJECTS(SAMPLE_TEST_BANK.class11),
  },
  {
    key: 'class12',
    label: 'Class 12',
    subjects: CLASS_SUBJECTS(SAMPLE_TEST_BANK.class12),
  },
  {
    key: 'jee',
    label: 'JEE',
    subjects: [
      {
        key: 'physics',
        label: 'Physics',
        questions: SAMPLE_TEST_BANK.jee.physics,
      },
      {
        key: 'chemistry',
        label: 'Chemistry',
        questions: SAMPLE_TEST_BANK.jee.chemistry,
      },
      {
        key: 'mathematics',
        label: 'Mathematics',
        questions: SAMPLE_TEST_BANK.jee.mathematics,
      },
    ],
  },
  {
    key: 'neet',
    label: 'NEET',
    subjects: [
      {
        key: 'physics',
        label: 'Physics',
        questions: SAMPLE_TEST_BANK.neet.physics,
      },
      {
        key: 'chemistry',
        label: 'Chemistry',
        questions: SAMPLE_TEST_BANK.neet.chemistry,
      },
      {
        key: 'biology',
        label: 'Biology',
        questions: SAMPLE_TEST_BANK.neet.biology,
      },
    ],
  },
  {
    key: 'reasoning',
    label: 'Reasoning & aptitude',
    subjects: [
      {
        key: 'logical',
        label: 'Logical reasoning',
        questions: SAMPLE_TEST_BANK.reasoning.logical,
      },
      {
        key: 'quantitative',
        label: 'Quantitative aptitude',
        questions: SAMPLE_TEST_BANK.reasoning.quantitative,
      },
      {
        key: 'verbal',
        label: 'Verbal ability',
        questions: SAMPLE_TEST_BANK.reasoning.verbal,
      },
    ],
  },
  {
    key: 'ca',
    label: 'CA / CPT',
    subjects: [
      {
        key: 'accounting',
        label: 'Accounting',
        questions: SAMPLE_TEST_BANK.ca.accounting,
      },
      { key: 'law', label: 'Business law', questions: SAMPLE_TEST_BANK.ca.law },
      {
        key: 'economics',
        label: 'Business economics',
        questions: SAMPLE_TEST_BANK.ca.economics,
      },
      {
        key: 'maths',
        label: 'Business maths & statistics',
        questions: SAMPLE_TEST_BANK.ca.maths,
      },
    ],
  },
];

// Every paper has this many questions, one mark each
export const SAMPLE_TEST_QUESTION_COUNT = 20;

// A minute a question
export const SAMPLE_TEST_DURATION_SECONDS = 20 * 60;

// The AI Test page (from the header): the paper leads the page
export const AI_TEST_PAGE_TEXT = {
  eyebrow: 'AI Test / Past papers',
  title: 'Practise with',
  titleEmphasis: 'real past papers.',
  lead: 'Twenty questions from real Class 12 board, JEE Advanced and NEET papers. Pick a class or exam, beat the 20-minute clock and see your score straight away',
  note: 'AI papers made for each student are on the way',
  // The paper opens on the board and entrance exam questions
  initialTrack: 'class12',
  action: 'Browse topics',
} as const;

export const SAMPLE_TEST_TEXT = {
  brand: 'SriDha Academy / AI Assessment',
  count: (total: number) => `Q 01–${String(total).padStart(2, '0')}`,
  title: 'Test',
  titleEnd: 'Paper',
  meta: (track: string, subject: string, total: number) => [
    track,
    subject,
    `Max. marks ${total}`,
  ],
  instruction:
    'Choose the correct option. Each question carries 1 mark. The clock starts with your first answer',
  marksLabel: '1 mark',
  answered: (count: number, total: number) => `Answered ${count} of ${total}`,
  timeLeft: (time: string) => `Time left ${time}`,
  timeUp: "Time's up",
  submit: 'Submit answers',
  tryAgain: 'Try again',
  score: (score: number, total: number) => `Score ${score} / ${total}`,
  correct: 'Correct',
  correctAnswer: (key: string, label: string) =>
    `Correct answer: (${key}) ${label}`,
  notAnswered: 'Not answered',
  // Shown after marking, chosen by score
  resultFull: 'Full marks! Every answer is right. That is a small victory.',
  resultGood: 'Nearly there. One more topic and you have full marks.',
  resultStart: 'Every topic starts somewhere. Have another go.',
  celebrationTitle: 'Congratulations!',
  paperLabel: 'Sample test paper',
  tracksLabel: 'Choose a class or exam',
  subjectsLabel: 'Choose a subject',
} as const;
