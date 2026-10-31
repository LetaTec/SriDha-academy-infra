import {
  SUBJECT_KEYWORDS,
  SUBJECT_LABEL,
  type TopicPreview,
} from '@constants/topics';

import { parseClassQuery } from './classLevel';

export type TopicPreviewSearch = {
  // The class the query asked for, e.g. 11 for "class 11 gst"
  classNumber: number | null;
  results: TopicPreview[];
};

const classOf = (preview: TopicPreview) =>
  parseClassQuery(preview.level).classNumber;

// Matches topics by class and by words. "class 11" lists every Class 11
// topic whatever its subject, "11th gst" narrows that to GST, and plain
// words match topic names, subtopics and search keywords.
export const searchTopicPreviews = (
  previews: readonly TopicPreview[],
  query: string,
): TopicPreviewSearch => {
  const { classNumber, isClassPrefix, rest } = parseClassQuery(query);
  const words = rest.split(' ').filter(Boolean);

  if (isClassPrefix) return { classNumber: null, results: [...previews] };

  const results = previews.filter(preview => {
    if (classNumber !== null && classOf(preview) !== classNumber) return false;

    const texts = [
      preview.title,
      ...preview.subtopics,
      SUBJECT_LABEL[preview.subject],
      ...SUBJECT_KEYWORDS[preview.subject],
    ].map(text => text.toLowerCase());
    return words.every(word => texts.some(text => text.includes(word)));
  });

  return { classNumber, results };
};

// The classes we teach, lowest first, for "we teach Class 11 right now"
export const listTopicClasses = (previews: readonly TopicPreview[]) =>
  [...new Set(previews.map(classOf))]
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
