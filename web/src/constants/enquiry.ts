import type { EnquiryType, ModelPaperExam } from '@contracts/enquiries';

// Values are checked against the API contract (@contracts/enquiries)
export const ENQUIRY_TYPE = {
  MODEL_PAPER_WAITLIST: 'MODEL_PAPER_WAITLIST',
} as const satisfies Record<string, EnquiryType>;

export const MODEL_PAPER_EXAM = {
  JEE: 'JEE',
  NEET: 'NEET',
  UPSC: 'UPSC',
  CA: 'CA',
  COMMERCE_11_12: 'COMMERCE_11_12',
} as const satisfies Record<string, ModelPaperExam>;

export type { ModelPaperExam };

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
  modelPaperEyebrow: 'AI Model Paper / Waitlist',
  modelPaperTitle: 'Prepare',
  modelPaperTitleEmphasis: 'ahead.',
  examLabel: 'Exam',
  modelPaperFootnote: 'Planned delivery: 7 days before exam',
  modelPaperSubmit: 'Join waitlist',
  modelPaperSuccess: 'You have been added to the model paper waitlist',
  testEyebrow: 'AI Test / Preview',
  testTitle: 'Build your',
  testTitleEmphasis: 'paper.',
  testDescription:
    'AI test papers are being built with our in-house tools. Your profile is ready — we will let you know when tests open for your topics.',
} as const;
