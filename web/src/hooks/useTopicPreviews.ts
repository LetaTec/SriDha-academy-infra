import { useMemo } from 'react';

import { LIVE_TOPIC_COUNT } from '@constants/topics';
import { hasBatches, toTopicPreviews } from '@services/catalogue';

import { useCatalogue } from './useCatalogue';

// The classes students can join: every topic with batches (the team's
// roster), as cards. allPreviews also has the topics that only have a topic
// test, for the Topic Test Paper pages. The lists keep one identity until
// the catalogue changes, so memoised grids do not rebuild.
export const useTopicPreviews = () => {
  const catalogue = useCatalogue();
  const allPreviews = useMemo(
    () => toTopicPreviews(catalogue.subjects),
    [catalogue.subjects],
  );
  const previews = useMemo(() => allPreviews.filter(hasBatches), [allPreviews]);

  return { ...catalogue, previews, allPreviews };
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
