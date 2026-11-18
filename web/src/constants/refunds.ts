import type { StatusColor } from './status';

export type RefundStatus =
  'PENDING' | 'REQUIRES_REVIEW' | 'PROCESSED' | 'FAILED';

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING: 'Pending Gateway',
  REQUIRES_REVIEW: 'Requires Review',
  PROCESSED: 'Processed',
  FAILED: 'Failed',
};

export const REFUND_STATUS_COLOR: Record<RefundStatus, StatusColor> = {
  PENDING: 'warning',
  REQUIRES_REVIEW: 'negative',
  PROCESSED: 'positive',
  FAILED: 'neutral',
};

export const REFUND_STATUS_FILTER = {
  all: 'ALL',
  requiresReview: 'REQUIRES_REVIEW',
  pending: 'PENDING',
  processed: 'PROCESSED',
  failed: 'FAILED',
} as const;

export const REFUND_DESK_TEXT = {
  eyebrow: 'Finance / Exceptions',
  title: 'Refund management',
  titleEmphasis: 'desk.',
  note: 'Operational finance queue for tracking refunds, verifying gateway records, and resolving review exceptions',
  kpiTotal: 'Total refunds',
  kpiRequiresReview: 'Requires review',
  kpiRequiresReviewAmount: 'Under review',
  kpiPending: 'Pending',
  kpiProcessed: 'Processed',
  kpiProcessedAmount: 'Total refunded',
  kpiFailed: 'Failed',
  searchLabel: 'Search',
  searchPlaceholder: 'Search by refund ID, payment ID, receipt or email...',
  filterStatusLabel: 'Status',
  filterStatusOptions: [
    { value: REFUND_STATUS_FILTER.all, label: 'All statuses' },
    {
      value: REFUND_STATUS_FILTER.requiresReview,
      label: 'Requires review (Exceptions)',
    },
    { value: REFUND_STATUS_FILTER.pending, label: 'Pending gateway' },
    { value: REFUND_STATUS_FILTER.processed, label: 'Processed' },
    { value: REFUND_STATUS_FILTER.failed, label: 'Failed' },
  ],
  tableCaption: 'Refunds list',
  columns: {
    date: 'Date',
    refundId: 'Refund ID / Receipt',
    customer: 'Customer',
    amount: 'Amount',
    status: 'Status',
    paymentRef: 'Payment Reference',
    actions: 'Action',
  },
  inspectAction: 'Inspect',
  drawerTitle: 'Refund details & resolution',
  drawerSubtitle: 'Verified provider inspection and manual resolution desk',
  sectionRefund: 'Refund summary',
  sectionPayment: 'Associated payment',
  sectionAudit: 'Audit trail',
  sectionMismatches: 'Gateway mismatches',
  resolveButton: 'Resolve Exception',
  resolveActionLabel: 'Resolution action',
  resolveEvidenceLabel: 'Provider evidence reference',
  resolveEvidencePlaceholder:
    'e.g. Razorpay ARN / Gateway settlement reference / Support ticket #',
  resolveNotesLabel: 'Resolution rationale & notes',
  resolveNotesPlaceholder:
    'Explain the verified evidence and reason for manual resolution...',
  resolveProviderRefundIdLabel: 'Provider refund ID (if available)',
  resolveProviderRefundIdPlaceholder: 'rfnd_...',
  resolveSubmitConfirm: 'Confirm Processed',
  resolveSubmitFail: 'Mark as Failed',
  resolveCancel: 'Cancel',
  resolveSuccess: 'Exception successfully resolved and recorded in audit log',
  empty: 'No refunds recorded yet',
  emptyFiltered: 'No refunds match this filter or search query',
  loadError: 'Failed to load refunds from finance API',
  retry: 'Retry',
  forbiddenTitle: 'Access Restricted',
  forbiddenMessage:
    'Sign in with an authorised SriDha Academy finance account to access this desk',
} as const;
