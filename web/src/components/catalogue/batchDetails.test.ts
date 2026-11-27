import { describe, expect, it } from 'vitest';

import { sortBatchesByStart } from '@services/catalogue';
import { fullBatch, openBatch } from '@/test/catalogueFixture';

import { formatBatchCapacity, formatBatchEnrolment } from './batchDetails';

describe('formatBatchEnrolment', () => {
  it('says when enrolment closes, not how many seats are free', () => {
    expect(formatBatchEnrolment({ ...openBatch, seatsRemaining: 86 })).toBe(
      'Enrolment closes on 1 Nov',
    );
  });

  it('shows the seats left once only a few remain', () => {
    expect(formatBatchEnrolment({ ...openBatch, seatsRemaining: 12 })).toBe(
      'Only 12 seats left',
    );
    expect(formatBatchEnrolment({ ...openBatch, seatsRemaining: 1 })).toBe(
      'Only 1 seat left',
    );
  });

  it('says a batch with no seats left is full', () => {
    expect(formatBatchEnrolment(fullBatch)).toBe('Batch full');
  });

  it('shows nothing while the start date is to be announced', () => {
    expect(
      formatBatchEnrolment({
        ...openBatch,
        startDate: null,
        seatsRemaining: 90,
      }),
    ).toBeNull();
  });
});

describe('formatBatchCapacity', () => {
  it('states the batch size', () => {
    expect(formatBatchCapacity([openBatch, fullBatch])).toBe(
      'Max 100 students per batch',
    );
    expect(formatBatchCapacity([{ ...openBatch, capacity: null }])).toBeNull();
  });
});

describe('sortBatchesByStart', () => {
  it('lists batches soonest first, undated last', () => {
    const undated = { ...openBatch, id: 'undated', startDate: null };
    expect(
      sortBatchesByStart([undated, fullBatch, openBatch]).map(b => b.id),
    ).toEqual([openBatch.id, fullBatch.id, 'undated']);
  });
});
