import { describe, expect, it } from 'vitest';

import { sortBatchesByStart } from '@services/catalogue';
import { fullBatch, openBatch } from '@/test/catalogueFixture';

import { formatBatchSeats } from './batchDetails';

describe('formatBatchSeats', () => {
  it('shows the seats left out of the batch size', () => {
    expect(formatBatchSeats({ ...openBatch, seatsRemaining: 86 })).toBe(
      '86 of 100 seats left',
    );
  });

  it('says a batch with no seats left is full', () => {
    expect(formatBatchSeats(fullBatch)).toBe('Batch full');
  });

  it('shows only the seats left when the batch size is unknown', () => {
    expect(
      formatBatchSeats({ ...openBatch, capacity: null, seatsRemaining: 1 }),
    ).toBe('1 seat left');
  });

  it('shows nothing for a batch without a seat limit', () => {
    expect(
      formatBatchSeats({ ...openBatch, capacity: null, seatsRemaining: null }),
    ).toBeNull();
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
