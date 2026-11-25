import { describe, expect, it } from 'vitest';

import { openBatch } from '@/test/catalogueFixture';

import { getBatchTimeline, listBatchSessions } from './batchSchedule';

// A two-day lecture: 19 and 20 December, 3:00 pm to 5:00 pm IST
const twoDayBatch = {
  ...openBatch,
  startDate: '2026-12-19',
  startTime: '15:00',
  sessionCount: 2,
  sessionDurationMinutes: 120,
};

const at = (iso: string) => Date.parse(iso);

describe('batch schedule', () => {
  it('lists each day of a lecture at the batch time, in India Standard Time', () => {
    expect(listBatchSessions(twoDayBatch)).toEqual([
      {
        day: 1,
        date: '2026-12-19',
        startsAt: at('2026-12-19T09:30:00Z'),
        endsAt: at('2026-12-19T11:30:00Z'),
      },
      {
        day: 2,
        date: '2026-12-20',
        startsAt: at('2026-12-20T09:30:00Z'),
        endsAt: at('2026-12-20T11:30:00Z'),
      },
    ]);
  });

  it('counts down to the first class, then to day 2, and ends after it', () => {
    expect(
      getBatchTimeline(twoDayBatch, at('2026-12-18T12:00:00Z')),
    ).toMatchObject({
      phase: 'upcoming',
      next: { day: 1 },
    });
    expect(
      getBatchTimeline(twoDayBatch, at('2026-12-19T10:00:00Z')),
    ).toMatchObject({
      phase: 'live',
      current: { day: 1 },
    });
    expect(
      getBatchTimeline(twoDayBatch, at('2026-12-19T12:00:00Z')),
    ).toMatchObject({
      phase: 'upcoming',
      next: { day: 2 },
    });
    expect(
      getBatchTimeline(twoDayBatch, at('2026-12-20T11:30:00Z')),
    ).toMatchObject({
      phase: 'over',
      last: { day: 2 },
    });
  });

  it('has no classes while the date or time is to be announced', () => {
    const unscheduled = { ...twoDayBatch, startTime: null };
    expect(listBatchSessions(unscheduled)).toEqual([]);
    expect(getBatchTimeline(unscheduled, Date.now())).toEqual({
      phase: 'unscheduled',
    });
  });
});
