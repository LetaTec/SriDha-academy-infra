// Values mirror the API enums in api/src/modules/enquiries/enquiries.routes.ts.
export const ENQUIRY_TYPE = {
  MODEL_PAPER_WAITLIST: 'MODEL_PAPER_WAITLIST',
} as const;

export const MODEL_PAPER_EXAM = {
  JEE: 'JEE',
  NEET: 'NEET',
  UPSC: 'UPSC',
  CA: 'CA',
  COMMERCE_11_12: 'COMMERCE_11_12',
} as const;

export type ModelPaperExam =
  (typeof MODEL_PAPER_EXAM)[keyof typeof MODEL_PAPER_EXAM];

export const MODEL_PAPER_EXAM_LABEL: Record<ModelPaperExam, string> = {
  JEE: 'JEE',
  NEET: 'NEET',
  UPSC: 'UPSC',
  CA: 'CA',
  COMMERCE_11_12: '11th / 12th Commerce',
};

export const MODEL_PAPER_EXAM_OPTIONS = Object.values(MODEL_PAPER_EXAM).map(
  value => ({ value, label: MODEL_PAPER_EXAM_LABEL[value] }),
);

export const ENQUIRY_TEXT = {
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  emailInvalid: 'Enter a valid email address',
  modelPaperEyebrow: 'Sample Papers / Waitlist',
  modelPaperTitle: 'Prepare',
  modelPaperTitleEmphasis: 'ahead.',
  examLabel: 'Exam',
  modelPaperFootnote: 'Planned delivery: 7 days before exam',
  modelPaperSubmit: 'Join waitlist',
  modelPaperSuccess: 'You have been added to the sample paper waitlist',
  testEyebrow: 'Practice Tests / Preview',
  testTitle: 'Build your',
  testTitleEmphasis: 'paper.',
  testDescription:
    'Practice tests are still being built. Your profile is ready, and we will let you know when tests open for your topics.',
} as const;
