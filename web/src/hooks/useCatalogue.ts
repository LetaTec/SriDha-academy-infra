import { useQuery } from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';
import { getCatalogue, type Subject } from '@services/catalogue';

export type CatalogueState = {
  subjects: Subject[];
  isLoading: boolean;
  hasError: boolean;
  reload: () => void;
};

// One shared value until the catalogue arrives, so memoised lists built
// from it do not rebuild on every render
const NO_SUBJECTS: Subject[] = [];

// One request serves every component on the page (header search, topic
// cards, payment panel), so they always agree on prices and batches. A
// failed load retries, and the catalogue refreshes when the student comes
// back to the tab.
export const useCatalogue = (): CatalogueState => {
  const query = useQuery({
    queryKey: QUERY_KEY.catalogue,
    queryFn: getCatalogue,
  });

  return {
    subjects: query.data ?? NO_SUBJECTS,
    isLoading: query.isPending,
    // A refresh that fails keeps showing the catalogue it already has
    hasError: query.isError && query.data === undefined,
    reload: () => {
      void query.refetch();
    },
  };
};
