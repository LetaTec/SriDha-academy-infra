import type { CheckoutKind, PaymentStatus } from './payments';
import type { StatusColor } from './status';

// The team's orders and payments page, for super admins

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  CREATED: 'Not paid',
  PAID: 'Paid',
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, StatusColor> = {
  CREATED: 'neutral',
  PAID: 'positive',
};

export const CHECKOUT_KIND_LABEL: Record<CheckoutKind, string> = {
  ENROLMENT: 'Batch',
  PRE_REGISTRATION: 'Pre-registration',
};

// Filter values for the status dropdown; empty shows every order
export const TEAM_ORDER_FILTER = {
  all: '',
  paid: 'PAID',
  unpaid: 'CREATED',
} as const;

export const TEAM_ORDERS_TEXT = {
  eyebrow: 'Team / Orders',
  title: 'Orders and',
  titleEmphasis: 'payments.',
  note: 'Every checkout, newest first. Unpaid orders are students who opened payment and left',
  paidCount: 'Paid orders',
  collected: 'Collected',
  unpaidCount: 'Not paid',
  filterLabel: 'Show',
  filterOptions: [
    { value: TEAM_ORDER_FILTER.all, label: 'All orders' },
    { value: TEAM_ORDER_FILTER.paid, label: 'Paid' },
    { value: TEAM_ORDER_FILTER.unpaid, label: 'Not paid' },
  ],
  tableCaption: 'Orders, newest first',
  columns: {
    date: 'Date',
    student: 'Student',
    topic: 'Topic',
    amount: 'Amount',
    status: 'Status',
    reference: 'Razorpay reference',
  },
  testMode: 'Test mode',
  empty: 'No orders yet',
  emptyFiltered: 'No orders match this filter',
  loadError: 'Orders could not be loaded',
  retry: 'Try again',
  forbiddenTitle: 'This page is for the SriDha Academy team',
  forbiddenMessage: 'Sign in with a team account to see orders and payments',
} as const;
