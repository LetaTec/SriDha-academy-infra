import { transaction, type Database } from './client.js';

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

export const CATALOGUE_SEED: readonly SeedSubject[] = [
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
        id: 'chapter_accounts_fundamentals',
        title: 'Accountancy fundamentals',
        topics: [
          {
            id: 'topic_accounts_rectification_class_11',
            title: 'Rectification of errors',
            summary:
              'Find where a ledger went wrong and correct it with the right journal entry, before it reaches the final accounts.',
            level: 'Class 11',
            pricePaise: null,
            priceTaxLabel: null,
            lessons: [
              {
                id: 'lesson_rectification_types',
                title: 'Types of errors',
                durationMinutes: null,
              },
              {
                id: 'lesson_rectification_trial_balance',
                title: 'Errors that affect the trial balance',
                durationMinutes: null,
              },
              {
                id: 'lesson_rectification_suspense',
                title: 'Suspense account',
                durationMinutes: null,
              },
              {
                id: 'lesson_rectification_before_after',
                title: 'Rectifying errors before and after',
                durationMinutes: null,
              },
            ],
            batches: [],
          },
          {
            id: 'topic_accounts_trial_balance_class_11',
            title: 'Trial balance',
            summary:
              'Prepare a trial balance from ledger balances and locate the errors when the totals do not agree.',
            level: 'Class 11',
            pricePaise: null,
            priceTaxLabel: null,
            lessons: [
              {
                id: 'lesson_trial_balance_meaning',
                title: 'Meaning and objectives',
                durationMinutes: null,
              },
              {
                id: 'lesson_trial_balance_ledger',
                title: 'Preparing it from ledger balances',
                durationMinutes: null,
              },
              {
                id: 'lesson_trial_balance_methods',
                title: 'Totals and balances methods',
                durationMinutes: null,
              },
              {
                id: 'lesson_trial_balance_errors',
                title: 'Locating errors when it does not agree',
                durationMinutes: null,
              },
            ],
            batches: [],
          },
          {
            id: 'topic_accounts_brs_class_11',
            title: 'Bank reconciliation statement',
            summary:
              'Reconcile the cash book with the bank passbook and explain every difference between the two balances.',
            level: 'Class 11',
            pricePaise: null,
            priceTaxLabel: null,
            lessons: [
              {
                id: 'lesson_brs_why',
                title: 'Why the cash book and passbook differ',
                durationMinutes: null,
              },
              {
                id: 'lesson_brs_pending',
                title: 'Cheques not yet presented or cleared',
                durationMinutes: null,
              },
              {
                id: 'lesson_brs_preparing',
                title: 'Preparing a BRS',
                durationMinutes: null,
              },
              {
                id: 'lesson_brs_overdraft',
                title: 'Overdraft balances',
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
    chapters: [],
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
    INSERT INTO topics (id, chapter_id, title, summary, level, price_paise, price_tax_label, position)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      chapter_id = EXCLUDED.chapter_id, title = EXCLUDED.title, summary = EXCLUDED.summary,
      level = EXCLUDED.level, price_paise = EXCLUDED.price_paise,
      price_tax_label = EXCLUDED.price_tax_label, position = EXCLUDED.position
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
          await tx.query(upsertTopicSql, [
            topic.id,
            chapter.id,
            topic.title,
            topic.summary,
            topic.level,
            topic.pricePaise,
            topic.priceTaxLabel,
            topicIndex,
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
