import React, { useState } from 'react';
import cx from 'classnames/bind';

import { canManageRefunds, canViewRefunds } from '@/access/team';
import { Button } from '@components/ui/Button/Button';
import { Drawer } from '@components/ui/Drawer/Drawer';
import { EmptyState } from '@components/ui/EmptyState/EmptyState';
import { Heading } from '@components/ui/Heading/Heading';
import { Input } from '@components/ui/Input/Input';
import { KeyValueList } from '@components/ui/KeyValueList/KeyValueList';
import { Section } from '@components/ui/Section/Section';
import { Select } from '@components/ui/Select/Select';
import { Spinner } from '@components/ui/Spinner/Spinner';
import { StatList } from '@components/ui/StatList/StatList';
import { StatusDot } from '@components/ui/StatusDot/StatusDot';
import { Text } from '@components/ui/Text/Text';
import { PAGE_TEXT } from '@constants/pages';
import {
  REFUND_DESK_TEXT as TEXT,
  REFUND_STATUS_COLOR,
  REFUND_STATUS_FILTER,
  REFUND_STATUS_LABEL,
  type RefundStatus,
} from '@constants/refunds';
import { useAuth } from '@context/AuthContext';
import {
  useRefundDetail,
  useRefunds,
  useResolveRefundException,
} from '@hooks/useRefunds';
import { formatPaise } from '@utils/currency';
import { formatDateTime } from '@utils/date';

import styles from './RefundsPage.module.css';

const cn = cx.bind(styles);

const TITLE_ID = 'refund-desk-title';

export const RefundsPage: React.FC = () => {
  const auth = useAuth();
  const canView = canViewRefunds(auth);
  const canManage = canManageRefunds(auth);

  const [statusFilter, setStatusFilter] = useState<string>(
    REFUND_STATUS_FILTER.all,
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRefundId, setSelectedRefundId] = useState<string | null>(null);

  // Resolution form state
  const [resolveAction, setResolveAction] = useState<
    'CONFIRM_PROCESSED' | 'MARK_FAILED'
  >('CONFIRM_PROCESSED');
  const [evidenceReference, setEvidenceReference] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [providerRefundIdInput, setProviderRefundIdInput] =
    useState<string>('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { refunds, summary, isLoading, hasError, reload } = useRefunds(
    canView,
    {
      status: statusFilter,
      search: searchQuery,
    },
  );

  const { detail, isLoading: isDetailLoading } =
    useRefundDetail(selectedRefundId);
  const resolveMutation = useResolveRefundException();

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

  const handleOpenInspect = (id: string) => {
    setSelectedRefundId(id);
    setFormFeedback(null);
    setFormError(null);
    setEvidenceReference('');
    setResolutionNotes('');
    setProviderRefundIdInput('');
    setResolveAction('CONFIRM_PROCESSED');
  };

  const handleCloseInspect = () => {
    setSelectedRefundId(null);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefundId) return;

    if (!evidenceReference.trim()) {
      setFormError('Evidence reference is required for audit verification');
      return;
    }

    if (!resolutionNotes.trim()) {
      setFormError(
        'Resolution notes explaining the verified evidence are required',
      );
      return;
    }

    if (
      resolveAction === 'CONFIRM_PROCESSED' &&
      !providerRefundIdInput.trim() &&
      !detail?.refund.providerRefundId
    ) {
      setFormError(
        'A provider refund ID is required to confirm a refund as processed',
      );
      return;
    }

    setFormError(null);
    try {
      await resolveMutation.mutateAsync({
        refundId: selectedRefundId,
        body: {
          action: resolveAction,
          evidenceReference: evidenceReference.trim(),
          notes: resolutionNotes.trim(),
          providerRefundId: providerRefundIdInput.trim() || undefined,
        },
      });
      setFormFeedback(TEXT.resolveSuccess);
      reload();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to resolve refund exception';
      setFormError(message);
    }
  };

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

      {!isLoading && !hasError && summary ? (
        <>
          <StatList
            className={cn('stats')}
            items={[
              {
                label: TEXT.kpiRequiresReview,
                value: String(summary.requiresReviewCount),
              },
              {
                label: TEXT.kpiRequiresReviewAmount,
                value: formatPaise(summary.requiresReviewPaise),
              },
              {
                label: TEXT.kpiPending,
                value: String(summary.pendingCount),
              },
              {
                label: TEXT.kpiProcessedAmount,
                value: formatPaise(summary.processedPaise),
              },
              {
                label: TEXT.kpiFailed,
                value: String(summary.failedCount),
              },
            ]}
          />

          <div className={cn('toolbar')}>
            <div className={cn('searchBox')}>
              <Input
                label={TEXT.searchLabel}
                placeholder={TEXT.searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={cn('filterBox')}>
              <Select
                label={TEXT.filterStatusLabel}
                options={TEXT.filterStatusOptions}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              />
            </div>
            <div className={cn('quickPill')}>
              <Button
                variant={
                  statusFilter === REFUND_STATUS_FILTER.requiresReview
                    ? 'primary'
                    : 'secondary'
                }
                onClick={() =>
                  setStatusFilter(
                    statusFilter === REFUND_STATUS_FILTER.requiresReview
                      ? REFUND_STATUS_FILTER.all
                      : REFUND_STATUS_FILTER.requiresReview,
                  )
                }
              >
                {statusFilter === REFUND_STATUS_FILTER.requiresReview
                  ? 'Show All'
                  : 'Exceptions Only'}
              </Button>
            </div>
          </div>

          {refunds.length === 0 ? (
            <EmptyState
              title={summary.totalCount === 0 ? TEXT.empty : TEXT.emptyFiltered}
            />
          ) : (
            <div className={cn('tableWrap')}>
              <table className={cn('table')}>
                <caption className={cn('caption')}>{TEXT.tableCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col">{TEXT.columns.date}</th>
                    <th scope="col">{TEXT.columns.refundId}</th>
                    <th scope="col">{TEXT.columns.customer}</th>
                    <th scope="col">{TEXT.columns.amount}</th>
                    <th scope="col">{TEXT.columns.status}</th>
                    <th scope="col">{TEXT.columns.paymentRef}</th>
                    <th scope="col">{TEXT.columns.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map(refund => (
                    <tr
                      key={refund.id}
                      className={cn({
                        highlightRow: refund.status === 'REQUIRES_REVIEW',
                      })}
                    >
                      <td>
                        <Text as="span" variant="small">
                          {formatDateTime(refund.createdAt)}
                        </Text>
                      </td>
                      <td>
                        <Text as="div" variant="small" className={cn('mono')}>
                          {refund.id}
                        </Text>
                        {refund.providerRefundId ? (
                          <Text
                            as="div"
                            variant="caption"
                            tone="muted"
                            className={cn('mono')}
                          >
                            Gateway: {refund.providerRefundId}
                          </Text>
                        ) : null}
                        {refund.reviewReason ? (
                          <div className={cn('exceptionNotice')}>
                            <Text as="div" variant="caption" tone="accent">
                              ⚠ {refund.reviewReason}
                            </Text>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <Text as="div" variant="strong">
                          {refund.customerName ?? 'Customer'}
                        </Text>
                        <Text as="div" variant="small" tone="muted">
                          {refund.customerEmail ?? 'N/A'}
                        </Text>
                      </td>
                      <td>
                        <Text as="span" variant="strong">
                          {formatPaise(refund.amountPaise)}
                        </Text>
                      </td>
                      <td>
                        <StatusDot
                          color={
                            REFUND_STATUS_COLOR[refund.status as RefundStatus]
                          }
                          label={
                            REFUND_STATUS_LABEL[refund.status as RefundStatus]
                          }
                        />
                      </td>
                      <td>
                        <Text as="div" variant="small" className={cn('mono')}>
                          {refund.providerPaymentId ?? refund.paymentId}
                        </Text>
                        <Text as="div" variant="caption" tone="muted">
                          Payment Status: {refund.paymentStatus}
                        </Text>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenInspect(refund.id)}
                        >
                          {TEXT.inspectAction}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {/* Inspection & Resolution Drawer */}
      <Drawer
        open={Boolean(selectedRefundId)}
        onClose={handleCloseInspect}
        eyebrow={TEXT.drawerSubtitle}
        title={TEXT.drawerTitle}
      >
        {isDetailLoading || !detail ? (
          <div className={cn('status')} role="status">
            <Spinner tone="muted" />
            <Text variant="small" tone="muted">
              {PAGE_TEXT.loading}
            </Text>
          </div>
        ) : (
          <div className={cn('drawerContent')}>
            {detail.refund.status === 'REQUIRES_REVIEW' ? (
              <div className={cn('alertBox')}>
                <Heading level={3} variant="item">
                  ⚠ Action Required: Manual Review Exception
                </Heading>
                <Text as="p" variant="small">
                  {detail.refund.reviewReason ??
                    'This refund requires staff verification with provider records before resolution.'}
                </Text>
              </div>
            ) : null}

            {/* Refund Metadata */}
            <div className={cn('sectionBlock')}>
              <Heading level={3} variant="item">
                {TEXT.sectionRefund}
              </Heading>
              <KeyValueList
                columns={2}
                items={[
                  {
                    label: 'Refund ID',
                    value: (
                      <span className={cn('mono')}>{detail.refund.id}</span>
                    ),
                  },
                  {
                    label: 'Amount',
                    value: formatPaise(detail.refund.amountPaise),
                  },
                  {
                    label: 'Status',
                    value: (
                      <StatusDot
                        color={
                          REFUND_STATUS_COLOR[
                            detail.refund.status as RefundStatus
                          ]
                        }
                        label={
                          REFUND_STATUS_LABEL[
                            detail.refund.status as RefundStatus
                          ]
                        }
                      />
                    ),
                  },
                  { label: 'Source', value: detail.refund.source },
                  {
                    label: 'Provider Refund ID',
                    value: detail.refund.providerRefundId ? (
                      <span className={cn('mono')}>
                        {detail.refund.providerRefundId}
                      </span>
                    ) : (
                      'None'
                    ),
                  },
                  {
                    label: 'Requested Date',
                    value: formatDateTime(detail.refund.createdAt),
                  },
                ]}
              />
            </div>

            {/* Payment Details */}
            {detail.payment ? (
              <div className={cn('sectionBlock')}>
                <Heading level={3} variant="item">
                  {TEXT.sectionPayment}
                </Heading>
                <KeyValueList
                  columns={2}
                  items={[
                    {
                      label: 'Payment ID',
                      value: (
                        <span className={cn('mono')}>{detail.payment.id}</span>
                      ),
                    },
                    { label: 'Payment Status', value: detail.payment.status },
                    {
                      label: 'Paid Amount',
                      value: formatPaise(detail.payment.amountPaise),
                    },
                    {
                      label: 'Razorpay Payment ID',
                      value: detail.payment.providerPaymentId ? (
                        <span className={cn('mono')}>
                          {detail.payment.providerPaymentId}
                        </span>
                      ) : (
                        'N/A'
                      ),
                    },
                    {
                      label: 'Customer Email',
                      value: detail.payment.customerEmail ?? 'N/A',
                    },
                    {
                      label: 'Customer Name',
                      value: detail.payment.customerName ?? 'N/A',
                    },
                  ]}
                />
              </div>
            ) : null}

            {/* Resolution Form (for REQUIRES_REVIEW only) */}
            {detail.refund.status === 'REQUIRES_REVIEW' && canManage ? (
              <div className={cn('sectionBlock')}>
                <Heading level={3} variant="item">
                  {TEXT.resolveButton}
                </Heading>
                <form onSubmit={handleResolveSubmit} className={cn('formBox')}>
                  {formFeedback ? (
                    <div className={cn('feedbackMessage')}>
                      <Text as="p" variant="small">
                        ✓ {formFeedback}
                      </Text>
                    </div>
                  ) : null}
                  {formError ? (
                    <div className={cn('errorMessage')}>
                      <Text as="p" variant="small">
                        {formError}
                      </Text>
                    </div>
                  ) : null}

                  <Select
                    label={TEXT.resolveActionLabel}
                    value={resolveAction}
                    onChange={e =>
                      setResolveAction(
                        e.target.value as 'CONFIRM_PROCESSED' | 'MARK_FAILED',
                      )
                    }
                    options={[
                      {
                        value: 'CONFIRM_PROCESSED',
                        label:
                          'Confirm Processed (Verified in Razorpay Dashboard)',
                      },
                      {
                        value: 'MARK_FAILED',
                        label:
                          'Mark as Failed (Verified Void / Customer Retained Funds)',
                      },
                    ]}
                  />

                  {resolveAction === 'CONFIRM_PROCESSED' ? (
                    <Input
                      label={TEXT.resolveProviderRefundIdLabel}
                      placeholder={TEXT.resolveProviderRefundIdPlaceholder}
                      value={providerRefundIdInput}
                      onChange={e => setProviderRefundIdInput(e.target.value)}
                    />
                  ) : null}

                  <Input
                    label={TEXT.resolveEvidenceLabel}
                    placeholder={TEXT.resolveEvidencePlaceholder}
                    value={evidenceReference}
                    onChange={e => setEvidenceReference(e.target.value)}
                  />

                  <Input
                    label={TEXT.resolveNotesLabel}
                    placeholder={TEXT.resolveNotesPlaceholder}
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                  />

                  <div className={cn('formActions')}>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={resolveMutation.isPending}
                    >
                      {resolveAction === 'CONFIRM_PROCESSED'
                        ? TEXT.resolveSubmitConfirm
                        : TEXT.resolveSubmitFail}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCloseInspect}
                    >
                      {TEXT.resolveCancel}
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}

            {/* Audit Trail */}
            <div className={cn('sectionBlock')}>
              <Heading level={3} variant="item">
                {TEXT.sectionAudit}
              </Heading>
              {detail.auditEntries.length === 0 ? (
                <Text as="p" tone="muted" variant="small">
                  No audit log entries recorded for this entity yet
                </Text>
              ) : (
                <div className={cn('auditList')}>
                  {detail.auditEntries.map(entry => (
                    <div key={entry.id} className={cn('auditItem')}>
                      <div className={cn('auditMeta')}>
                        <Text as="span" variant="strong">
                          {entry.action}
                        </Text>
                        <Text as="span" variant="caption" tone="muted">
                          {formatDateTime(entry.occurredAt)}
                        </Text>
                      </div>
                      <Text as="div" variant="caption" tone="muted">
                        Actor: {entry.actorRole ?? 'SYSTEM'} (
                        {entry.actorUserId ?? 'internal'})
                      </Text>
                      {entry.details &&
                      Object.keys(entry.details).length > 0 ? (
                        <pre className={cn('mono')}>
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </Section>
  );
};

export default RefundsPage;
