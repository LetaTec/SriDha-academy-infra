import type { StudentStandard, StudentStream } from '@contracts/auth';

// Values mirror the API enums in api/src/modules/auth/auth.schema.ts.
export const STUDENT_STANDARD = {
  CLASS_10: 'CLASS_10',
  CLASS_11: 'CLASS_11',
  CLASS_12: 'CLASS_12',
  CA: 'CA',
  CS: 'CS',
  NEET: 'NEET',
  JEE: 'JEE',
  BANK_PO: 'BANK_PO',
} as const satisfies Record<string, StudentStandard>;

export type { StudentStandard };

export const STUDENT_STANDARD_LABEL: Record<StudentStandard, string> = {
  CLASS_10: '10th',
  CLASS_11: '11th',
  CLASS_12: '12th',
  CA: 'CA',
  CS: 'CS',
  NEET: 'NEET',
  JEE: 'JEE',
  BANK_PO: 'Bank PO',
};

export const STUDENT_STANDARD_OPTIONS = Object.values(STUDENT_STANDARD).map(
  value => ({ value, label: STUDENT_STANDARD_LABEL[value] }),
);

export const STUDENT_STREAM = {
  COMMERCE: 'COMMERCE',
  SCIENCE: 'SCIENCE',
  ARTS: 'ARTS',
  OTHER: 'OTHER',
} as const satisfies Record<string, StudentStream>;

export type { StudentStream };

export const STUDENT_STREAM_LABEL: Record<StudentStream, string> = {
  COMMERCE: 'Commerce',
  SCIENCE: 'Science',
  ARTS: 'Arts',
  OTHER: 'Other',
};

export const STUDENT_STREAM_OPTIONS = Object.values(STUDENT_STREAM).map(
  value => ({ value, label: STUDENT_STREAM_LABEL[value] }),
);
