import cx from 'classnames/bind';

import { Button } from '@components/ui/Button/Button';
import { ButtonBase } from '@components/ui/ButtonBase/ButtonBase';
import { Icon } from '@components/ui/Icon/Icon';
import { Text } from '@components/ui/Text/Text';
import { PAGE_TEXT } from '@constants/pages';

import {
  listActiveFilters,
  type TopicFilterKey,
} from '../../topicFilterOptions';
import type { TopicFilters } from '../../topicFilters';
import styles from './ActiveFilters.module.css';

const cn = cx.bind(styles);

export type ActiveFiltersProps = {
  filters: TopicFilters;
  onOpen: () => void;
  onRemove: (key: TopicFilterKey) => void;
};

// The "Filters" button, with one removable chip per applied filter
export const ActiveFilters = ({
  filters,
  onOpen,
  onRemove,
}: ActiveFiltersProps) => {
  const active = listActiveFilters(filters);

  return (
    <div className={cn('bar')}>
      <Button
        variant="secondary"
        onClick={onOpen}
        aria-haspopup="dialog"
        className={cn('open')}
      >
        <Icon name="filter" size="sm" />
        {PAGE_TEXT.topicsFiltersButton}
        {active.length > 0 ? (
          <Text as="span" variant="caption" className={cn('count')}>
            {active.length}
          </Text>
        ) : null}
      </Button>
      {active.map(filter => (
        <ButtonBase
          key={filter.key}
          className={cn('chip')}
          aria-label={PAGE_TEXT.topicsRemoveFilter(filter.label)}
          onClick={() => onRemove(filter.key)}
        >
          <Text as="span" variant="small">
            {filter.label}
          </Text>
          <Icon name="close" size="sm" />
        </ButtonBase>
      ))}
    </div>
  );
};
