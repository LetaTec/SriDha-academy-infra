import type { BatchAvailability, SubjectStatus } from '@contracts/catalogue';
import type { SeatStatus as EnrolmentStatus } from '@contracts/payments';

import type { StatusColor } from './status';

// URL search params for the topic panel: the open topic and the batch the
// student intends to select. Kept in the URL so they survive authentication.
export const CATALOGUE_QUERY_PARAM = {
  topic: 'topic',
  batch: 'batch',
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

// The signed-in student's batches (from the profile menu)
export const MY_BATCHES_TEXT = {
  eyebrow: 'Your account',
  title: 'My',
  titleEmphasis: 'batches.',
  loading: 'Loading your batches',
  signInTitle: 'Sign in to see your batches',
  signInMessage:
    'Use the email you paid with, and every batch you booked shows here',
  signIn: 'Sign up or log in',
  loadError: 'Your batches are unavailable right now',
  emptyTitle: 'No batches yet',
  emptyMessage:
    'Batches you book with this email show here, with their dates and teacher',
  browseTopics: 'Browse topics',
  // Under the topic's name, e.g. "Class 11 · Batch 2"
  batchLine: (level: string | null, batch: string) =>
    level ? `${level} · ${batch}` : batch,
  upcomingTitle: 'Upcoming batches',
  previousTitle: 'Previous batches',
  startsIn: 'Class starts in',
  nextDayIn: (day: number) => `Day ${day} starts in`,
  liveNow: 'Your class is on now',
  liveUntil: (time: string) => `Until ${time}`,
  completedOn: (date: string) => `Completed on ${date}`,
  dateToBeAnnounced: 'The class date will be announced soon',
  datesLabel: 'Dates',
  timeLabel: 'Time',
  sessionsLabel: 'Sessions',
  teacherLabel: 'Teacher',
  units: { days: 'Days', hours: 'Hours', minutes: 'Min', seconds: 'Sec' },
  // Read out for the countdown, e.g. "3 days 4 hours 12 minutes"
  countdownLabel: ({
    days,
    hours,
    minutes,
  }: {
    days: number;
    hours: number;
    minutes: number;
  }) => `${days} days ${hours} hours ${minutes} minutes`,
} as const;

export const CATALOGUE_ERROR_CODE = {
  alreadyEnrolled: 'ALREADY_ENROLLED',
  batchFull: 'BATCH_FULL',
  batchUnavailable: 'BATCH_UNAVAILABLE',
  batchNotFound: 'BATCH_NOT_FOUND',
} as const;

// A batch says how many seats are left only once this few remain; before
// that it says when enrolment closes
export const LOW_SEAT_COUNT = 30;

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
  seatsLabel: 'Enrolment',
  priceLabel: 'Price',
  toBeAnnounced: 'To be announced',
  tutorEyebrow: 'Your tutor',
  // Under a roster teacher's name, e.g. "Teaches Alphabet test"
  teachesTopic: (topic: string) => `Teaches ${topic}`,
  tutorLabel: (name: string) => `Your tutor, ${name}`,
  tutorPhotoAlt: (name: string) => `${name}, SriDha Academy tutor`,
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
  // Only when few remain (LOW_SEAT_COUNT or fewer)
  seatsRemaining: (seats: number) =>
    seats === 1 ? 'Only 1 seat left' : `Only ${seats} seats left`,
  // e.g. "Enrolment closes on 17 Dec"
  enrolmentCloses: (date: string) => `Enrolment closes on ${date}`,
  maxStudents: (capacity: number) => `Max ${capacity} students per batch`,
  batchSeatsLabel: 'When enrolment closes for each batch',
  sessionCount: (count: number) =>
    count === 1 ? '1 session' : `${count} sessions`,
  durationMinutes: (minutes: number) => `${minutes} min`,
  lessonCount: (count: number) =>
    count === 1 ? '1 lesson' : `${count} lessons`,
} as const;
