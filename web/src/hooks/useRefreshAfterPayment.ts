import { useQueryClient } from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';

// A payment changes seat counts, the student's batches and their
// pre-registrations; everything showing them refetches
export const useRefreshAfterPayment = () => {
  const queryClient = useQueryClient();

  return () => {
    for (const queryKey of [
      QUERY_KEY.catalogue,
      QUERY_KEY.enrolments,
      QUERY_KEY.preRegistrations,
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
};
