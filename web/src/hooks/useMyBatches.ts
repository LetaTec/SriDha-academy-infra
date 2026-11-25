import { useQuery } from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';
import { listMyBatches, type Enrolment } from '@services/payments';

const NO_BATCHES: Enrolment[] = [];

// The signed-in student's batches, soonest first as the API lists them.
// Nothing is requested for anyone who is not signed in as a student.
export const useMyBatches = (canView: boolean) => {
  const query = useQuery({
    queryKey: QUERY_KEY.myBatches,
    queryFn: listMyBatches,
    enabled: canView,
  });

  return {
    batches: query.data ?? NO_BATCHES,
    isLoading: canView && query.isPending,
    hasError: query.isError,
    reload: () => {
      void query.refetch();
    },
  };
};
