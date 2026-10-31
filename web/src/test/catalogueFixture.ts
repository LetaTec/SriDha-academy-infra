import { BATCH_AVAILABILITY, SUBJECT_STATUS } from '@constants/catalogue';
import type { Batch, Subject } from '@services/catalogue';

export const openBatch: Batch = {
  id: 'batch_gst_class_11_november',
  name: 'November batch',
  scheduleLabel: '1st & 2nd November',
  startDate: '2026-11-01',
  startTime: '10:00',
  sessionCount: 2,
  sessionDurationMinutes: null,
  instructorName: null,
  capacity: 100,
  seatsRemaining: 100,
  availability: BATCH_AVAILABILITY.OPEN,
};

export const fullBatch: Batch = {
  ...openBatch,
  id: 'batch_gst_class_11_december',
  name: 'December batch',
  scheduleLabel: '8th & 9th December',
  startDate: '2026-12-08',
  seatsRemaining: 0,
  availability: BATCH_AVAILABILITY.FULL,
};

export const catalogueFixture: Subject[] = [
  {
    id: 'subject_accounts',
    slug: 'accounts',
    name: 'Accounts',
    description:
      'Class 11 & 12 commerce learning with structured topic-based batches',
    status: SUBJECT_STATUS.AVAILABLE,
    listPrice: null,
    chapters: [
      {
        id: 'chapter_accounts_gst',
        title: 'Goods and Services Tax (GST)',
        topics: [
          {
            id: 'topic_accounts_gst_class_11',
            title: 'Learn GST for Class 11',
            shortTitle: 'GST',
            icon: 'topicGst',
            featuredRank: 1,
            summary: 'A focused topic on GST.',
            level: 'Class 11',
            price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
            lessons: [
              { id: 'lesson_1', title: 'What is GST', durationMinutes: null },
              { id: 'lesson_2', title: 'GST entries', durationMinutes: null },
            ],
            batches: [openBatch, fullBatch],
          },
        ],
      },
    ],
  },
  {
    id: 'subject_physics',
    slug: 'physics',
    name: 'Physics',
    description: 'Class 11 & 12 physics taught one topic at a time',
    status: SUBJECT_STATUS.AVAILABLE,
    listPrice: null,
    chapters: [
      {
        id: 'chapter_physics_ray_optics',
        title: 'Ray optics',
        topics: [
          // Priced but without batches yet: students pre-register
          {
            id: 'topic_physics_ray_optics_class_12',
            title: 'Learn Ray optics for Class 12',
            shortTitle: 'Ray optics',
            icon: 'topicOptics',
            featuredRank: 3,
            summary: 'Mirrors, lenses and optical instruments.',
            level: 'Class 12',
            price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
            lessons: [],
            batches: [],
          },
        ],
      },
    ],
  },
  // Topics without batches in two more subjects, for search and the
  // Topics page's subject groups
  {
    id: 'subject_chemistry',
    slug: 'chemistry',
    name: 'Chemistry',
    description: 'Class 11 & 12 chemistry taught one topic at a time',
    status: SUBJECT_STATUS.AVAILABLE,
    listPrice: null,
    chapters: [
      {
        id: 'chapter_chemistry_bonding',
        title: 'Chemical bonding',
        topics: [
          {
            id: 'topic_chemistry_bonding_class_11',
            title: 'Learn Chemical bonding for Class 11',
            shortTitle: 'Chemical bonding',
            icon: 'topicBonding',
            featuredRank: 2,
            summary: 'Bonds, shapes and hybridisation.',
            level: 'Class 11',
            price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
            lessons: [
              {
                id: 'lesson_bonding_1',
                title: 'Hybridisation',
                durationMinutes: null,
              },
            ],
            batches: [],
          },
        ],
      },
    ],
  },
  {
    id: 'subject_biology',
    slug: 'biology',
    name: 'Biology',
    description: 'Class 11 & 12 biology taught one topic at a time',
    status: SUBJECT_STATUS.AVAILABLE,
    listPrice: null,
    chapters: [
      {
        id: 'chapter_biology_ecosystem',
        title: 'Ecosystem',
        topics: [
          {
            id: 'topic_biology_ecosystem_class_12',
            title: 'Learn Ecosystem for Class 12',
            shortTitle: 'Ecosystem',
            icon: null,
            featuredRank: null,
            summary: 'Energy flow and ecological pyramids.',
            level: 'Class 12',
            price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
            lessons: [],
            batches: [],
          },
        ],
      },
    ],
  },
  {
    id: 'subject_neet',
    slug: 'neet',
    name: 'NEET',
    description: 'Competitive preparation pathway',
    status: SUBJECT_STATUS.UPCOMING,
    listPrice: null,
    chapters: [],
  },
];
