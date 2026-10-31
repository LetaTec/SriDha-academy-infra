import type {
  CheckoutKind,
  PaymentProvider,
  PaymentStatus,
} from '@contracts/payments';

import type { EnrolmentStatus } from './catalogue';

export const CHECKOUT_KIND = {
  enrolment: 'ENROLMENT',
  preRegistration: 'PRE_REGISTRATION',
} as const satisfies Record<string, CheckoutKind>;

export type { CheckoutKind };

export const PAYMENT_PROVIDER = {
  razorpay: 'RAZORPAY',
  test: 'TEST',
} as const satisfies Record<string, PaymentProvider>;

export type { PaymentProvider };

export const PAYMENT_STATUS = {
  created: 'CREATED',
  paid: 'PAID',
} as const satisfies Record<string, PaymentStatus>;

export type { PaymentStatus };

export const RAZORPAY = {
  scriptUrl: 'https://checkout.razorpay.com/v1/checkout.js',
  merchantName: 'SriDha Academy',
  // Matches --color-bg-inverse; Razorpay's checkout takes a hex colour
  themeColor: '#203c39',
} as const;

export const PRE_REGISTRATION_STATUS_LABEL: Record<EnrolmentStatus, string> = {
  PENDING_PAYMENT: 'Payment pending',
  CONFIRMED: 'Pre-registered',
  CANCELLED: 'Cancelled',
};

// The action on each topic card and the payment panel it opens
export const CHECKOUT_TEXT = {
  enrolAction: 'Enrol now',
  preRegisterAction: 'Pre-register now',
  // The panel's title until the topic has loaded
  topicPending: 'Your topic',
  loadingTopic: 'Loading this topic',
  loadFailedTopic:
    'We could not load this topic. Check your connection and try again',
  retry: 'Try again',
  actionLabel: (action: string, topic: string, level: string) =>
    `${action}: ${topic}, ${level}`,
  enrolEyebrow: 'Enrol',
  preRegisterEyebrow: 'Pre-register',
  eyebrow: (action: string, level: string) => `${action} · ${level}`,
  close: 'Close payment',
  batchLegend: 'Choose your batch',
  batchFull: 'Full',
  noOpenBatches: 'Every batch for this topic is full right now',
  preRegisterNote:
    'Batches for this topic open soon. Pre-register now to keep a seat in the first batch',
  teachTitle: 'What we will teach',
  summaryTitle: 'Order summary',
  summaryTopic: 'Topic',
  summaryBatch: 'Batch',
  summaryFirstBatch: 'First batch when it opens',
  summaryTotal: 'Total',
  detailsTitle: 'Your details',
  fullNameLabel: 'Full name',
  emailLabel: 'Email ID',
  mobileLabel: 'Mobile number',
  fullNameInvalid: 'Enter your full name',
  emailInvalid: 'Enter a valid email ID',
  mobileInvalid: 'Enter a valid mobile number',
  pay: (amount: string) => `Pay ${amount}`,
  secureNote:
    'Card, UPI and netbanking details are entered with Razorpay. SriDha Academy never sees them',
  paidTitle: 'Payment received',
  paidEnrolment: (batch: string) => `Your seat in the ${batch} is confirmed`,
  paidPreRegistration:
    'Your pre-registration is confirmed. We will email you when the first batch opens',
  pendingTitle: 'Seat saved',
  pendingMessage:
    'Online payment opens soon. Your seat is held and our team will contact you to complete the payment',
  goToLearning: 'Go to My learning',
  done: 'Done',
  verifyFailed:
    'We could not confirm this payment. If money was taken, please contact us and we will sort it out',
  loadFailed: 'The payment window could not open. Please try again',
  paymentFailed: (reason: string) =>
    `Payment did not go through: ${reason}. You have not been charged; please try again`,
} as const;
