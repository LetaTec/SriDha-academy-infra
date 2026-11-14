import cx from 'classnames/bind';

import { Monogram } from '@components/ui/Monogram/Monogram';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import type { Tutor } from '@services/catalogue';

import styles from './TutorPortrait.module.css';

const cn = cx.bind(styles);

export type TutorPortraitProps = {
  tutor: Tutor;
  className?: string;
};

// The tutor's photograph, or their initial until one is added
export const TutorPortrait = ({ tutor, className }: TutorPortraitProps) =>
  tutor.photoUrl ? (
    <img
      src={tutor.photoUrl}
      alt={CATALOGUE_TEXT.tutorPhotoAlt(tutor.name)}
      className={cn('photo', className)}
      loading="lazy"
    />
  ) : (
    <div className={cn('placeholder', className)}>
      <Monogram initial={tutor.name.replace(/^Dr\.?\s+/, '').charAt(0)} />
    </div>
  );
