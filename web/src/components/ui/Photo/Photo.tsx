import cx from 'classnames/bind';

import styles from './Photo.module.css';

const cn = cx.bind(styles);

export type PhotoProps = {
  src: string;
  alt: string;
  credit?: string;
  ratio?: 'landscape' | 'portrait';
  // offset adds the brand's flat accent block behind the photo
  frame?: 'plain' | 'offset';
  // inverse for photos on the dark green sections
  tone?: 'default' | 'inverse';
  // eager for photos in the first screen
  loading?: 'lazy' | 'eager';
  className?: string;
};

// Editorial photograph: lazy-loaded and gently toned to the paper palette.
// Static by design — photos never move.
export const Photo = ({
  src,
  alt,
  credit,
  ratio = 'landscape',
  frame = 'plain',
  tone = 'default',
  loading = 'lazy',
  className,
}: PhotoProps) => (
  <figure className={cn('photo', ratio, frame, tone, className)}>
    <div className={cn('frame')}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={cn('image')}
      />
    </div>
    {credit ? <figcaption className={cn('credit')}>{credit}</figcaption> : null}
  </figure>
);
