import { useNavigate } from 'react-router-dom';
import cx from 'classnames/bind';

import { TopicPreviewGrid } from '@components/catalogue/TopicPreviewGrid/TopicPreviewGrid';
import { TopicsStatus } from '@components/catalogue/TopicsStatus/TopicsStatus';
import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import { AUTH_QUERY_PARAM } from '@constants/auth';
import { CATALOGUE_QUERY_PARAM } from '@constants/catalogue';
import { LANDING_TEXT } from '@constants/landing';
import { SIGN_IN_TOPIC_COUNT } from '@constants/topics';
import { APP_ROUTES } from '@constants/routes';
import { useTopicPreviews } from '@hooks/useTopicPreviews';

import styles from './OngoingTopics.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'ongoing-topics-title';

// The topics running now, beside the sign-in form. Enrolling or
// pre-registering asks the visitor to register first, then opens that
// topic's payment panel.
export const OngoingTopics = () => {
  const navigate = useNavigate();
  const { previews, isLoading, hasError, reload } = useTopicPreviews();

  const handleChooseTopic = (topicId: string) => {
    const destination = `${APP_ROUTES.TOPICS}?${new URLSearchParams({
      [CATALOGUE_QUERY_PARAM.checkout]: topicId,
    })}`;
    navigate(
      `${APP_ROUTES.REGISTER}?${new URLSearchParams({
        [AUTH_QUERY_PARAM.redirectTo]: destination,
      })}`,
    );
  };

  return (
    <section className={cn('panel')} aria-labelledby={TITLE_ID}>
      <Text as="div" variant="eyebrow" tone="accent">
        {LANDING_TEXT.ongoingEyebrow}
      </Text>
      <Heading level={2} variant="item" id={TITLE_ID} className={cn('title')}>
        {LANDING_TEXT.ongoingTitle}
      </Heading>
      {isLoading || hasError ? (
        <TopicsStatus hasError={hasError} onRetry={reload} />
      ) : (
        <TopicPreviewGrid
          previews={previews}
          onChooseTopic={handleChooseTopic}
          showSearch={false}
          columns={2}
          limit={SIGN_IN_TOPIC_COUNT}
        />
      )}
    </section>
  );
};
