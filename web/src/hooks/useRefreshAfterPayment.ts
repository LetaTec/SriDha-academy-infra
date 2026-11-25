import { useQueryClient } from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';

// A payment changes seat counts and the student's batches; everything
// showing them refetches
export const useRefreshAfterPayment = () => {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY.catalogue });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY.myBatches });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY.testAttempts });
  };
};
