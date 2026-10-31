import { SUBJECT_STATUS } from '@constants/catalogue';
import type { Batch, Subject, Topic } from '@services/catalogue';

import { openBatch } from './catalogueFixture';

type TopicOptions = {
  featuredRank?: number | null;
  icon?: string | null;
  batches?: Batch[];
  lessons?: string[];
};

// A catalogue topic as the API sends it
export const buildTopic = (
  id: string,
  shortTitle: string,
  level: string,
  {
    featuredRank = null,
    icon = null,
    batches = [],
    lessons = [],
  }: TopicOptions = {},
): Topic => ({
  id,
  title: `Learn ${shortTitle} for ${level}`,
  shortTitle,
  summary: `${shortTitle} for ${level}`,
  level,
  icon,
  featuredRank,
  price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
  lessons: lessons.map((title, index) => ({
    id: `${id}_lesson_${index + 1}`,
    title,
    durationMinutes: null,
  })),
  batches,
});

const buildSubject = (
  slug: string,
  name: string,
  topics: Topic[],
): Subject => ({
  id: `subject_${slug}`,
  slug,
  name,
  description: name,
  status: SUBJECT_STATUS.AVAILABLE,
  listPrice: null,
  chapters: topics.map(topic => ({
    id: `chapter_${topic.id}`,
    title: topic.shortTitle,
    topics: [topic],
  })),
});

// A small catalogue with topics in every subject the website lists, two
// featured topics (GST open, Ray optics without batches) and an exam
// pathway with no topics
export const topicCatalogueFixture: Subject[] = [
  buildSubject('accounts', 'Accounts', [
    buildTopic(
      'topic_accounts_trial_balance_class_11',
      'Trial balance',
      'Class 11',
    ),
    buildTopic('topic_accounts_gst_class_11', 'GST', 'Class 11', {
      featuredRank: 1,
      icon: 'topicGst',
      batches: [openBatch],
      lessons: ['What is GST', 'Input tax credit'],
    }),
    buildTopic(
      'topic_accounts_partnership_class_12',
      'Partnership accounts',
      'Class 12',
    ),
  ]),
  buildSubject('business-studies', 'Business Studies', [
    buildTopic(
      'topic_business_studies_management_class_12',
      'Nature of management',
      'Class 12',
    ),
  ]),
  buildSubject('economics', 'Economics', [
    buildTopic('topic_economics_demand_class_11', 'Demand', 'Class 11'),
  ]),
  buildSubject('physics', 'Physics', [
    buildTopic('topic_physics_ray_optics_class_12', 'Ray optics', 'Class 12', {
      featuredRank: 2,
      icon: 'topicOptics',
    }),
  ]),
  buildSubject('chemistry', 'Chemistry', [
    buildTopic(
      'topic_chemistry_mole_concept_class_11',
      'Mole concept',
      'Class 11',
      {
        // Not an icon the website has: the subject's icon is used
        icon: 'notAnIcon',
      },
    ),
  ]),
  buildSubject('mathematics', 'Mathematics', [
    buildTopic('topic_maths_integrals_class_12', 'Integrals', 'Class 12'),
  ]),
  buildSubject('biology', 'Biology', [
    buildTopic('topic_biology_cell_class_11', 'Cell', 'Class 11'),
    buildTopic('topic_biology_ecosystem_class_12', 'Ecosystem', 'Class 12'),
  ]),
  buildSubject('neet', 'NEET', []),
];
