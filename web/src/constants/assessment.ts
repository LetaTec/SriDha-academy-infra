import type { SubjectKey } from './topics';

// Short sample tests students can actually take: one five-question paper
// per subject, a five-minute timer and a score out of five.

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

export const SAMPLE_TEST_PAPERS: Record<
  SubjectKey,
  readonly SampleTestQuestion[]
> = {
  accountancy: [
    {
      id: 'gst-intra-state',
      prompt: 'Goods sold within the same state attract',
      options: [
        { key: 'a', label: 'IGST only' },
        { key: 'b', label: 'CGST and SGST' },
        { key: 'c', label: 'Customs duty' },
        { key: 'd', label: 'No GST' },
      ],
      answer: 'b',
    },
    {
      id: 'trial-balance',
      prompt: 'A trial balance checks the',
      options: [
        { key: 'a', label: 'Profit for the year' },
        { key: 'b', label: 'Arithmetical accuracy of the ledger' },
        { key: 'c', label: 'Cash in hand' },
        { key: 'd', label: 'Tax payable' },
      ],
      answer: 'b',
    },
    {
      id: 'depreciation',
      prompt: 'Depreciation is charged on',
      options: [
        { key: 'a', label: 'Fixed assets' },
        { key: 'b', label: 'Closing stock' },
        { key: 'c', label: 'Debtors' },
        { key: 'd', label: 'Cash at bank' },
      ],
      answer: 'a',
    },
    {
      id: 'accounting-equation',
      prompt: 'The accounting equation is',
      options: [
        { key: 'a', label: 'Assets = Capital − Liabilities' },
        { key: 'b', label: 'Capital = Assets + Liabilities' },
        { key: 'c', label: 'Assets = Liabilities + Capital' },
        { key: 'd', label: 'Liabilities = Assets + Capital' },
      ],
      answer: 'c',
    },
    {
      id: 'suspense-account',
      prompt: 'A suspense account is opened when',
      options: [
        { key: 'a', label: 'A new partner joins' },
        { key: 'b', label: 'Cash is short' },
        { key: 'c', label: 'Stock is valued' },
        { key: 'd', label: 'The trial balance does not agree' },
      ],
      answer: 'd',
    },
  ],
  businessStudies: [
    {
      id: 'fayol',
      prompt: 'Who gave the 14 principles of management?',
      options: [
        { key: 'a', label: 'Henri Fayol' },
        { key: 'b', label: 'F. W. Taylor' },
        { key: 'c', label: 'Peter Drucker' },
        { key: 'd', label: 'Philip Kotler' },
      ],
      answer: 'a',
    },
    {
      id: 'first-function',
      prompt: 'The first function of management is',
      options: [
        { key: 'a', label: 'Organising' },
        { key: 'b', label: 'Planning' },
        { key: 'c', label: 'Staffing' },
        { key: 'd', label: 'Controlling' },
      ],
      answer: 'b',
    },
    {
      id: 'marketing-mix',
      prompt: 'Which is not part of the marketing mix?',
      options: [
        { key: 'a', label: 'Product' },
        { key: 'b', label: 'Price' },
        { key: 'c', label: 'Promotion' },
        { key: 'd', label: 'Profit' },
      ],
      answer: 'd',
    },
    {
      id: 'sole-proprietor',
      prompt: "A sole proprietor's liability is",
      options: [
        { key: 'a', label: 'Limited' },
        { key: 'b', label: 'Shared with the state' },
        { key: 'c', label: 'Unlimited' },
        { key: 'd', label: 'Nil' },
      ],
      answer: 'c',
    },
    {
      id: 'sebi',
      prompt: 'SEBI regulates the',
      options: [
        { key: 'a', label: 'Securities market' },
        { key: 'b', label: 'Banking system' },
        { key: 'c', label: 'Insurance sector' },
        { key: 'd', label: 'Foreign trade' },
      ],
      answer: 'a',
    },
  ],
  economics: [
    {
      id: 'central-tendency',
      prompt: 'Mean, median and mode are measures of',
      options: [
        { key: 'a', label: 'Dispersion' },
        { key: 'b', label: 'Central tendency' },
        { key: 'c', label: 'Correlation' },
        { key: 'd', label: 'Index numbers' },
      ],
      answer: 'b',
    },
    {
      id: 'gdp',
      prompt: 'GDP stands for',
      options: [
        { key: 'a', label: 'Gross Domestic Product' },
        { key: 'b', label: 'General Demand Price' },
        { key: 'c', label: 'Gross Development Plan' },
        { key: 'd', label: 'Government Debt Position' },
      ],
      answer: 'a',
    },
    {
      id: 'central-bank',
      prompt: 'The central bank of India is the',
      options: [
        { key: 'a', label: 'State Bank of India' },
        { key: 'b', label: 'NABARD' },
        { key: 'c', label: 'Reserve Bank of India' },
        { key: 'd', label: 'SEBI' },
      ],
      answer: 'c',
    },
    {
      id: 'law-of-demand',
      prompt: 'When its price falls, demand for a normal good usually',
      options: [
        { key: 'a', label: 'Rises' },
        { key: 'b', label: 'Falls' },
        { key: 'c', label: 'Stays the same' },
        { key: 'd', label: 'Becomes zero' },
      ],
      answer: 'a',
    },
    {
      id: 'lpg-reforms',
      prompt: "India's liberalisation reforms began in",
      options: [
        { key: 'a', label: '1947' },
        { key: 'b', label: '1969' },
        { key: 'c', label: '1980' },
        { key: 'd', label: '1991' },
      ],
      answer: 'd',
    },
  ],
  physics: [
    {
      id: 'si-unit-force',
      prompt: 'The SI unit of force is the',
      options: [
        { key: 'a', label: 'Joule' },
        { key: 'b', label: 'Watt' },
        { key: 'c', label: 'Newton' },
        { key: 'd', label: 'Pascal' },
      ],
      answer: 'c',
    },
    {
      id: 'speed-of-light',
      prompt: 'The speed of light in vacuum is about',
      options: [
        { key: 'a', label: '3 × 10⁶ m/s' },
        { key: 'b', label: '3 × 10⁸ m/s' },
        { key: 'c', label: '3 × 10¹⁰ m/s' },
        { key: 'd', label: '3 × 10⁴ m/s' },
      ],
      answer: 'b',
    },
    {
      id: 'ohms-law',
      prompt: "Ohm's law is written as",
      options: [
        { key: 'a', label: 'V = IR' },
        { key: 'b', label: 'V = I / R' },
        { key: 'c', label: 'V = R / I' },
        { key: 'd', label: 'V = I²R' },
      ],
      answer: 'a',
    },
    {
      id: 'convex-lens',
      prompt: 'A convex lens is also called a',
      options: [
        { key: 'a', label: 'Diverging lens' },
        { key: 'b', label: 'Plane lens' },
        { key: 'c', label: 'Concave lens' },
        { key: 'd', label: 'Converging lens' },
      ],
      answer: 'd',
    },
    {
      id: 'gravity',
      prompt: "Acceleration due to gravity on Earth's surface is about",
      options: [
        { key: 'a', label: '8.9 m/s²' },
        { key: 'b', label: '9.8 m/s²' },
        { key: 'c', label: '10.8 m/s²' },
        { key: 'd', label: '98 m/s²' },
      ],
      answer: 'b',
    },
  ],
  chemistry: [
    {
      id: 'symbol-sodium',
      prompt: 'The chemical symbol for sodium is',
      options: [
        { key: 'a', label: 'Na' },
        { key: 'b', label: 'So' },
        { key: 'c', label: 'S' },
        { key: 'd', label: 'Sd' },
      ],
      answer: 'a',
    },
    {
      id: 'ph-water',
      prompt: 'The pH of pure water at 25 °C is',
      options: [
        { key: 'a', label: '0' },
        { key: 'b', label: '1' },
        { key: 'c', label: '7' },
        { key: 'd', label: '14' },
      ],
      answer: 'c',
    },
    {
      id: 'avogadro',
      prompt: "Avogadro's number is about",
      options: [
        { key: 'a', label: '6.022 × 10²²' },
        { key: 'b', label: '6.022 × 10²³' },
        { key: 'c', label: '6.022 × 10²⁴' },
        { key: 'd', label: '3.011 × 10²³' },
      ],
      answer: 'b',
    },
    {
      id: 'water-bond',
      prompt: 'The O–H bonds in a water molecule are',
      options: [
        { key: 'a', label: 'Ionic' },
        { key: 'b', label: 'Metallic' },
        { key: 'c', label: 'Polar covalent' },
        { key: 'd', label: 'Coordinate' },
      ],
      answer: 'c',
    },
    {
      id: 'alkanes',
      prompt: 'The general formula of alkanes is',
      options: [
        { key: 'a', label: 'CₙH₂ₙ₊₂' },
        { key: 'b', label: 'CₙH₂ₙ' },
        { key: 'c', label: 'CₙH₂ₙ₋₂' },
        { key: 'd', label: 'CₙHₙ' },
      ],
      answer: 'a',
    },
  ],
  mathematics: [
    {
      id: 'percent-of-200',
      prompt: 'What is 15% of 200?',
      options: [
        { key: 'a', label: '15' },
        { key: 'b', label: '20' },
        { key: 'c', label: '25' },
        { key: 'd', label: '30' },
      ],
      answer: 'd',
    },
    {
      id: 'derivative',
      prompt: 'The derivative of x² is',
      options: [
        { key: 'a', label: 'x' },
        { key: 'b', label: '2x' },
        { key: 'c', label: 'x² / 2' },
        { key: 'd', label: '2' },
      ],
      answer: 'b',
    },
    {
      id: 'sin-90',
      prompt: 'The value of sin 90° is',
      options: [
        { key: 'a', label: '0' },
        { key: 'b', label: '1/2' },
        { key: 'c', label: '1' },
        { key: 'd', label: '√3 / 2' },
      ],
      answer: 'c',
    },
    {
      id: 'arrangements',
      prompt: 'In how many ways can 3 different books be arranged in a row?',
      options: [
        { key: 'a', label: '6' },
        { key: 'b', label: '3' },
        { key: 'c', label: '9' },
        { key: 'd', label: '27' },
      ],
      answer: 'a',
    },
    {
      id: 'integral-one',
      prompt: 'The integral of 1 with respect to x is',
      options: [
        { key: 'a', label: '0' },
        { key: 'b', label: '1' },
        { key: 'c', label: 'C' },
        { key: 'd', label: 'x + C' },
      ],
      answer: 'd',
    },
  ],
  biology: [
    {
      id: 'powerhouse',
      prompt: 'The powerhouse of the cell is the',
      options: [
        { key: 'a', label: 'Nucleus' },
        { key: 'b', label: 'Mitochondrion' },
        { key: 'c', label: 'Ribosome' },
        { key: 'd', label: 'Golgi body' },
      ],
      answer: 'b',
    },
    {
      id: 'dna-location',
      prompt: 'In a plant or animal cell, DNA is found mainly in the',
      options: [
        { key: 'a', label: 'Nucleus' },
        { key: 'b', label: 'Cell wall' },
        { key: 'c', label: 'Vacuole' },
        { key: 'd', label: 'Cell membrane' },
      ],
      answer: 'a',
    },
    {
      id: 'photosynthesis',
      prompt: 'Photosynthesis takes place in the',
      options: [
        { key: 'a', label: 'Mitochondria' },
        { key: 'b', label: 'Nucleus' },
        { key: 'c', label: 'Chloroplasts' },
        { key: 'd', label: 'Ribosomes' },
      ],
      answer: 'c',
    },
    {
      id: 'heredity-unit',
      prompt: 'The basic unit of heredity is the',
      options: [
        { key: 'a', label: 'Cell' },
        { key: 'b', label: 'Tissue' },
        { key: 'c', label: 'Protein' },
        { key: 'd', label: 'Gene' },
      ],
      answer: 'd',
    },
    {
      id: 'haemoglobin',
      prompt: 'Red blood cells carry oxygen using',
      options: [
        { key: 'a', label: 'Haemoglobin' },
        { key: 'b', label: 'Insulin' },
        { key: 'c', label: 'Keratin' },
        { key: 'd', label: 'Chlorophyll' },
      ],
      answer: 'a',
    },
  ],
};

export const SAMPLE_TEST_DURATION_SECONDS = 5 * 60;

export const SAMPLE_TEST_TEXT = {
  brand: 'SriDha Academy / Practice Test',
  count: (total: number) => `Q 01–${String(total).padStart(2, '0')}`,
  title: 'Test',
  titleEnd: 'Paper',
  meta: (subject: string, total: number) => [
    'Sample test',
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
  subjectsLabel: 'Choose a subject',
} as const;
