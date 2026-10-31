import { useEffect, useState } from 'react';

import { CheckoutPanel } from '@components/payments/CheckoutPanel/CheckoutPanel';
import { useCheckout } from '@hooks/useCheckout';
import { useTopicPreviews } from '@hooks/useTopicPreviews';

type CheckoutSession = { topicId: string; count: number };

// The payment panel for the topic named in ?checkout=, on any signed-in
// page. Keeping it in the URL means it survives signing up from the
// sign-in page and opens straight after. The panel stays mounted after the
// parameter goes, so it can slide out instead of vanishing.
export const SiteCheckout = () => {
  const { checkoutTopicId, checkoutBatchId, closeCheckout } = useCheckout();
  const { previews, isLoading, hasError, reload } = useTopicPreviews();
  // Each opening starts a fresh panel, even for the same topic
  const [session, setSession] = useState<CheckoutSession | null>(null);

  useEffect(() => {
    if (!checkoutTopicId) return;
    setSession(current => ({
      topicId: checkoutTopicId,
      count: (current?.count ?? 0) + 1,
    }));
  }, [checkoutTopicId]);

  if (!session) return null;

  // Until the catalogue arrives the panel opens with a loading state; a
  // topic that is not in the catalogue opens nothing
  const preview =
    previews.find(item => item.catalogueTopicId === session.topicId) ?? null;
  if (!preview && !isLoading && !hasError) return null;

  return (
    <CheckoutPanel
      key={`${session.topicId}-${session.count}`}
      open={checkoutTopicId === session.topicId}
      preview={preview}
      preferredBatchId={checkoutBatchId}
      isLoading={isLoading}
      onRetry={reload}
      onClose={closeCheckout}
    />
  );
};
