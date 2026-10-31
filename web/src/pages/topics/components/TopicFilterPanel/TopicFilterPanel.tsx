import { useId } from 'react';
import cx from 'classnames/bind';

import { Button } from '@components/ui/Button/Button';
import { Drawer } from '@components/ui/Drawer/Drawer';
import { Text } from '@components/ui/Text/Text';
import { PAGE_TEXT } from '@constants/pages';

import {
  readFilterValue,
  TOPIC_FILTER_GROUPS,
  type TopicFilterKey,
} from '../../topicFilterOptions';
import type { TopicFilters } from '../../topicFilters';
import styles from './TopicFilterPanel.module.css';

const cn = cx.bind(styles);

export type TopicFilterPanelProps = {
  open: boolean;
  onClose: () => void;
  filters: TopicFilters;
  // An empty value clears that filter
  onChange: (key: TopicFilterKey, value: string) => void;
  onClear: () => void;
  canClear: boolean;
  // Topics that match, shown on the close button
  resultCount: number;
};

// Class, stream and availability filters in a side panel, so the topics
// keep the whole page. Choices apply at once; the button shows the result.
export const TopicFilterPanel = ({
  open,
  onClose,
  filters,
  onChange,
  onClear,
  canClear,
  resultCount,
}: TopicFilterPanelProps) => {
  const nameId = useId();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow={PAGE_TEXT.topicsFilterTitle}
      title={PAGE_TEXT.topicsFilterPanelTitle}
      closeLabel={PAGE_TEXT.topicsFilterPanelClose}
      footer={
        <div className={cn('footer')}>
          <Button variant="plain" onClick={onClear} disabled={!canClear}>
            {PAGE_TEXT.topicsClearFilters}
          </Button>
          <Button onClick={onClose}>
            {PAGE_TEXT.topicsShowResults(resultCount)}
          </Button>
        </div>
      }
    >
      <div className={cn('groups')}>
        {TOPIC_FILTER_GROUPS.map(group => {
          const selected = readFilterValue(filters, group.key);

          return (
            <fieldset key={group.key} className={cn('group')}>
              <legend className={cn('legend')}>
                <Text as="span" variant="label">
                  {group.legend}
                </Text>
              </legend>
              <div className={cn('choices')}>
                {[{ value: '', label: group.anyLabel }, ...group.options].map(
                  option => (
                    <label
                      key={option.value || 'any'}
                      className={cn('choice', {
                        choiceSelected: option.value === selected,
                      })}
                    >
                      <input
                        type="radio"
                        className={cn('input')}
                        name={`${nameId}-${group.key}`}
                        value={option.value}
                        checked={option.value === selected}
                        onChange={() => onChange(group.key, option.value)}
                      />
                      <Text as="span" variant="small">
                        {option.label}
                      </Text>
                    </label>
                  ),
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
    </Drawer>
  );
};
