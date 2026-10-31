import { ICONS, type IconName } from '@constants/icons';
import {
  SUBJECT,
  SUBJECT_ICON,
  SUBJECT_SLUG,
  type SubjectKey,
} from '@constants/topics';

import { listTopics } from './mappers';
import type { Subject, Topic } from './types';

// A topic as its card shows it, built from the catalogue
export type TopicPreview = {
  // The card name, e.g. "GST"
  title: string;
  level: string;
  subject: SubjectKey;
  icon: IconName;
  // What the topic's batches teach, shown on the card's hover overlay
  subtopics: readonly string[];
  catalogueTopicId: string;
  // The catalogue topic, with its fee and batches
  topic: Topic;
};

const SUBJECT_BY_SLUG = new Map(
  Object.entries(SUBJECT_SLUG).map(([key, slug]) => [slug, key as SubjectKey]),
);

const isIconName = (value: string | null): value is IconName =>
  value !== null && Object.hasOwn(ICONS, value);

// Every topic as a card. Featured topics come first, in their rank (the
// short lists show the first few); the rest follow subject by subject in
// catalogue order. Topics of subjects the website does not list (exam
// pathways with no topics yet) are left out.
export const toTopicPreviews = (
  subjects: readonly Subject[],
): TopicPreview[] => {
  const previews = listTopics(subjects).flatMap(({ subject, topic }) => {
    const subjectKey = SUBJECT_BY_SLUG.get(subject.slug);
    if (!subjectKey) return [];

    return [
      {
        title: topic.shortTitle,
        level: topic.level ?? '',
        subject: subjectKey,
        icon: isIconName(topic.icon) ? topic.icon : SUBJECT_ICON[subjectKey],
        subtopics: topic.lessons.map(lesson => lesson.title),
        catalogueTopicId: topic.id,
        topic,
      },
    ];
  });

  const featured = previews
    .filter(preview => preview.topic.featuredRank !== null)
    .sort(
      (a, b) => Number(a.topic.featuredRank) - Number(b.topic.featuredRank),
    );
  const others = Object.values(SUBJECT).flatMap(subjectKey =>
    previews.filter(
      preview =>
        preview.topic.featuredRank === null && preview.subject === subjectKey,
    ),
  );

  return [...featured, ...others];
};

// A topic is open when it has published batches
export const hasBatches = (preview: TopicPreview) =>
  preview.topic.batches.length > 0;
