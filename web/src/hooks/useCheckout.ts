import { useSearchParams } from 'react-router-dom';

import { CATALOGUE_QUERY_PARAM } from '@constants/catalogue';

// The payment panel's topic lives in the URL (?checkout=<topic id>), so it
// survives signing up and keeps the rest of the page's query, such as the
// Topics page filters. A batch chosen elsewhere (?checkoutBatch=) is
// preselected. Opening checkout closes any topic dialog, which it replaces.
export const useCheckout = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const openCheckout = (topicId: string, batchId: string | null = null) =>
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete(CATALOGUE_QUERY_PARAM.topic);
      next.delete(CATALOGUE_QUERY_PARAM.batch);
      next.set(CATALOGUE_QUERY_PARAM.checkout, topicId);
      if (batchId) next.set(CATALOGUE_QUERY_PARAM.checkoutBatch, batchId);
      else next.delete(CATALOGUE_QUERY_PARAM.checkoutBatch);
      return next;
    });

  const closeCheckout = () =>
    setSearchParams(
      current => {
        const next = new URLSearchParams(current);
        next.delete(CATALOGUE_QUERY_PARAM.checkout);
        next.delete(CATALOGUE_QUERY_PARAM.checkoutBatch);
        return next;
      },
      { replace: true },
    );

  return {
    checkoutTopicId: searchParams.get(CATALOGUE_QUERY_PARAM.checkout),
    checkoutBatchId: searchParams.get(CATALOGUE_QUERY_PARAM.checkoutBatch),
    openCheckout,
    closeCheckout,
  };
};
