import type { AppContext } from '../../app/context.js';
import type { DatabaseClient, Row } from '../../db/client.js';

export const BATCH_AVAILABILITY = {
  open: 'OPEN',
  full: 'FULL',
  closed: 'CLOSED',
  upcoming: 'UPCOMING',
  inactive: 'INACTIVE',
} as const;

export type BatchAvailability =
  (typeof BATCH_AVAILABILITY)[keyof typeof BATCH_AVAILABILITY];

export type Price = {
  amountPaise: number;
  currency: 'INR';
  taxLabel: string | null;
};

export type Lesson = {
  id: string;
  title: string;
  durationMinutes: number | null;
};

export type Batch = {
  id: string;
  name: string;
  scheduleLabel: string;
  startDate: string | null;
  startTime: string | null;
  sessionCount: number | null;
  sessionDurationMinutes: number | null;
  instructorName: string | null;
  capacity: number | null;
  seatsRemaining: number | null;
  availability: BatchAvailability;
};

export type Topic = {
  id: string;
  title: string;
  summary: string;
  level: string | null;
  price: Price | null;
  lessons: Lesson[];
  batches: Batch[];
};

export type Chapter = {
  id: string;
  title: string;
  topics: Topic[];
};

export type Subject = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'AVAILABLE' | 'UPCOMING';
  listPrice: Price | null;
  chapters: Chapter[];
};

const toNullableString = (value: unknown) =>
  value === null || value === undefined ? null : String(value);

const toNullableNumber = (value: unknown) =>
  value === null || value === undefined ? null : Number(value);

export const toPrice = (amount: unknown, taxLabel: unknown): Price | null =>
  amount === null || amount === undefined
    ? null
    : {
        amountPaise: Number(amount),
        currency: 'INR',
        taxLabel: toNullableString(taxLabel),
      };

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

// Availability is always derived on the server from the stored status, the
// start date and the live seat count — never trusted from the client.
export const resolveBatchAvailability = (
  row: Row,
  activeEnrolments: number,
  today: string,
): BatchAvailability => {
  if (row.status === 'INACTIVE') return BATCH_AVAILABILITY.inactive;
  if (row.status === 'UPCOMING') return BATCH_AVAILABILITY.upcoming;

  const startDate = toNullableString(row.start_date);
  if (startDate !== null && startDate < today) {
    return BATCH_AVAILABILITY.closed;
  }

  const capacity = toNullableNumber(row.capacity);
  if (capacity !== null && activeEnrolments >= capacity) {
    return BATCH_AVAILABILITY.full;
  }

  return BATCH_AVAILABILITY.open;
};

// An unpaid enrolment holds its seat for this long after checkout starts.
// Abandoned checkouts then stop counting, so a batch never looks full with
// seats nobody paid for. Paid (confirmed) seats always count.
export const SEAT_HOLD_MINUTES = 30;

const holdCutoff = (now: Date) =>
  new Date(now.getTime() - SEAT_HOLD_MINUTES * 60 * 1000).toISOString();

// Seats taken: confirmed, or unpaid and still within the hold
const SEAT_TAKEN = `(status = 'CONFIRMED'
  OR (status = 'PENDING_PAYMENT' AND updated_at > $1::timestamptz))`;

const countActiveEnrolments = async (db: DatabaseClient, now: Date) => {
  const rows = await db.all(
    `SELECT batch_id, COUNT(*) AS taken FROM enrolments
     WHERE ${SEAT_TAKEN} GROUP BY batch_id`,
    [holdCutoff(now)],
  );
  return new Map(rows.map(row => [String(row.batch_id), Number(row.taken)]));
};

export const toBatch = (
  row: Row,
  activeEnrolments: number,
  today: string,
): Batch => {
  const capacity = toNullableNumber(row.capacity);

  return {
    id: String(row.id),
    name: String(row.name),
    scheduleLabel: String(row.schedule_label),
    startDate: toNullableString(row.start_date),
    startTime: toNullableString(row.start_time),
    sessionCount: toNullableNumber(row.session_count),
    sessionDurationMinutes: toNullableNumber(row.session_duration_minutes),
    instructorName: toNullableString(row.instructor_name),
    capacity,
    seatsRemaining:
      capacity === null ? null : Math.max(capacity - activeEnrolments, 0),
    availability: resolveBatchAvailability(row, activeEnrolments, today),
  };
};

export const toTopicSummary = (row: Row) => ({
  id: String(row.id),
  title: String(row.title),
  summary: String(row.summary),
  level: toNullableString(row.level),
  price: toPrice(row.price_paise, row.price_tax_label),
});

export const toLesson = (row: Row): Lesson => ({
  id: String(row.id),
  title: String(row.title),
  durationMinutes: toNullableNumber(row.duration_minutes),
});

const groupBy = <T>(rows: Row[], key: string, map: (row: Row) => T) =>
  rows.reduce((groups, row) => {
    const groupKey = String(row[key]);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), map(row)]);
    return groups;
  }, new Map<string, T[]>());

export const getCatalogue = async ({
  db,
  now,
}: AppContext): Promise<Subject[]> => {
  const today = toDateOnly(now());
  const taken = await countActiveEnrolments(db, now());

  const [lessonsRows, batchesRows, topicsRows, chaptersRows, subjectsRows] =
    await Promise.all([
      db.all('SELECT * FROM lessons ORDER BY position'),
      db.all('SELECT * FROM batches ORDER BY position'),
      db.all('SELECT * FROM topics ORDER BY position'),
      db.all('SELECT * FROM chapters ORDER BY position'),
      db.all('SELECT * FROM subjects ORDER BY position'),
    ]);

  const lessonsByTopic = groupBy(lessonsRows, 'topic_id', toLesson);
  const batchesByTopic = groupBy(batchesRows, 'topic_id', row =>
    toBatch(row, taken.get(String(row.id)) ?? 0, today),
  );
  const topicsByChapter = groupBy(topicsRows, 'chapter_id', (row): Topic => ({
    ...toTopicSummary(row),
    lessons: lessonsByTopic.get(String(row.id)) ?? [],
    batches: batchesByTopic.get(String(row.id)) ?? [],
  }));
  const chaptersBySubject = groupBy(
    chaptersRows,
    'subject_id',
    (row): Chapter => ({
      id: String(row.id),
      title: String(row.title),
      topics: topicsByChapter.get(String(row.id)) ?? [],
    }),
  );

  return subjectsRows.map((row): Subject => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description),
    status: row.status === 'UPCOMING' ? 'UPCOMING' : 'AVAILABLE',
    listPrice: toPrice(row.list_price_paise, row.list_price_tax_label),
    chapters: chaptersBySubject.get(String(row.id)) ?? [],
  }));
};

export const listTopicLessons = (db: DatabaseClient, topicId: string) =>
  db.all<Row>('SELECT * FROM lessons WHERE topic_id = $1 ORDER BY position', [
    topicId,
  ]);

export const getBatchRow = async (db: DatabaseClient, batchId: string) => {
  return (
    (await db.get('SELECT * FROM batches WHERE id = $1', [batchId])) ?? null
  );
};

// excludeEnrolmentId leaves out the student's own seat, when renewing it
export const countActiveEnrolmentsForBatch = async (
  db: DatabaseClient,
  batchId: string,
  now: Date,
  excludeEnrolmentId: string | null = null,
) => {
  const row = await db.get(
    `SELECT COUNT(*) AS taken FROM enrolments
     WHERE ${SEAT_TAKEN} AND batch_id = $2
       AND ($3::text IS NULL OR id <> $3::text)`,
    [holdCutoff(now), batchId, excludeEnrolmentId],
  );
  return Number(row?.taken ?? 0);
};

export { toDateOnly, type Row };
