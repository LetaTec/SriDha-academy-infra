import cx from 'classnames/bind';

import { Button } from '@components/ui/Button/Button';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { TopicCardSkeletons } from '@components/catalogue/TopicCardSkeletons/TopicCardSkeletons';
import { Spinner } from '@components/ui/Spinner/Spinner';
import { Text } from '@components/ui/Text/Text';
import { CATALOGUE_TEXT } from '@constants/catalogue';

import styles from './TopicsStatus.module.css';

const cn = cx.bind(styles);

export type TopicsStatusProps = {
  hasError: boolean;
  onRetry: () => void;
  // While loading, show placeholder topic cards (a list of topics), or
  // just a spinner (a page about one topic)
  skeleton?: 'cards' | 'spinner';
  // How many placeholder cards, e.g. as many as the list will show
  count?: number;
};

// Stands in for a list of topics while the catalogue loads, or when it
// could not be loaded
export const TopicsStatus = ({
  hasError,
  onRetry,
  skeleton = 'cards',
  count,
}: TopicsStatusProps) =>
  hasError ? (
    <EmptyState
      title={CATALOGUE_TEXT.loadError}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {CATALOGUE_TEXT.retry}
        </Button>
      }
    />
  ) : skeleton === 'cards' ? (
    <TopicCardSkeletons count={count} />
  ) : (
    <div className={cn('loading')} role="status">
      <Spinner tone="muted" />
      <Text as="span" variant="small" tone="muted">
        {CATALOGUE_TEXT.topicsLoading}
      </Text>
    </div>
  );
