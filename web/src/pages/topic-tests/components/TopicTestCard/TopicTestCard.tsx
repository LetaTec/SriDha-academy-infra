import { Link } from 'react-router-dom';
import cx from 'classnames/bind';

import { Card } from '@components/ui/Card/Card';
import { Icon } from '@components/ui/Icon/Icon';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import { TOPIC_TESTS_PAGE_TEXT as TEXT } from '@constants/assessment';
import { toTopicTest } from '@constants/routes';
import { formatPrice } from '@utils/currency';
import type { TopicPreview } from '@services/catalogue';

import styles from './TopicTestCard.module.css';

const cn = cx.bind(styles);

export type TopicTestCardProps = {
  preview: TopicPreview;
  // How many questions the topic's test has; null while it is being written
  questionCount: number | null;
};

// A topic on the Topic Test Paper page. Topics with a test are one link to
// it; the rest say their test is coming.
export const TopicTestCard = ({
  preview,
  questionCount,
}: TopicTestCardProps) => {
  const card = (
    <Card
      variant="centered"
      className={cn('card')}
      media={<Icon name={preview.icon} size="xl" strokeWidth={1.25} />}
      title={preview.title}
      description={preview.level}
    />
  );

  if (questionCount === null) {
    return (
      <div className={cn('topic', 'soon')}>
        {card}
        <span className={cn('offer')}>
          <StatusDot color="neutral" label={TEXT.soonStatus} />
        </span>
      </div>
    );
  }

  return (
    <Link
      to={toTopicTest(preview.catalogueTopicId)}
      className={cn('topic', 'ready')}
      aria-label={TEXT.actionLabel(preview.title, preview.level)}
    >
      {card}
      <span className={cn('offer')}>
        <StatusDot
          color="positive"
          label={TEXT.readyStatus(
            questionCount,
            preview.topic.testPrice
              ? formatPrice(preview.topic.testPrice)
              : null,
          )}
        />
        <span className={cn('action')}>
          <Text as="span" variant="strong">
            {TEXT.takeAction}
          </Text>
          <Icon name="arrowRight" size="sm" />
        </span>
      </span>
    </Link>
  );
};
