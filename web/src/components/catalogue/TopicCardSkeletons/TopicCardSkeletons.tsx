import cx from 'classnames/bind';

import { CardGrid } from '@components/ui/CardGrid/CardGrid';
import { Skeleton } from '@components/ui/Skeleton/Skeleton';
import { CATALOGUE_TEXT } from '@constants/catalogue';

import styles from './TopicCardSkeletons.module.css';

const cn = cx.bind(styles);

export type TopicCardSkeletonsProps = {
  // How many placeholder cards to show
  count?: number;
  columns?: 2 | 4;
};

// Placeholder topic cards in the shape of the real ones (icon, name,
// class, fee, start date, batches and action) while the catalogue loads,
// so the page does not jump when the topics arrive
export const TopicCardSkeletons = ({
  count = 8,
  columns = 4,
}: TopicCardSkeletonsProps) => (
  <div role="status" className={cn('skeletons')}>
    <span className={cn('visuallyHidden')}>{CATALOGUE_TEXT.topicsLoading}</span>
    <CardGrid variant="boxed" columns={columns}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn('card')} aria-hidden="true">
          <div className={cn('preview')}>
            <Skeleton shape="icon" />
            <Skeleton shape="title" width="lg" />
            <Skeleton width="xs" />
          </div>
          <div className={cn('offer')}>
            <Skeleton shape="price" width="xs" />
            <Skeleton width="sm" />
            <Skeleton width="md" />
            <Skeleton width="sm" className={cn('action')} />
          </div>
        </div>
      ))}
    </CardGrid>
  </div>
);
