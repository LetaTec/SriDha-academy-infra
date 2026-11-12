import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { CHECKOUT_QUERY_PARAM } from '@constants/payments';
import { APP_ROUTES } from '@constants/routes';

// The checkout page for a topic, with a batch chosen elsewhere preselected
export const toCheckoutPath = (topicId: string, batchId: string | null) => {
  const params = new URLSearchParams({ [CHECKOUT_QUERY_PARAM.topic]: topicId });
  if (batchId) params.set(CHECKOUT_QUERY_PARAM.batch, batchId);
  return `${APP_ROUTES.CHECKOUT}?${params}`;
};

// Opens the checkout page. Its topic and batch live in the URL, so the page
// survives signing in and reloading, and Back returns to where the student
// chose the topic.
export const useCheckout = () => {
  const navigate = useNavigate();
  // The router's navigate changes with every URL; going through the latest
  // one keeps openCheckout the same function, so the memoised topic cards
  // do not re-render
  const latestNavigate = useRef(navigate);
  latestNavigate.current = navigate;

  const openCheckout = useCallback(
    (topicId: string, batchId: string | null = null) =>
      latestNavigate.current(toCheckoutPath(topicId, batchId)),
    [],
  );

  return { openCheckout };
};
