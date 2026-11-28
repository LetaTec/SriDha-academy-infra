import { useQuery } from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';
import { listTodayTeamLogins, type TeamTodayLogin } from '@services/admin';

const NO_LOGINS: TeamTodayLogin[] = [];

export const useTodayTeamLogins = () => {
  const query = useQuery({
    queryKey: QUERY_KEY.todayTeamLogins,
    queryFn: listTodayTeamLogins,
  });

  return {
    logins: query.data ?? NO_LOGINS,
    isLoading: query.isPending,
    hasError: query.isError,
    reload: () => {
      void query.refetch();
    },
  };
};
