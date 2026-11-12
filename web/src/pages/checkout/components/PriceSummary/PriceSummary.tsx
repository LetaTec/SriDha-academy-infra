import type React from 'react';
import cx from 'classnames/bind';

import { Heading } from '@components/ui/Heading/Heading';
import { Icon } from '@components/ui/Icon/Icon';
import { Text } from '@components/ui/Text/Text';
import { CHECKOUT_TEXT } from '@constants/payments';

import styles from './PriceSummary.module.css';

const cn = cx.bind(styles);

export type PriceSummaryProps = {
  // The formatted fee; null when the topic has no fee yet
  amount: string | null;
  // For example "incl. GST", as the catalogue states it
  taxLabel: string | null;
  // The agreement and pay button, or a prompt to sign in
  action: React.ReactNode;
};

// The order total, beside the details on wide screens and after them on
// phones, with the one Pay button.
export const PriceSummary = ({
  amount,
  taxLabel,
  action,
}: PriceSummaryProps) => (
  <div className={cn('summary')}>
    <section className={cn('card')} aria-labelledby="price-summary-title">
      <Heading level={2} variant="item" id="price-summary-title">
        {CHECKOUT_TEXT.summaryTitle}
      </Heading>
      <dl className={cn('rows')}>
        <div className={cn('row')}>
          <dt>
            <Text variant="small">{CHECKOUT_TEXT.summaryFee}</Text>
            {taxLabel ? (
              <Text as="span" variant="caption" tone="muted">
                {taxLabel}
              </Text>
            ) : null}
          </dt>
          <dd>
            <Text variant="small">
              {amount ?? CHECKOUT_TEXT.priceOnRequest}
            </Text>
          </dd>
        </div>
        <div className={cn('row', 'total')}>
          <dt>
            <Text variant="strong">{CHECKOUT_TEXT.summaryTotal}</Text>
          </dt>
          <dd>
            <Text variant="strong" className={cn('totalAmount')}>
              {amount ?? '—'}
            </Text>
          </dd>
        </div>
      </dl>
      <div className={cn('action')}>{action}</div>
    </section>

    <section className={cn('card', 'secure')}>
      <span className={cn('secureIcon')} aria-hidden="true">
        <Icon name="secure" size="md" />
      </span>
      <div>
        <Text as="p" variant="strong">
          {CHECKOUT_TEXT.secureTitle}
        </Text>
        <Text as="p" variant="small" tone="muted">
          {CHECKOUT_TEXT.secureNote}
        </Text>
      </div>
    </section>
  </div>
);
