import type {
  RefundDetailResponse,
  RefundsListResponse,
  ResolveRefundExceptionRequestBody,
  ResolveRefundExceptionResponse,
} from '@contracts/finance';
import { API_CLIENT } from '@services/http/api';

export const listRefunds = async (params?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RefundsListResponse> => {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'ALL') {
    query.set('status', params.status);
  }
  if (params?.search) {
    query.set('search', params.search);
  }
  if (params?.limit) {
    query.set('limit', String(params.limit));
  }
  if (params?.offset) {
    query.set('offset', String(params.offset));
  }
  const queryString = query.toString();
  const url = queryString
    ? `/finance/refunds?${queryString}`
    : '/finance/refunds';
  const response = await API_CLIENT.get<RefundsListResponse>(url);
  return response.data;
};

export const getRefundDetail = async (
  refundId: string,
): Promise<RefundDetailResponse> => {
  const response = await API_CLIENT.get<RefundDetailResponse>(
    `/finance/refunds/${refundId}`,
  );
  return response.data;
};

export const resolveRefundException = async (
  refundId: string,
  body: ResolveRefundExceptionRequestBody,
): Promise<ResolveRefundExceptionResponse> => {
  const response = await API_CLIENT.post<ResolveRefundExceptionResponse>(
    `/finance/refund-exceptions/${refundId}/resolve`,
    body,
  );
  return response.data;
};
