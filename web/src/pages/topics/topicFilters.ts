import {
  STREAM,
  SUBJECT,
  SUBJECT_STREAMS,
  TOPIC_AVAILABILITY,
  TOPIC_FILTER_PARAM,
  type StreamKey,
  type SubjectKey,
  type TopicAvailability,
} from '@constants/topics';
import type { TopicPreview } from '@services/catalogue';
import { parseClassQuery } from '@utils/classLevel';
import { searchTopicPreviews } from '@utils/topicSearch';

export type TopicFilters = {
  query: string;
  classNumber: number | null;
  subject: SubjectKey | null;
  stream: StreamKey | null;
  availability: TopicAvailability | null;
};

export type TopicClassGroup = {
  level: string;
  topics: TopicPreview[];
};

export type TopicGroup = {
  subject: SubjectKey;
  count: number;
  // One row per class, so classes are never mixed within a subject
  classes: TopicClassGroup[];
};

const pick = <T extends string>(
  values: Record<string, T>,
  value: string | null,
): T | null =>
  value !== null && (Object.values(values) as string[]).includes(value)
    ? (value as T)
    : null;

// Unknown values in a shared or hand-edited link are ignored
export const readTopicFilters = (params: URLSearchParams): TopicFilters => {
  const classValue = params.get(TOPIC_FILTER_PARAM.classNumber);

  return {
    query: params.get(TOPIC_FILTER_PARAM.query) ?? '',
    classNumber: classValue ? parseClassQuery(classValue).classNumber : null,
    subject: pick(SUBJECT, params.get(TOPIC_FILTER_PARAM.subject)),
    stream: pick(STREAM, params.get(TOPIC_FILTER_PARAM.stream)),
    availability: pick(
      TOPIC_AVAILABILITY,
      params.get(TOPIC_FILTER_PARAM.availability),
    ),
  };
};

export const hasActiveFilters = (filters: TopicFilters) =>
  filters.query.trim() !== '' ||
  filters.classNumber !== null ||
  filters.subject !== null ||
  filters.stream !== null ||
  filters.availability !== null;

const classOf = (preview: TopicPreview) =>
  parseClassQuery(preview.level).classNumber;

// The search box narrows first (it understands "class 11" too), then each
// filter. isOpen says whether a topic has published batches.
export const filterTopics = (
  previews: readonly TopicPreview[],
  filters: TopicFilters,
  isOpen: (preview: TopicPreview) => boolean,
): TopicPreview[] =>
  searchTopicPreviews(previews, filters.query).results.filter(
    preview =>
      (filters.classNumber === null ||
        classOf(preview) === filters.classNumber) &&
      (filters.subject === null || preview.subject === filters.subject) &&
      (filters.stream === null ||
        SUBJECT_STREAMS[preview.subject].includes(filters.stream)) &&
      (filters.availability === null ||
        isOpen(preview) === (filters.availability === TOPIC_AVAILABILITY.open)),
  );

const groupByClass = (previews: readonly TopicPreview[]): TopicClassGroup[] =>
  [...new Set(previews.map(preview => preview.level))]
    .sort(
      (a, b) =>
        (parseClassQuery(a).classNumber ?? 0) -
        (parseClassQuery(b).classNumber ?? 0),
    )
    .map(level => ({
      level,
      topics: previews.filter(preview => preview.level === level),
    }));

// One group per subject, in the usual subject order, each split by class
export const groupTopicsBySubject = (
  previews: readonly TopicPreview[],
): TopicGroup[] =>
  Object.values(SUBJECT)
    .map(subject => {
      const topics = previews.filter(preview => preview.subject === subject);
      return { subject, count: topics.length, classes: groupByClass(topics) };
    })
    .filter(group => group.count > 0);

// Topics per subject, for the subject tabs
export const countTopicsBySubject = (
  previews: readonly TopicPreview[],
): Record<SubjectKey, number> =>
  Object.fromEntries(
    Object.values(SUBJECT).map(subject => [
      subject,
      previews.filter(preview => preview.subject === subject).length,
    ]),
  ) as Record<SubjectKey, number>;
