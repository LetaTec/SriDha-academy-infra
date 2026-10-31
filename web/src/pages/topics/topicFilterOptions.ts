import { PAGE_TEXT } from '@constants/pages';
import {
  STREAM,
  STREAM_LABEL,
  TOPIC_AVAILABILITY,
  TAUGHT_CLASS_NUMBERS,
  TOPIC_AVAILABILITY_LABEL,
} from '@constants/topics';
import { formatClassLevel } from '@utils/classLevel';

import type { TopicFilters } from './topicFilters';

// Filters in the side panel; subjects have their own tabs on the page
export type TopicFilterKey = 'classNumber' | 'stream' | 'availability';

export type TopicFilterOption = { value: string; label: string };

export type TopicFilterGroup = {
  key: TopicFilterKey;
  legend: string;
  // The choice that clears this filter
  anyLabel: string;
  options: readonly TopicFilterOption[];
};

export const TOPIC_FILTER_GROUPS: readonly TopicFilterGroup[] = [
  {
    key: 'classNumber',
    legend: PAGE_TEXT.topicsFilterClass,
    anyLabel: PAGE_TEXT.topicsFilterClassAll,
    options: TAUGHT_CLASS_NUMBERS.map(classNumber => ({
      value: String(classNumber),
      label: formatClassLevel(classNumber),
    })),
  },
  {
    key: 'stream',
    legend: PAGE_TEXT.topicsFilterStream,
    anyLabel: PAGE_TEXT.topicsFilterStreamAll,
    options: Object.values(STREAM).map(stream => ({
      value: stream,
      label: STREAM_LABEL[stream],
    })),
  },
  {
    key: 'availability',
    legend: PAGE_TEXT.topicsFilterAvailability,
    anyLabel: PAGE_TEXT.topicsFilterAvailabilityAll,
    options: Object.values(TOPIC_AVAILABILITY).map(value => ({
      value,
      label: TOPIC_AVAILABILITY_LABEL[value],
    })),
  },
];

// The URL value of a filter, '' when it is not applied
export const readFilterValue = (
  filters: TopicFilters,
  key: TopicFilterKey,
): string => {
  const value = filters[key];
  return value === null ? '' : String(value);
};

// The filters currently applied, with their labels, for the chips
export const listActiveFilters = (filters: TopicFilters) =>
  TOPIC_FILTER_GROUPS.flatMap(group => {
    const value = readFilterValue(filters, group.key);
    const option = group.options.find(item => item.value === value);
    return option ? [{ key: group.key, label: option.label }] : [];
  });
