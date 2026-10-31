import type { Batch, Chapter, Subject, Topic } from '@contracts/catalogue';

export type {
  Batch,
  BatchAvailability,
  Chapter,
  Lesson,
  Price,
  Subject,
  SubjectStatus,
  Topic,
} from '@contracts/catalogue';

// A topic together with the chapter and subject it belongs to.
export type TopicContext = {
  subject: Subject;
  chapter: Chapter;
  topic: Topic;
};

export type BatchContext = TopicContext & {
  batch: Batch;
};
