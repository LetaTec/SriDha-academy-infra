import { useQuery } from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';
import { listEnrolments, type Enrolment } from '@services/enrolments';
import { listPreRegistrations, type PreRegistration } from '@services/payments';

const NO_ENROLMENTS: Enrolment[] = [];
const NO_PRE_REGISTRATIONS: PreRegistration[] = [];

// The signed-in student's batches and pre-registrations. A payment made in
// the panel refreshes both (see useRefreshAfterPayment).
export const useMyLearning = () => {
  const enrolments = useQuery({
    queryKey: QUERY_KEY.enrolments,
    queryFn: listEnrolments,
  });
  const preRegistrations = useQuery({
    queryKey: QUERY_KEY.preRegistrations,
    queryFn: listPreRegistrations,
  });

  return {
    enrolments: enrolments.data ?? NO_ENROLMENTS,
    preRegistrations: preRegistrations.data ?? NO_PRE_REGISTRATIONS,
    isLoading: enrolments.isPending || preRegistrations.isPending,
    hasError: enrolments.isError || preRegistrations.isError,
    reload: () => {
      void enrolments.refetch();
      void preRegistrations.refetch();
    },
  };
};
