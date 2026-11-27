import type { KeyValueItem } from '@components/ui/KeyValueList/KeyValueList';
import {
  BATCH_AVAILABILITY_LABEL,
  CATALOGUE_TEXT,
  LOW_SEAT_COUNT,
} from '@constants/catalogue';
import type { Batch, Price } from '@services/catalogue';
import { formatPrice } from '@utils/currency';
import {
  formatDateOnly,
  formatDayMonth,
  formatWallClockTime,
} from '@utils/date';

const orToBeAnnounced = <T>(value: T | null, format: (value: T) => string) =>
  value === null ? CATALOGUE_TEXT.toBeAnnounced : format(value);

export const formatTopicPrice = (price: Price | null) =>
  price ? formatPrice(price) : CATALOGUE_TEXT.priceOnRequest;

// When a batch stops taking students: "Enrolment closes on 17 Dec" (it
// stays open until the day it starts). A nearly full batch says how few
// seats are left instead, and a full one says so. Seat counts are never
// shown otherwise: "300 of 300 seats left" reads as an empty class.
export const formatBatchEnrolment = (batch: Batch): string | null => {
  if (batch.seatsRemaining === 0) return BATCH_AVAILABILITY_LABEL.FULL;
  if (batch.seatsRemaining !== null && batch.seatsRemaining <= LOW_SEAT_COUNT) {
    return CATALOGUE_TEXT.seatsRemaining(batch.seatsRemaining);
  }
  return batch.startDate
    ? CATALOGUE_TEXT.enrolmentCloses(formatDayMonth(batch.startDate))
    : null;
};

// "Max 300 students per batch", from the largest batch of a topic; null
// when no batch has a seat limit
export const formatBatchCapacity = (batches: readonly Batch[]) => {
  const capacity = Math.max(0, ...batches.map(batch => batch.capacity ?? 0));
  return capacity > 0 ? CATALOGUE_TEXT.maxStudents(capacity) : null;
};

// Every batch field the data model supports. Missing values are shown as
// "To be announced" rather than invented.
export const getBatchDetailItems = (batch: Batch): KeyValueItem[] => [
  {
    label: CATALOGUE_TEXT.startsLabel,
    value: orToBeAnnounced(batch.startDate, formatDateOnly),
  },
  {
    label: CATALOGUE_TEXT.timeLabel,
    value: orToBeAnnounced(batch.startTime, formatWallClockTime),
  },
  {
    label: CATALOGUE_TEXT.sessionsLabel,
    value: orToBeAnnounced(batch.sessionCount, CATALOGUE_TEXT.sessionCount),
  },
  {
    label: CATALOGUE_TEXT.durationLabel,
    value: orToBeAnnounced(
      batch.sessionDurationMinutes,
      CATALOGUE_TEXT.durationMinutes,
    ),
  },
  {
    label: CATALOGUE_TEXT.facultyLabel,
    value: orToBeAnnounced(batch.instructorName, name => name),
  },
  {
    label: CATALOGUE_TEXT.seatsLabel,
    value: orToBeAnnounced(formatBatchEnrolment(batch), line => line),
  },
];
