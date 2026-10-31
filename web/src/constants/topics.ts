import type { IconName } from './icons';

// How the website presents subjects and filters topics. The topics
// themselves come from the catalogue; see services/catalogue/topicPreviews.

export const SUBJECT = {
  accountancy: 'accountancy',
  businessStudies: 'businessStudies',
  economics: 'economics',
  physics: 'physics',
  chemistry: 'chemistry',
  mathematics: 'mathematics',
  biology: 'biology',
} as const;

export type SubjectKey = (typeof SUBJECT)[keyof typeof SUBJECT];

export const SUBJECT_LABEL: Record<SubjectKey, string> = {
  accountancy: 'Accountancy',
  businessStudies: 'Business Studies',
  economics: 'Economics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};

// Extra words students search with, beyond the subject's label
export const SUBJECT_KEYWORDS: Record<SubjectKey, readonly string[]> = {
  accountancy: ['Accounts', 'Commerce'],
  businessStudies: ['Business', 'BST', 'Commerce'],
  economics: ['Eco', 'Commerce'],
  physics: ['Science'],
  chemistry: ['Science'],
  mathematics: ['Maths', 'Math'],
  biology: ['Bio', 'Science'],
};

export const SUBJECT_ICON: Record<SubjectKey, IconName> = {
  accountancy: 'subjectAccountancy',
  businessStudies: 'subjectBusiness',
  economics: 'subjectEconomics',
  physics: 'subjectPhysics',
  chemistry: 'subjectChemistry',
  mathematics: 'subjectMathematics',
  biology: 'subjectBiology',
};

export const STREAM = {
  commerce: 'commerce',
  science: 'science',
} as const;

export type StreamKey = (typeof STREAM)[keyof typeof STREAM];

export const STREAM_LABEL: Record<StreamKey, string> = {
  commerce: 'Commerce',
  science: 'Science',
};

// Mathematics is taught in both streams
export const SUBJECT_STREAMS: Record<SubjectKey, readonly StreamKey[]> = {
  accountancy: [STREAM.commerce],
  businessStudies: [STREAM.commerce],
  economics: [STREAM.commerce],
  physics: [STREAM.science],
  chemistry: [STREAM.science],
  mathematics: [STREAM.commerce, STREAM.science],
  biology: [STREAM.science],
};

// The catalogue's subject behind each subject key (Subject.slug in the API)
export const SUBJECT_SLUG: Record<SubjectKey, string> = {
  accountancy: 'accounts',
  businessStudies: 'business-studies',
  economics: 'economics',
  physics: 'physics',
  chemistry: 'chemistry',
  mathematics: 'mathematics',
  biology: 'biology',
};

// The classes SriDha Academy teaches, for the class filter and the
// header search's "we teach" note. The topics themselves come from the
// catalogue (GET /api/catalogue).
export const TAUGHT_CLASS_NUMBERS = [11, 12] as const;

// In a stat list, stands for the live number of topics (see
// useStatsWithTopicCount)
export const LIVE_TOPIC_COUNT = 'live-topic-count';

// How many topics each surface shows before linking to the Topics page
export const SIGN_IN_TOPIC_COUNT = 4;
export const HOME_TOPIC_COUNT = 8;
export const FOOTER_TOPIC_COUNT = 6;

// Availability of a topic's batches, used by the Topics page filter
export const TOPIC_AVAILABILITY = {
  open: 'open',
  soon: 'soon',
} as const;

export type TopicAvailability =
  (typeof TOPIC_AVAILABILITY)[keyof typeof TOPIC_AVAILABILITY];

export const TOPIC_AVAILABILITY_LABEL: Record<TopicAvailability, string> = {
  open: 'Batches open',
  soon: 'Batches opening soon',
};

// Topics page filters live in the URL, so a filtered list can be shared
export const TOPIC_FILTER_PARAM = {
  query: 'q',
  classNumber: 'class',
  subject: 'subject',
  stream: 'stream',
  availability: 'availability',
} as const;
