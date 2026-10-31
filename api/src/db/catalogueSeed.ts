import { transaction, type Database } from './client.js';
import { TOPIC_LIBRARY, type LibrarySubject } from './topicLibrary.js';

const LIBRARY_BY_ID = new Map(TOPIC_LIBRARY.map(topic => [topic.id, topic]));

// Catalogue content sourced from the SriDha Academy education-model document and the
// approved website prototype. Only values present in those sources are set;
// anything not yet decided (faculty, lesson durations) stays null so the
// website shows an explicit "to be announced" state instead of invented data.

type SeedLesson = {
  id: string;
  title: string;
  durationMinutes: number | null;
};

type SeedBatch = {
  id: string;
  name: string;
  scheduleLabel: string;
  startDate: string | null;
  startTime: string | null;
  sessionCount: number | null;
  sessionDurationMinutes: number | null;
  instructorName: string | null;
  capacity: number | null;
  status: 'OPEN' | 'UPCOMING' | 'INACTIVE';
};

type SeedTopic = {
  id: string;
  title: string;
  summary: string;
  level: string | null;
  pricePaise: number | null;
  priceTaxLabel: string | null;
  lessons: SeedLesson[];
  batches: SeedBatch[];
};

type SeedChapter = {
  id: string;
  title: string;
  topics: SeedTopic[];
};

type SeedSubject = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'AVAILABLE' | 'UPCOMING';
  listPricePaise: number | null;
  listPriceTaxLabel: string | null;
  chapters: SeedChapter[];
};

// The source plan assumes up to 100 students per batch.
const BATCH_CAPACITY = 100;

// The standard topic fee, the same as GST, until the team sets one per
// topic. The launch topics open with one batch on 1 and 2 December 2026.
const LAUNCH_TOPIC_PRICE_PAISE = 12900;

type LaunchTopic = {
  key: string;
  title: string;
  level: string;
  summary: string;
  lessons: readonly string[];
};

const launchTopic = ({
  key,
  title,
  level,
  summary,
  lessons,
}: LaunchTopic): SeedTopic => ({
  id: `topic_${key}`,
  title,
  summary,
  level,
  pricePaise: LAUNCH_TOPIC_PRICE_PAISE,
  priceTaxLabel: null,
  lessons: lessons.map((lessonTitle, index) => ({
    id: `lesson_${key}_${index + 1}`,
    title: lessonTitle,
    durationMinutes: null,
  })),
  batches: [
    {
      id: `batch_${key}_december`,
      name: 'December batch',
      scheduleLabel: '1st & 2nd December',
      startDate: '2026-12-01',
      startTime: '10:00',
      sessionCount: 2,
      sessionDurationMinutes: null,
      instructorName: null,
      capacity: BATCH_CAPACITY,
      status: 'OPEN',
    },
  ],
});

const HANDWRITTEN_CATALOGUE: readonly SeedSubject[] = [
  {
    id: 'subject_accounts',
    slug: 'accounts',
    name: 'Accounts',
    description:
      'Class 11 & 12 commerce learning with structured topic-based batches',
    status: 'AVAILABLE',
    listPricePaise: null,
    listPriceTaxLabel: null,
    chapters: [
      {
        id: 'chapter_accounts_gst',
        title: 'Goods and Services Tax (GST)',
        topics: [
          {
            id: 'topic_accounts_gst_class_11',
            title: 'Learn GST for Class 11',
            summary:
              'A focused topic that explains GST from first principles and shows how GST transactions are recorded in the books.',
            level: 'Class 11',
            pricePaise: 12900,
            priceTaxLabel: null,
            lessons: [
              {
                id: 'lesson_gst_what_is_gst',
                title: 'What is GST',
                durationMinutes: null,
              },
              {
                id: 'lesson_gst_entries',
                title: 'GST entries',
                durationMinutes: null,
              },
              {
                id: 'lesson_gst_input_tax_credit',
                title: 'Input tax credit',
                durationMinutes: null,
              },
              {
                id: 'lesson_gst_journal_entries',
                title: 'Journal entries of GST',
                durationMinutes: null,
              },
            ],
            batches: [
              {
                id: 'batch_gst_class_11_november',
                name: 'November batch',
                scheduleLabel: '1st & 2nd November',
                startDate: '2026-11-01',
                startTime: '10:00',
                sessionCount: 2,
                sessionDurationMinutes: null,
                instructorName: null,
                capacity: BATCH_CAPACITY,
                status: 'OPEN',
              },
              {
                id: 'batch_gst_class_11_december',
                name: 'December batch',
                scheduleLabel: '8th & 9th December',
                startDate: '2026-12-08',
                startTime: '10:00',
                sessionCount: 2,
                sessionDurationMinutes: null,
                instructorName: null,
                capacity: BATCH_CAPACITY,
                status: 'OPEN',
              },
            ],
          },
        ],
      },
      {
        id: 'chapter_accounts_partnership',
        title: 'Partnership accounts',
        topics: [
          launchTopic({
            key: 'accounts_partnership_class_12',
            title: 'Learn Partnership accounts for Class 12',
            level: 'Class 12',
            summary:
              'How partnership firms share profits, value goodwill and settle accounts when partners join, retire or pass away.',
            lessons: [
              'Fundamentals of partnership',
              'Valuation of goodwill',
              'Admission of a partner',
              'Retirement and death of a partner',
            ],
          }),
        ],
      },
    ],
  },
  {
    id: 'subject_chemistry',
    slug: 'chemistry',
    name: 'Chemistry',
    description: 'Class 11 & 12 chemistry taught one topic at a time',
    status: 'AVAILABLE',
    listPricePaise: null,
    listPriceTaxLabel: null,
    chapters: [
      {
        id: 'chapter_chemistry_bonding',
        title: 'Chemical bonding and molecular structure',
        topics: [
          launchTopic({
            key: 'chemistry_bonding_class_11',
            title: 'Learn Chemical bonding for Class 11',
            level: 'Class 11',
            summary:
              'Why atoms bond, how molecules take their shapes and what hybridisation and molecular orbitals explain.',
            lessons: [
              'Ionic and covalent bonds',
              'VSEPR theory and molecular shapes',
              'Hybridisation',
              'Molecular orbital theory',
            ],
          }),
        ],
      },
      {
        id: 'chapter_chemistry_basic_concepts',
        title: 'Some basic concepts of chemistry',
        topics: [
          launchTopic({
            key: 'chemistry_mole_concept_class_11',
            title: 'Learn the Mole concept for Class 11',
            level: 'Class 11',
            summary:
              'Counting particles with the mole, working out formulas and solving stoichiometry problems step by step.',
            lessons: [
              'Mole and molar mass',
              'Empirical and molecular formula',
              'Stoichiometry',
              'Limiting reagent',
            ],
          }),
        ],
      },
    ],
  },
  {
    id: 'subject_physics',
    slug: 'physics',
    name: 'Physics',
    description: 'Class 11 & 12 physics taught one topic at a time',
    status: 'AVAILABLE',
    listPricePaise: null,
    listPriceTaxLabel: null,
    chapters: [
      {
        id: 'chapter_physics_ray_optics',
        title: 'Ray optics and optical instruments',
        topics: [
          launchTopic({
            key: 'physics_ray_optics_class_12',
            title: 'Learn Ray optics for Class 12',
            level: 'Class 12',
            summary:
              'How mirrors and lenses form images, when light is totally reflected and how microscopes and telescopes work.',
            lessons: [
              'Reflection by spherical mirrors',
              'Refraction and lenses',
              'Total internal reflection',
              'Microscopes and telescopes',
            ],
          }),
        ],
      },
      {
        id: 'chapter_physics_current_electricity',
        title: 'Current electricity',
        topics: [
          launchTopic({
            key: 'physics_current_electricity_class_12',
            title: 'Learn Current electricity for Class 12',
            level: 'Class 12',
            summary:
              "Resistance, cells and circuits, solved with Ohm's and Kirchhoff's laws and the Wheatstone bridge.",
            lessons: [
              "Ohm's law and resistivity",
              'Cells, EMF and internal resistance',
              "Kirchhoff's laws",
              'Wheatstone bridge',
            ],
          }),
        ],
      },
      {
        id: 'chapter_physics_laws_of_motion',
        title: 'Laws of motion',
        topics: [
          launchTopic({
            key: 'physics_laws_of_motion_class_11',
            title: 'Learn Laws of motion for Class 11',
            level: 'Class 11',
            summary:
              "Newton's laws applied to real problems, from momentum and friction to motion in a circle.",
            lessons: [
              "Newton's three laws",
              'Conservation of momentum',
              'Friction',
              'Circular motion',
            ],
          }),
        ],
      },
    ],
  },
  {
    id: 'subject_economics',
    slug: 'economics',
    name: 'Economics',
    description:
      'Focused online sessions designed around clear concepts and practice',
    status: 'AVAILABLE',
    listPricePaise: 49900,
    listPriceTaxLabel: 'GST',
    chapters: [],
  },
  {
    id: 'subject_mathematics',
    slug: 'mathematics',
    name: 'Mathematics',
    description:
      'Topic-led classes for students building their fundamentals and exam readiness',
    status: 'AVAILABLE',
    listPricePaise: 49900,
    listPriceTaxLabel: 'GST',
    chapters: [
      {
        id: 'chapter_mathematics_integrals',
        title: 'Integrals',
        topics: [
          launchTopic({
            key: 'maths_integrals_class_12',
            title: 'Learn Integrals for Class 12',
            level: 'Class 12',
            summary:
              'Integration from the basic rules to integration by parts, definite integrals and the area under a curve.',
            lessons: [
              'Indefinite integrals',
              'Integration by parts',
              'Definite integrals',
              'Area under curves',
            ],
          }),
        ],
      },
    ],
  },
  {
    id: 'subject_neet',
    slug: 'neet',
    name: 'NEET',
    description:
      'Competitive preparation pathway planned for the next expansion stage',
    status: 'UPCOMING',
    listPricePaise: null,
    listPriceTaxLabel: null,
    chapters: [],
  },
  {
    id: 'subject_jee',
    slug: 'jee',
    name: 'JEE',
    description:
      'Competitive preparation pathway planned to follow the initial school offering',
    status: 'UPCOMING',
    listPricePaise: null,
    listPriceTaxLabel: null,
    chapters: [],
  },
  {
    id: 'subject_business_studies',
    slug: 'business-studies',
    name: 'Business Studies',
    description: 'Class 11 & 12 business studies taught one topic at a time',
    status: 'AVAILABLE',
    listPricePaise: null,
    listPriceTaxLabel: null,
    chapters: [],
  },
  {
    id: 'subject_biology',
    slug: 'biology',
    name: 'Biology',
    description: 'Class 11 & 12 biology taught one topic at a time',
    status: 'AVAILABLE',
    listPricePaise: null,
    listPriceTaxLabel: null,
    chapters: [],
  },
  {
    id: 'subject_ca_cs',
    slug: 'ca-cs',
    name: 'CA / CS',
    description:
      'Professional examination categories included in the broader education model',
    status: 'UPCOMING',
    listPricePaise: null,
    listPriceTaxLabel: null,
    chapters: [],
  },
];

const LIBRARY_SUBJECT_ID: Record<LibrarySubject, string> = {
  accountancy: 'subject_accounts',
  businessStudies: 'subject_business_studies',
  economics: 'subject_economics',
  physics: 'subject_physics',
  chemistry: 'subject_chemistry',
  mathematics: 'subject_mathematics',
  biology: 'subject_biology',
};

// Every topic on the website that is not written out above: its own
// chapter, the standard fee and no batches yet, so students pre-register.
const withLibraryTopics = (subjects: readonly SeedSubject[]): SeedSubject[] => {
  const seededTopicIds = new Set(
    subjects.flatMap(subject =>
      subject.chapters.flatMap(chapter =>
        chapter.topics.map(topic => topic.id),
      ),
    ),
  );

  return subjects.map(subject => ({
    ...subject,
    chapters: [
      ...subject.chapters,
      ...TOPIC_LIBRARY.filter(
        topic =>
          LIBRARY_SUBJECT_ID[topic.subject] === subject.id &&
          !seededTopicIds.has(topic.id),
      ).map(topic => {
        const key = topic.id.replace(/^topic_/, '');
        return {
          id: `chapter_${key}`,
          title: topic.title,
          topics: [
            {
              id: topic.id,
              title: `Learn ${topic.title} for ${topic.level}`,
              summary: `${topic.title} for ${topic.level}, taught one subtopic at a time with live classes and practice.`,
              level: topic.level,
              pricePaise: LAUNCH_TOPIC_PRICE_PAISE,
              priceTaxLabel: null,
              lessons: topic.lessons.map((title, index) => ({
                id: `lesson_${key}_${index + 1}`,
                title,
                durationMinutes: null,
              })),
              batches: [],
            },
          ],
        };
      }),
    ],
  }));
};

export const CATALOGUE_SEED: readonly SeedSubject[] = withLibraryTopics(
  HANDWRITTEN_CATALOGUE,
);

// Idempotent: re-running updates catalogue rows in place and never touches
// users, sessions or enrolments.
export const seedCatalogue = async (db: Database): Promise<void> => {
  const upsertSubjectSql = `
    INSERT INTO subjects (id, slug, name, description, status, list_price_paise, list_price_tax_label, position)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug, name = EXCLUDED.name, description = EXCLUDED.description,
      status = EXCLUDED.status, list_price_paise = EXCLUDED.list_price_paise,
      list_price_tax_label = EXCLUDED.list_price_tax_label, position = EXCLUDED.position
  `;

  const upsertChapterSql = `
    INSERT INTO chapters (id, subject_id, title, position) VALUES ($1, $2, $3, $4)
    ON CONFLICT (id) DO UPDATE SET
      subject_id = EXCLUDED.subject_id, title = EXCLUDED.title, position = EXCLUDED.position
  `;

  const upsertTopicSql = `
    INSERT INTO topics (id, chapter_id, title, summary, level, price_paise, price_tax_label, position,
      short_title, icon, featured_rank)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      chapter_id = EXCLUDED.chapter_id, title = EXCLUDED.title, summary = EXCLUDED.summary,
      level = EXCLUDED.level, price_paise = EXCLUDED.price_paise,
      price_tax_label = EXCLUDED.price_tax_label, position = EXCLUDED.position,
      short_title = EXCLUDED.short_title, icon = EXCLUDED.icon,
      featured_rank = EXCLUDED.featured_rank
  `;

  const upsertLessonSql = `
    INSERT INTO lessons (id, topic_id, title, duration_minutes, position) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      topic_id = EXCLUDED.topic_id, title = EXCLUDED.title,
      duration_minutes = EXCLUDED.duration_minutes, position = EXCLUDED.position
  `;

  const upsertBatchSql = `
    INSERT INTO batches (id, topic_id, name, schedule_label, start_date, start_time, session_count,
      session_duration_minutes, instructor_name, capacity, status, position)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET
      topic_id = EXCLUDED.topic_id, name = EXCLUDED.name, schedule_label = EXCLUDED.schedule_label,
      start_date = EXCLUDED.start_date, start_time = EXCLUDED.start_time,
      session_count = EXCLUDED.session_count,
      session_duration_minutes = EXCLUDED.session_duration_minutes,
      instructor_name = EXCLUDED.instructor_name, capacity = EXCLUDED.capacity,
      status = EXCLUDED.status, position = EXCLUDED.position
  `;

  await transaction(db, async tx => {
    for (
      let subjectIndex = 0;
      subjectIndex < CATALOGUE_SEED.length;
      subjectIndex++
    ) {
      const subject = CATALOGUE_SEED[subjectIndex];
      await tx.query(upsertSubjectSql, [
        subject.id,
        subject.slug,
        subject.name,
        subject.description,
        subject.status,
        subject.listPricePaise,
        subject.listPriceTaxLabel,
        subjectIndex,
      ]);

      for (
        let chapterIndex = 0;
        chapterIndex < subject.chapters.length;
        chapterIndex++
      ) {
        const chapter = subject.chapters[chapterIndex];
        await tx.query(upsertChapterSql, [
          chapter.id,
          subject.id,
          chapter.title,
          chapterIndex,
        ]);

        for (
          let topicIndex = 0;
          topicIndex < chapter.topics.length;
          topicIndex++
        ) {
          const topic = chapter.topics[topicIndex];
          // The card details come from the topic library
          const card = LIBRARY_BY_ID.get(topic.id);
          await tx.query(upsertTopicSql, [
            topic.id,
            chapter.id,
            topic.title,
            topic.summary,
            topic.level,
            topic.pricePaise,
            topic.priceTaxLabel,
            topicIndex,
            card?.title ?? topic.title,
            card?.icon ?? null,
            card?.featuredRank ?? null,
          ]);

          for (
            let lessonIndex = 0;
            lessonIndex < topic.lessons.length;
            lessonIndex++
          ) {
            const lesson = topic.lessons[lessonIndex];
            await tx.query(upsertLessonSql, [
              lesson.id,
              topic.id,
              lesson.title,
              lesson.durationMinutes,
              lessonIndex,
            ]);
          }

          for (
            let batchIndex = 0;
            batchIndex < topic.batches.length;
            batchIndex++
          ) {
            const batch = topic.batches[batchIndex];
            await tx.query(upsertBatchSql, [
              batch.id,
              topic.id,
              batch.name,
              batch.scheduleLabel,
              batch.startDate,
              batch.startTime,
              batch.sessionCount,
              batch.sessionDurationMinutes,
              batch.instructorName,
              batch.capacity,
              batch.status,
              batchIndex,
            ]);
          }
        }
      }
    }
  });
};
