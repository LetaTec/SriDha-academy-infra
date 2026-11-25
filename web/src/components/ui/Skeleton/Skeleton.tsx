import cx from 'classnames/bind';

import styles from './Skeleton.module.css';

const cn = cx.bind(styles);

export type SkeletonShape = 'line' | 'title' | 'price' | 'icon';
export type SkeletonWidth = 'full' | 'lg' | 'md' | 'sm' | 'xs';

export type SkeletonProps = {
  shape?: SkeletonShape;
  width?: SkeletonWidth;
  className?: string;
};

// A grey placeholder block in the shape of content that is still loading.
// Hidden from screen readers: the loading region announces itself once.
export const Skeleton = ({
  shape = 'line',
  width = 'full',
  className,
}: SkeletonProps) => (
  <span
    aria-hidden="true"
    className={cn(
      'skeleton',
      shape,
      // An icon keeps its own square size
      shape === 'icon' ? null : `width-${width}`,
      className,
    )}
  />
);
