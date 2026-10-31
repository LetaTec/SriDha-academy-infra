import type { BatchAvailability, SubjectStatus } from '@contracts/catalogue';
import type { SeatStatus as EnrolmentStatus } from '@contracts/payments';

import type { StatusColor } from './status';

// URL search params for the topic panel: the open topic and the batch the
// student intends to select. Kept in the URL so they survive authentication.
export const CATALOGUE_QUERY_PARAM = {
  topic: 'topic',
  batch: 'batch',
  // The catalogue topic whose payment panel is open, on any signed-in page
  checkout: 'checkout',
  // A batch chosen before checkout opened, preselected in the panel
  checkoutBatch: 'checkoutBatch',
} as const;

export const SUBJECT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  UPCOMING: 'UPCOMING',
} as const satisfies Record<string, SubjectStatus>;

export type { SubjectStatus };

export const BATCH_AVAILABILITY = {
  OPEN: 'OPEN',
  FULL: 'FULL',
  CLOSED: 'CLOSED',
  UPCOMING: 'UPCOMING',
  INACTIVE: 'INACTIVE',
} as const satisfies Record<string, BatchAvailability>;

export type { BatchAvailability };

export const BATCH_AVAILABILITY_LABEL: Record<BatchAvailability, string> = {
  OPEN: 'Open for enrolment',
  FULL: 'Batch full',
  CLOSED: 'Enrolment closed',
  UPCOMING: 'Opening soon',
  INACTIVE: 'Not running',
};

export const BATCH_AVAILABILITY_COLOR: Record<BatchAvailability, StatusColor> =
  {
    OPEN: 'positive',
    FULL: 'negative',
    CLOSED: 'neutral',
    UPCOMING: 'warning',
    INACTIVE: 'neutral',
  };

export const ENROLMENT_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<string, EnrolmentStatus>;

export type { EnrolmentStatus };

export const ENROLMENT_STATUS_LABEL: Record<EnrolmentStatus, string> = {
  PENDING_PAYMENT: 'Payment pending',
  CONFIRMED: 'Enrolment confirmed',
  CANCELLED: 'Cancelled',
};

export const ENROLMENT_STATUS_COLOR: Record<EnrolmentStatus, StatusColor> = {
  PENDING_PAYMENT: 'warning',
  CONFIRMED: 'positive',
  CANCELLED: 'neutral',
};

export const CATALOGUE_ERROR_CODE = {
  alreadyEnrolled: 'ALREADY_ENROLLED',
  batchFull: 'BATCH_FULL',
  batchUnavailable: 'BATCH_UNAVAILABLE',
  batchNotFound: 'BATCH_NOT_FOUND',
} as const;

export const CATALOGUE_TEXT = {
  topicWiseHeadline:
    'Learn topic by topic. Build confidence one concept at a time.',
  topicWiseNote:
    'SriDha Academy teaches one topic at a time. Each batch covers only the lessons listed for its topic — not the complete subject.',
  chapterLabel: 'Chapter',
  topicLabel: 'Topic',
  lessonsLabel: 'Lessons',
  lessonsIncludedLabel: 'Lessons included in this topic',
  batchesLabel: 'Available batches',
  levelLabel: 'Level',
  scheduleLabel: 'Schedule',
  startsLabel: 'Starts',
  timeLabel: 'Time',
  sessionsLabel: 'Sessions',
  durationLabel: 'Lesson duration',
  facultyLabel: 'Faculty',
  seatsLabel: 'Seats',
  priceLabel: 'Price',
  toBeAnnounced: 'To be announced',
  priceOnRequest: 'Price to be announced',
  selectBatch: 'Select batch',
  selectBatchLabel: (topic: string, schedule: string) =>
    `Select batch: ${topic}, ${schedule}`,
  viewBatches: 'View batches',
  viewTopicDetails: 'View batches',
  chooseAnotherBatch: 'Choose another batch',
  reviewEyebrow: 'Review / Enrolment',
  topicEyebrow: (level: string | null) =>
    level ? `Topic / ${level}` : 'Topic',
  reviewTitle: 'Review your',
  reviewTitleEmphasis: 'selection.',
  continueToPayment: 'Continue to payment',
  paymentNextNote:
    'You pay on the next step. Your seat is held for 30 minutes while you pay',
  viewMyLearning: 'Go to my learning',
  batchNotFound: 'This batch is no longer available. Please choose another.',
  noBatchesMessage: 'Batches for this topic will be announced soon',
  loadError: 'Topic information is unavailable right now',
  topicsLoading: 'Loading topics',
  retry: 'Try again',
  seatsRemaining: (seats: number) =>
    seats === 1 ? '1 seat left' : `${seats} seats left`,
  sessionCount: (count: number) =>
    count === 1 ? '1 session' : `${count} sessions`,
  durationMinutes: (minutes: number) => `${minutes} min`,
  lessonCount: (count: number) =>
    count === 1 ? '1 lesson' : `${count} lessons`,
} as const;
