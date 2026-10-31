import { useEffect, useState } from 'react';

import { CheckoutPanel } from '@components/payments/CheckoutPanel/CheckoutPanel';
import { TOPIC_PREVIEWS } from '@constants/topics';
import { useCatalogue } from '@hooks/useCatalogue';
import { useCheckout } from '@hooks/useCheckout';
import { listTopics } from '@services/catalogue';

type CheckoutSession = { topicId: string; count: number };

// The payment panel for the topic named in ?checkout=, on any signed-in
// page. Keeping it in the URL means it survives signing up from the
// sign-in page and opens straight after. The panel stays mounted after the
// parameter goes, so it can slide out instead of vanishing.
export const SiteCheckout = () => {
  const { checkoutTopicId, checkoutBatchId, closeCheckout } = useCheckout();
  const { subjects, isLoading, reload } = useCatalogue();
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

  const preview = TOPIC_PREVIEWS.find(
    item => item.catalogueTopicId === session.topicId,
  );
  if (!preview) return null;

  const topic =
    listTopics(subjects).find(context => context.topic.id === session.topicId)
      ?.topic ?? null;

  return (
    <CheckoutPanel
      key={`${session.topicId}-${session.count}`}
      open={checkoutTopicId === session.topicId}
      preview={preview}
      topic={topic}
      preferredBatchId={checkoutBatchId}
      isLoading={isLoading}
      onRetry={reload}
      onClose={closeCheckout}
    />
  );
};
