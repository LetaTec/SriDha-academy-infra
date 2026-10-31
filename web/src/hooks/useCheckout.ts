import { useSearchParams } from 'react-router-dom';

import { CATALOGUE_QUERY_PARAM } from '@constants/catalogue';

// The payment panel's topic lives in the URL (?checkout=<topic id>), so it
// survives signing up and keeps the rest of the page's query, such as the
// Topics page filters.
export const useCheckout = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const setCheckout = (topicId: string | null) =>
    setSearchParams(
      current => {
        const next = new URLSearchParams(current);
        if (topicId) next.set(CATALOGUE_QUERY_PARAM.checkout, topicId);
        else next.delete(CATALOGUE_QUERY_PARAM.checkout);
        return next;
      },
      { replace: topicId === null },
    );

  return {
    checkoutTopicId: searchParams.get(CATALOGUE_QUERY_PARAM.checkout),
    openCheckout: (topicId: string) => setCheckout(topicId),
    closeCheckout: () => setCheckout(null),
  };
};
