import { useState } from 'react';
import cx from 'classnames/bind';

import { canViewTeamOrders } from '@/access/team';
import { Button } from '@components/ui/Button/Button';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { Heading } from '@components/ui/Heading/Heading';
import { Section } from '@components/ui/Section/Section';
import { Select } from '@components/ui/Select/Select';
import { Spinner } from '@components/ui/Spinner/Spinner';
import { StatList } from '@components/ui/StatList/StatList';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import { PAGE_TEXT } from '@constants/pages';
import { PAYMENT_PROVIDER, PAYMENT_STATUS } from '@constants/payments';
import {
  CHECKOUT_KIND_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  TEAM_ORDERS_TEXT as TEXT,
} from '@constants/team';
import { useAuth } from '@context/AuthContext';
import { useTeamOrders } from '@hooks/useTeamOrders';
import { formatPaise } from '@utils/currency';
import { formatDateTime } from '@utils/date';

import styles from './TeamOrdersPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'team-orders-title';

// Every order with its student, topic, amount and payment status, for the
// team. The API refuses anyone who is not a super admin.
const TeamOrdersPage = () => {
  const auth = useAuth();
  const canView = canViewTeamOrders(auth);
  const { orders, isLoading, hasError, reload } = useTeamOrders(canView);
  const [statusFilter, setStatusFilter] = useState('');

  if (!canView) {
    return (
      <Section labelledBy={TITLE_ID} className={cn('page')}>
        <EmptyState
          title={TEXT.forbiddenTitle}
          message={TEXT.forbiddenMessage}
        />
      </Section>
    );
  }

  const paid = orders.filter(order => order.status === PAYMENT_STATUS.paid);
  const shown = statusFilter
    ? orders.filter(order => order.status === statusFilter)
    : orders;

  return (
    <Section labelledBy={TITLE_ID} className={cn('page')}>
      <div className={cn('head')}>
        <Text as="div" variant="eyebrow">
          {TEXT.eyebrow}
        </Text>
        <Heading level={1} variant="display" id={TITLE_ID}>
          {TEXT.title} <em>{TEXT.titleEmphasis}</em>
        </Heading>
        <Text as="p" tone="muted">
          {TEXT.note}
        </Text>
      </div>

      {isLoading ? (
        <div className={cn('status')} role="status">
          <Spinner tone="muted" />
          <Text variant="small" tone="muted">
            {PAGE_TEXT.loading}
          </Text>
        </div>
      ) : null}

      {hasError ? (
        <EmptyState
          title={TEXT.loadError}
          action={
            <Button variant="secondary" onClick={reload}>
              {TEXT.retry}
            </Button>
          }
        />
      ) : null}

      {!isLoading && !hasError ? (
        <>
          <StatList
            className={cn('stats')}
            items={[
              { label: TEXT.paidCount, value: String(paid.length) },
              {
                label: TEXT.collected,
                value: formatPaise(
                  paid.reduce((sum, order) => sum + order.amountPaise, 0),
                ),
              },
              {
                label: TEXT.unpaidCount,
                value: String(orders.length - paid.length),
              },
            ]}
          />

          <div className={cn('filter')}>
            <Select
              label={TEXT.filterLabel}
              options={TEXT.filterOptions}
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
            />
          </div>

          {shown.length === 0 ? (
            <EmptyState
              title={orders.length === 0 ? TEXT.empty : TEXT.emptyFiltered}
            />
          ) : (
            // Wide tables scroll inside their own box on small screens
            <div className={cn('tableWrap')}>
              <table className={cn('table')}>
                <caption className={cn('caption')}>{TEXT.tableCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col">{TEXT.columns.date}</th>
                    <th scope="col">{TEXT.columns.student}</th>
                    <th scope="col">{TEXT.columns.topic}</th>
                    <th scope="col">{TEXT.columns.amount}</th>
                    <th scope="col">{TEXT.columns.status}</th>
                    <th scope="col">{TEXT.columns.reference}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(order => (
                    <tr key={order.id}>
                      <td>
                        <Text as="span" variant="small">
                          {formatDateTime(order.createdAt)}
                        </Text>
                      </td>
                      <td>
                        <Text as="div" variant="strong">
                          {order.student.name}
                        </Text>
                        <Text as="div" variant="small" tone="muted">
                          {order.student.email}
                        </Text>
                        <Text as="div" variant="small" tone="muted">
                          {order.student.mobile}
                        </Text>
                      </td>
                      <td>
                        <Text as="div" variant="small">
                          {order.topic}
                        </Text>
                        <Text as="div" variant="caption" tone="muted">
                          {order.batch ?? CHECKOUT_KIND_LABEL[order.kind]}
                        </Text>
                      </td>
                      <td>
                        <Text as="span" variant="strong">
                          {formatPaise(order.amountPaise)}
                        </Text>
                      </td>
                      <td>
                        <StatusDot
                          color={PAYMENT_STATUS_COLOR[order.status]}
                          label={PAYMENT_STATUS_LABEL[order.status]}
                        />
                      </td>
                      <td>
                        <Text
                          as="div"
                          variant="small"
                          className={cn('reference')}
                        >
                          {order.providerPaymentId ?? order.providerOrderId}
                        </Text>
                        {order.provider === PAYMENT_PROVIDER.test ? (
                          <Text as="div" variant="caption" tone="muted">
                            {TEXT.testMode}
                          </Text>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </Section>
  );
};

export default TeamOrdersPage;
