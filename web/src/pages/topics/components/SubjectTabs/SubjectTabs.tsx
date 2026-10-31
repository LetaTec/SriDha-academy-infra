import cx from 'classnames/bind';

import { ButtonBase } from '@components/ui/ButtonBase/ButtonBase';
import { Icon } from '@components/ui/Icon/Icon';
import { Text } from '@components/ui/Text/Text';
import { PAGE_TEXT } from '@constants/pages';
import {
  SUBJECT,
  SUBJECT_ICON,
  SUBJECT_LABEL,
  type SubjectKey,
} from '@constants/topics';

import styles from './SubjectTabs.module.css';

const cn = cx.bind(styles);

export type SubjectTabsProps = {
  selected: SubjectKey | null;
  // Topics per subject under the other filters, shown on each tab
  counts: Record<SubjectKey, number>;
  total: number;
  // null shows every subject, each in its own section
  onSelect: (subject: SubjectKey | null) => void;
};

// One tab per subject, so a student looks at one subject's topics at a time.
export const SubjectTabs = ({
  selected,
  counts,
  total,
  onSelect,
}: SubjectTabsProps) => (
  <div
    className={cn('tabs')}
    role="group"
    aria-label={PAGE_TEXT.topicsSubjectTabs}
  >
    <ButtonBase
      className={cn('tab', { tabSelected: selected === null })}
      aria-pressed={selected === null}
      onClick={() => onSelect(null)}
    >
      <Text as="span" variant="small">
        {PAGE_TEXT.topicsAllSubjects}
      </Text>
      <Text as="span" variant="caption" className={cn('count')}>
        {total}
      </Text>
    </ButtonBase>
    {Object.values(SUBJECT).map(subject => (
      <ButtonBase
        key={subject}
        className={cn('tab', { tabSelected: selected === subject })}
        aria-pressed={selected === subject}
        disabled={counts[subject] === 0 && selected !== subject}
        onClick={() => onSelect(subject)}
      >
        <Icon name={SUBJECT_ICON[subject]} size="sm" />
        <Text as="span" variant="small">
          {SUBJECT_LABEL[subject]}
        </Text>
        <Text as="span" variant="caption" className={cn('count')}>
          {counts[subject]}
        </Text>
      </ButtonBase>
    ))}
  </div>
);
