// Sample tests students can actually take: a 20-question paper for each
// subject of each class or exam, a 20-minute timer and a score out of 20.

export type SampleTestOption = {
  key: string;
  label: string;
};

type FigureRow = readonly string[];

// Apparatus and diagrams drawn for questions whose papers show a figure
export type SampleTestDiagram =
  'photocell' | 'chargedBalls' | 'waterCooler' | 'metaphase';

// What a question shows under its prompt: a table (lists to match, data),
// matrices or determinants, a shaded feasible region, or a drawn diagram.
export type SampleTestFigure =
  | { kind: 'table'; head: FigureRow; rows: readonly FigureRow[] }
  | {
      kind: 'matrices';
      items: readonly {
        name: string;
        rows: readonly FigureRow[];
        // Drawn with straight bars (a determinant) instead of brackets
        determinant?: boolean;
      }[];
    }
  | {
      kind: 'region';
      // Corner points of the feasible region, in order round it
      corners: readonly (readonly [number, number])[];
      xMax: number;
      yMax: number;
    }
  | { kind: 'diagram'; name: SampleTestDiagram };

export type SampleTestQuestion = {
  id: string;
  prompt: string;
  options: readonly SampleTestOption[];
  answer: string;
  figure?: SampleTestFigure;
  // Why the answer is right, shown once the paper is marked
  explanation?: string;
};

// The class or exam and subject names, shown at once. Each paper's
// questions are a separate download (sampleTestPapers.ts), fetched the first
// time a paper opens; see useQuestionBanks.
type SampleTestSubject = {
  key: string;
  label: string;
};

export type SampleTestTrack = {
  key: string;
  label: string;
  subjects: readonly SampleTestSubject[];
};

const CLASS_SUBJECTS: readonly SampleTestSubject[] = [
  { key: 'accountancy', label: 'Accountancy' },
  { key: 'businessStudies', label: 'Business Studies' },
  { key: 'economics', label: 'Economics' },
  { key: 'physics', label: 'Physics' },
  { key: 'chemistry', label: 'Chemistry' },
  { key: 'mathematics', label: 'Mathematics' },
  { key: 'biology', label: 'Biology' },
];

// Choose a class or exam, then a subject within it
export const SAMPLE_TEST_TRACKS: readonly SampleTestTrack[] = [
  { key: 'class11', label: 'Class 11', subjects: CLASS_SUBJECTS },
  { key: 'class12', label: 'Class 12', subjects: CLASS_SUBJECTS },
  {
    key: 'jee',
    label: 'JEE',
    subjects: [
      { key: 'physics', label: 'Physics' },
      { key: 'chemistry', label: 'Chemistry' },
      { key: 'mathematics', label: 'Mathematics' },
    ],
  },
  {
    key: 'neet',
    label: 'NEET',
    subjects: [
      { key: 'physics', label: 'Physics' },
      { key: 'chemistry', label: 'Chemistry' },
      { key: 'biology', label: 'Biology' },
    ],
  },
  {
    key: 'reasoning',
    label: 'Reasoning & aptitude',
    subjects: [
      { key: 'logical', label: 'Logical reasoning' },
      { key: 'quantitative', label: 'Quantitative aptitude' },
      { key: 'verbal', label: 'Verbal ability' },
    ],
  },
  {
    key: 'ca',
    label: 'CA / CPT',
    subjects: [
      { key: 'accounting', label: 'Accounting' },
      { key: 'law', label: 'Business law' },
      { key: 'economics', label: 'Business economics' },
      { key: 'maths', label: 'Business maths & statistics' },
    ],
  },
];

// Topics with a topic test, and how many questions each has. Kept here so
// the topic list never downloads the questions; a test checks it matches
// topicTestPapers.ts.
export const TOPIC_TEST_QUESTION_COUNTS: Readonly<Record<string, number>> = {
  topic_accounts_gst_class_11: 20,
  topic_chemistry_bonding_class_11: 20,
  topic_physics_ray_optics_class_12: 20,
  topic_maths_integrals_class_12: 20,
  topic_chemistry_mole_concept_class_11: 20,
  topic_physics_current_electricity_class_12: 20,
  topic_physics_laws_of_motion_class_11: 20,
  topic_accounts_partnership_class_12: 20,
};

// How many questions the topic's test has, or null when it has none yet
export const findTopicTestSize = (topicId: string) =>
  Object.hasOwn(TOPIC_TEST_QUESTION_COUNTS, topicId)
    ? TOPIC_TEST_QUESTION_COUNTS[topicId]
    : null;

// Every paper has this many questions, one mark each
export const SAMPLE_TEST_QUESTION_COUNT = 20;

// A minute a question
export const SAMPLE_TEST_DURATION_SECONDS = 20 * 60;

// Topic tests are harder: two hours for the twenty questions
export const TOPIC_TEST_DURATION_SECONDS = 2 * 60 * 60;

const TOPIC_TEST_HOURS = `${TOPIC_TEST_DURATION_SECONDS / 3600} hours`;

// The Topic Test Paper page (from the header): every topic, with a test to
// take on the topics that have one
export const TOPIC_TESTS_PAGE_TEXT = {
  eyebrow: 'Topic Test Paper / One topic at a time',
  title: 'Test yourself,',
  titleEmphasis: 'one topic at a time.',
  lead: `Twenty hard questions on a single topic, with ${TOPIC_TEST_HOURS} on the clock. Pick a topic, start when you are ready and see every answer once the paper is marked`,
  readyTitle: 'Tests ready to take',
  soonTitle: 'Tests coming soon',
  takeAction: 'Take the test',
  readyStatus: (count: number) => `${count} questions · ${TOPIC_TEST_HOURS}`,
  soonStatus: 'Test coming soon',
  actionLabel: (title: string, level: string) =>
    `Take the ${title} test, ${level}`,
  count: (shown: number, ready: number) =>
    `${shown} topics · ${ready} tests ready`,
  emptyTitle: 'No topics match',
  emptyMessage: 'Try another word, or clear the search',
  clearSearch: 'Clear search',
} as const;

// One topic's test: the rules, then the paper once the student starts
export const TOPIC_TEST_TEXT = {
  eyebrow: (level: string) => `Topic Test Paper / ${level}`,
  titleEmphasis: 'Topic test.',
  rules: (count: number) => [
    `${count} questions, 1 mark each`,
    `${TOPIC_TEST_HOURS} on the clock, starting when you press start`,
    'The paper submits itself when the time runs out',
    'The right answers and your score show once it is marked',
  ],
  rulesLabel: 'Before you start',
  start: 'Start the test',
  instruction:
    'Choose the correct option. Each question carries 1 mark. The paper submits itself when the clock runs out',
  meta: (level: string, topic: string, total: number) => [
    level,
    topic,
    `Max. marks ${total}`,
    TOPIC_TEST_HOURS,
  ],
  paperLabel: 'Topic test paper',
  back: 'All topic tests',
  notReadyTitle: 'This test is not ready yet',
  notReadyMessage: 'Pick a topic whose test is ready to take',
} as const;

// The AI Test page (from the header): the paper leads the page
export const AI_TEST_PAGE_TEXT = {
  eyebrow: 'PYQ Test Paper / Previous year questions',
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
  // The bar under the paper once it is marked
  marked: (score: number, total: number) => `Marked: ${score} of ${total}`,
  correct: 'Correct',
  correctAnswer: (key: string, label: string) =>
    `Correct answer: (${key}) ${label}`,
  notAnswered: 'Not answered',
  why: (reason: string) => `Why: ${reason}`,
  // Shown after marking, chosen by score
  resultFull: 'Full marks! Every answer is right. That is a small victory.',
  resultGood: 'Nearly there. One more topic and you have full marks.',
  resultStart: 'Every topic starts somewhere. Have another go.',
  celebrationTitle: 'Congratulations!',
  paperLabel: 'Sample test paper',
  loading: 'Opening the paper',
  tracksLabel: 'Choose a class or exam',
  // Read out for drawn figures
  diagramLabel: {
    photocell:
      'A vacuum tube: light falls on a cathode plate on the left, electrons cross to a wire-mesh anode on the right, and a battery of potential difference V is connected across the two',
    chargedBalls:
      'A closed cylindrical chamber with conducting plates at the top and bottom, light balls resting on the bottom plate, a high voltage source across the plates and an ammeter in the circuit',
    waterCooler:
      'A cooler tank connected to a device by two pipes: cold water flows from the cooler to the device and hot water flows back',
    metaphase:
      'Two equally likely arrangements of two homologous chromosome pairs at Metaphase I, each giving gametes with different combinations of the chromosomes',
  },
  regionLabel: (corners: string) =>
    `A shaded feasible region on x and y axes with corner points ${corners}`,
  matricesLabel: 'Matrices for this question',
  subjectsLabel: 'Choose a subject',
} as const;
