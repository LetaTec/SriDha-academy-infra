import { BATCH_AVAILABILITY } from '@constants/catalogue';

import type {
  Batch,
  BatchContext,
  Subject,
  Topic,
  TopicContext,
} from './types';

export const listTopics = (subjects: readonly Subject[]): TopicContext[] =>
  subjects.flatMap(subject =>
    subject.chapters.flatMap(chapter =>
      chapter.topics.map(topic => ({ subject, chapter, topic })),
    ),
  );

export const findTopicContext = (
  subjects: readonly Subject[],
  topicId: string | null,
): TopicContext | null =>
  topicId
    ? (listTopics(subjects).find(context => context.topic.id === topicId) ??
      null)
    : null;

export const findBatchContext = (
  subjects: readonly Subject[],
  batchId: string | null,
): BatchContext | null => {
  if (!batchId) return null;

  for (const context of listTopics(subjects)) {
    const batch = context.topic.batches.find(item => item.id === batchId);
    if (batch) return { ...context, batch };
  }

  return null;
};

export const isBatchOpen = (batch: Batch) =>
  batch.availability === BATCH_AVAILABILITY.OPEN;

// Soonest first; a batch without a date goes last
export const sortBatchesByStart = (batches: readonly Batch[]): Batch[] =>
  [...batches].sort((a, b) =>
    a.startDate === b.startDate
      ? 0
      : a.startDate === null
        ? 1
        : b.startDate === null
          ? -1
          : a.startDate.localeCompare(b.startDate),
  );

// The batch a student could join next: the earliest dated open batch, or the
// earliest dated batch when none is open.
export const findNextBatch = (topic: Topic): Batch | null => {
  const dated = topic.batches
    .filter(batch => batch.startDate !== null)
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));

  return dated.find(isBatchOpen) ?? dated[0] ?? null;
};
