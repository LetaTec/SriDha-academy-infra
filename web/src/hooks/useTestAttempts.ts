import { useQuery } from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';
import { listTestAttempts, type TestAttempt } from '@services/payments';

const NO_ATTEMPTS: TestAttempt[] = [];

// Paid, and not started yet or still running
export const isAttemptAvailable = (attempt: TestAttempt, now = Date.now()) =>
  attempt.endsAt === null || Date.parse(attempt.endsAt) > now;

// The signed-in student's paid attempts at one topic's test. Nothing is
// requested for a visitor; a payment refreshes the list.
export const useTestAttempts = (topicId: string, canView: boolean) => {
  const query = useQuery({
    queryKey: [...QUERY_KEY.testAttempts, topicId],
    queryFn: () => listTestAttempts(topicId),
    enabled: canView,
  });
  const attempts = query.data ?? NO_ATTEMPTS;

  return {
    attempts,
    // The attempt to take next: one already running, else an unused one
    available:
      attempts.find(
        attempt => attempt.startedAt !== null && isAttemptAvailable(attempt),
      ) ??
      attempts.find(attempt => attempt.startedAt === null) ??
      null,
    isLoading: canView && query.isPending,
    hasError: query.isError,
    reload: () => {
      void query.refetch();
    },
  };
};
