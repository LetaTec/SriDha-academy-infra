import cx from 'classnames/bind';

import { Heading } from '@components/ui/Heading/Heading';
import { Text } from '@components/ui/Text/Text';
import { CATALOGUE_TEXT } from '@constants/catalogue';
import type { Tutor } from '@services/catalogue';

import { TutorPortrait } from '../TutorPortrait/TutorPortrait';
import styles from './TutorProfile.module.css';

const cn = cx.bind(styles);

export type TutorProfileProps = {
  tutor: Tutor;
  className?: string;
};

// Who teaches the topic: the photograph on the left, the name and
// credentials beside it
export const TutorProfile = ({ tutor, className }: TutorProfileProps) => (
  <section
    className={cn('profile', className)}
    aria-label={CATALOGUE_TEXT.tutorLabel(tutor.name)}
  >
    <TutorPortrait tutor={tutor} className={cn('portrait')} />
    <div className={cn('text')}>
      <Text as="div" variant="eyebrow">
        {CATALOGUE_TEXT.tutorEyebrow}
      </Text>
      <Heading level={3} variant="item">
        {tutor.name}
      </Heading>
      <Text as="p" variant="small" tone="muted">
        {tutor.headline}
      </Text>
      {tutor.credentials.length > 0 ? (
        <ul className={cn('credentials')}>
          {tutor.credentials.map(credential => (
            <li key={credential}>
              <Text as="span" variant="small">
                {credential}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  </section>
);
