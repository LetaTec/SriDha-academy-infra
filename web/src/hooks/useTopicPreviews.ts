import { useMemo } from 'react';

import { LIVE_TOPIC_COUNT } from '@constants/topics';
import { toTopicPreviews } from '@services/catalogue';

import { useCatalogue } from './useCatalogue';

// Every topic card, from the catalogue. The list keeps one identity until
// the catalogue changes, so memoised grids do not rebuild.
export const useTopicPreviews = () => {
  const catalogue = useCatalogue();
  const previews = useMemo(
    () => toTopicPreviews(catalogue.subjects),
    [catalogue.subjects],
  );

  return { ...catalogue, previews };
};

type Stat = { value: string; label: string };

// Stat lists mark the live topic count with LIVE_TOPIC_COUNT; it is filled
// in once the catalogue arrives
export const useStatsWithTopicCount = (items: readonly Stat[]): Stat[] => {
  const { previews, isLoading } = useTopicPreviews();
  const count = isLoading ? '—' : String(previews.length).padStart(2, '0');

  return items.map(item =>
    item.value === LIVE_TOPIC_COUNT ? { ...item, value: count } : item,
  );
};
