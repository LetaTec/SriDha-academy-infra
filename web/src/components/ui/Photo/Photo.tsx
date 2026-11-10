import cx from 'classnames/bind';

import styles from './Photo.module.css';

const cn = cx.bind(styles);

export type PhotoProps = {
  src: string;
  alt: string;
  credit?: string;
  ratio?: 'landscape' | 'portrait';
  className?: string;
};

// Editorial photograph: lazy-loaded and gently toned to the paper palette.
// Static by design — photos never move.
export const Photo = ({
  src,
  alt,
  credit,
  ratio = 'landscape',
  className,
}: PhotoProps) => (
  <figure className={cn('photo', ratio, className)}>
    <div className={cn('frame')}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn('image')}
      />
    </div>
    {credit ? <figcaption className={cn('credit')}>{credit}</figcaption> : null}
  </figure>
);
