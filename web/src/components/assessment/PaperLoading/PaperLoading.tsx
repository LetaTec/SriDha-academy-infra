import cx from 'classnames/bind';

import { Spinner } from '@components/ui/Spinner/Spinner';
import { Text } from '@components/ui/Text/Text';
import { SAMPLE_TEST_TEXT } from '@constants/assessment';

import styles from './PaperLoading.module.css';

const cn = cx.bind(styles);

// Stands in for a paper's questions while they download
export const PaperLoading = () => (
  <div className={cn('loading')} role="status">
    <Spinner tone="muted" />
    <Text as="span" variant="small" tone="muted">
      {SAMPLE_TEST_TEXT.loading}
    </Text>
  </div>
);
