import type { Batch } from './types';

// Batch times are published in India Standard Time
const IST_OFFSET = '+05:30';
const MINUTE_MS = 60 * 1000;

// One class of a batch. A batch is one class, or a lecture over
// consecutive days (sessionCount days from its start date), each at the
// batch's start time.
export type ClassSession = {
  // 1 for the first class
  day: number;
  // YYYY-MM-DD
  date: string;
  // Milliseconds since the epoch
  startsAt: number;
  endsAt: number;
};

const addDays = (date: string, days: number) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
};

// Every class of the batch, in order; none while its date or time is not
// announced
export const listBatchSessions = (batch: Batch): ClassSession[] => {
  if (!batch.startDate || !batch.startTime) return [];
  const startDate = batch.startDate;
  const startTime = batch.startTime;
  const count = Math.max(batch.sessionCount ?? 1, 1);
  const lengthMs = (batch.sessionDurationMinutes ?? 0) * MINUTE_MS;

  return Array.from({ length: count }, (_, index) => {
    const date = addDays(startDate, index);
    const startsAt = Date.parse(`${date}T${startTime}:00${IST_OFFSET}`);
    return { day: index + 1, date, startsAt, endsAt: startsAt + lengthMs };
  });
};

// Where a batch is in time: not scheduled yet, its next class still to
// come, a class on right now, or every class over
export type BatchTimeline =
  | { phase: 'unscheduled' }
  | { phase: 'upcoming'; next: ClassSession; sessions: ClassSession[] }
  | { phase: 'live'; current: ClassSession; sessions: ClassSession[] }
  | { phase: 'over'; last: ClassSession; sessions: ClassSession[] };

export const getBatchTimeline = (batch: Batch, now: number): BatchTimeline => {
  const sessions = listBatchSessions(batch);
  if (sessions.length === 0) return { phase: 'unscheduled' };

  const current = sessions.find(
    session => session.startsAt <= now && now < session.endsAt,
  );
  if (current) return { phase: 'live', current, sessions };

  const next = sessions.find(session => session.startsAt > now);
  if (next) return { phase: 'upcoming', next, sessions };

  return { phase: 'over', last: sessions[sessions.length - 1], sessions };
};
