import { useQuery } from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';
import { listTeamOrders, type TeamOrder } from '@services/admin';

const NO_ORDERS: TeamOrder[] = [];

// Every order, for the team. Nothing is requested for anyone the page
// would turn away; the API refuses them anyway.
export const useTeamOrders = (canView: boolean) => {
  const query = useQuery({
    queryKey: QUERY_KEY.teamOrders,
    queryFn: listTeamOrders,
    enabled: canView,
  });

  return {
    orders: query.data ?? NO_ORDERS,
    isLoading: canView && query.isPending,
    hasError: query.isError,
    reload: () => {
      void query.refetch();
    },
  };
};
