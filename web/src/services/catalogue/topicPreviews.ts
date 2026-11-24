import { ICONS, type IconName } from '@constants/icons';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import {
  SUBJECT,
  SUBJECT_ICON,
  SUBJECT_SLUG,
  type SubjectKey,
} from '@constants/topics';

import { listTopics } from './mappers';
import type { Batch, Subject, Topic, Tutor } from './types';

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

// Who teaches the student's batch. A batch from the team's roster names its
// teacher, who is shown without a bio (none is written yet); otherwise the
// topic's tutor. With no batch chosen, the topic's batches' one teacher, if
// they share one.
export const findTeacher = (
  preview: TopicPreview,
  batch: Batch | null,
): Tutor | null => {
  const names = new Set(
    (batch ? [batch] : preview.topic.batches)
      .map(item => item.instructorName)
      .filter((name): name is string => Boolean(name)),
  );
  const [name] = names;
  if (names.size !== 1 || !name) return preview.topic.tutor;
  if (preview.topic.tutor?.name === name) return preview.topic.tutor;

  return {
    id: `teacher-${name}`,
    name,
    // The topic, not the subject: the roster's subjects (Quantitative
    // Aptitude, say) do not always match the website's
    headline: CATALOGUE_TEXT.teachesTopic(preview.title),
    credentials: [],
    photoUrl: null,
  };
};

export type TeacherSummary = {
  tutor: Tutor;
  // The topic names they teach, e.g. ["Sets", "Polynomials"]
  topics: string[];
};

// Everyone who teaches a topic, once each, in catalogue order: each batch's
// teacher, or the topic's tutor where its batches name none
export const listTeachers = (
  previews: readonly TopicPreview[],
): TeacherSummary[] => {
  const byName = new Map<string, TeacherSummary>();
  const add = (tutor: Tutor, topic: string) => {
    const summary = byName.get(tutor.name) ?? { tutor, topics: [] };
    if (!summary.topics.includes(topic)) summary.topics.push(topic);
    byName.set(tutor.name, summary);
  };

  for (const preview of previews) {
    const batchTeachers = preview.topic.batches.filter(
      batch => batch.instructorName,
    );
    if (batchTeachers.length > 0) {
      for (const batch of batchTeachers) {
        const teacher = findTeacher(preview, batch);
        if (teacher) add(teacher, preview.title);
      }
    } else if (preview.topic.tutor) {
      add(preview.topic.tutor, preview.title);
    }
  }

  return [...byName.values()];
};
