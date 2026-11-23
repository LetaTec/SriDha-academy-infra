import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { QUERY_KEY } from '@/app/queryClient';
import type { ResolveRefundExceptionRequestBody } from '@contracts/finance';
import {
  getRefundDetail,
  listRefunds,
  resolveRefundException,
} from '@services/finance/refunds';

export const useRefunds = (
  canView: boolean,
  params?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
) => {
  const query = useQuery({
    queryKey: [
      ...QUERY_KEY.refunds,
      params?.status ?? 'ALL',
      params?.search ?? '',
      params?.offset ?? 0,
    ],
    queryFn: () => listRefunds(params),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data,
    refunds: query.data?.refunds ?? [],
    summary: query.data?.summary,
    total: query.data?.total ?? 0,
    isLoading: canView && query.isPending,
    hasError: query.isError,
    reload: () => {
      void query.refetch();
    },
  };
};

export const useRefundDetail = (refundId: string | null) => {
  const query = useQuery({
    queryKey: [...QUERY_KEY.refunds, 'detail', refundId],
    queryFn: () => (refundId ? getRefundDetail(refundId) : null),
    enabled: Boolean(refundId),
  });

  return {
    detail: query.data,
    isLoading: Boolean(refundId) && query.isPending,
    hasError: query.isError,
    reload: () => {
      void query.refetch();
    },
  };
};

export const useResolveRefundException = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      refundId,
      body,
    }: {
      refundId: string;
      body: ResolveRefundExceptionRequestBody;
    }) => resolveRefundException(refundId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.refunds });
    },
  });
};
