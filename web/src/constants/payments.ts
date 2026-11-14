import type {
  CheckoutKind,
  IndianState,
  PaymentProvider,
  PaymentStatus,
} from '@contracts/payments';

import type { EnrolmentStatus } from './catalogue';
import { SUPPORT_EMAIL } from './policies';

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

// Where the student lives, for the payment's tax invoice: every state and
// union territory once, the type makes a missing or misspelt one an error
const INDIAN_STATE_SET = {
  'Andhra Pradesh': true,
  'Arunachal Pradesh': true,
  Assam: true,
  Bihar: true,
  Chhattisgarh: true,
  Goa: true,
  Gujarat: true,
  Haryana: true,
  'Himachal Pradesh': true,
  Jharkhand: true,
  Karnataka: true,
  Kerala: true,
  'Madhya Pradesh': true,
  Maharashtra: true,
  Manipur: true,
  Meghalaya: true,
  Mizoram: true,
  Nagaland: true,
  Odisha: true,
  Punjab: true,
  Rajasthan: true,
  Sikkim: true,
  'Tamil Nadu': true,
  Telangana: true,
  Tripura: true,
  'Uttar Pradesh': true,
  Uttarakhand: true,
  'West Bengal': true,
  'Andaman and Nicobar Islands': true,
  Chandigarh: true,
  'Dadra and Nagar Haveli and Daman and Diu': true,
  Delhi: true,
  'Jammu and Kashmir': true,
  Ladakh: true,
  Lakshadweep: true,
  Puducherry: true,
} as const satisfies Record<IndianState, true>;

export const INDIAN_STATES = Object.keys(INDIAN_STATE_SET) as [
  IndianState,
  ...IndianState[],
];

// Alphabetical, as a student looks for theirs
export const INDIAN_STATE_OPTIONS = [...INDIAN_STATES]
  .sort((a, b) => a.localeCompare(b))
  .map(state => ({ value: state, label: state }));

export type { IndianState };

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

// The checkout page (/checkout?topic=&batch=). The topic and batch live in
// the URL, so the page survives signing in and can be shared or reloaded.
export const CHECKOUT_QUERY_PARAM = {
  topic: 'topic',
  batch: 'batch',
} as const;

// The action on each topic card and the checkout page it opens
export const CHECKOUT_TEXT = {
  enrolAction: 'Enrol now',
  preRegisterAction: 'Pre-register now',
  loadingTopic: 'Loading this topic',
  loadFailedTopic:
    'We could not load this topic. Check your connection and try again',
  retry: 'Try again',
  actionLabel: (action: string, topic: string, level: string) =>
    `${action}: ${topic}, ${level}`,
  enrolEyebrow: 'Enrol',
  preRegisterEyebrow: 'Pre-register',
  // Page head
  back: 'Back',
  pageEyebrow: 'Checkout',
  pageTitle: 'Review your',
  pageTitleEmphasis: 'seat.',
  // A topic id in the URL that the catalogue does not have
  notFoundTitle: 'This topic is not available',
  notFoundMessage:
    'It may have been renamed or closed. Every open topic is on the Topics page',
  browseTopics: 'Browse topics',
  // Topic card
  liveBatchBadge: 'Live batch',
  preRegisterBadge: 'Pre-registration',
  startsLabel: 'Starts',
  timeLabel: 'Time',
  sessionsLabel: 'Sessions',
  seatsLabel: 'Seats left',
  firstBatchLabel: 'Batch',
  firstBatchValue: 'First batch when it opens',
  // Batch choice
  batchLegend: 'Choose your batch',
  batchFull: 'Full',
  noOpenBatches: 'Every batch for this topic is full right now',
  preRegisterNote:
    'Batches for this topic open soon. Pre-register now to keep a seat in the first batch',
  teachTitle: 'What we will teach',
  // Shown under what the topic teaches; there is no refund policy yet
  paymentNote: `Please check the topic and batch before you pay. For any question about a payment, write to ${SUPPORT_EMAIL}`,
  // Student details
  detailsTitle: 'Student details',
  detailsNote: 'Your payment receipt is sent to this email ID',
  fullNameLabel: 'Full name',
  emailLabel: 'Email ID',
  mobileLabel: 'Mobile number',
  stateLabel: 'State',
  statePlaceholder: 'Select your state',
  cityLabel: 'City',
  cityPlaceholder: 'Your city or town',
  fullNameInvalid: 'Enter your full name',
  emailInvalid: 'Enter a valid email ID',
  mobileInvalid: 'Enter a valid mobile number',
  stateRequired: 'Select your state',
  cityRequired: 'Enter your city',
  // Price summary
  summaryTitle: 'Price summary',
  summaryFee: 'Topic fee',
  summaryTotal: 'Total amount to be paid',
  priceOnRequest: 'Fee on request',
  agreePrefix: 'I agree to the',
  agreeTerms: 'terms and conditions',
  agreeRequired: 'Tick the box to agree before paying',
  pay: (amount: string) => `Pay ${amount}`,
  secureTitle: 'Secure payment',
  secureNote:
    'Card, UPI and netbanking details are entered with Razorpay. SriDha Academy never sees them',
  // After paying
  paidTitle: 'Payment received',
  paidEnrolment: (batch: string) => `Your seat in the ${batch} is confirmed`,
  paidPreRegistration:
    'Your pre-registration is confirmed. We will email you when the first batch opens',
  pendingTitle: 'Seat saved',
  pendingMessage:
    'Online payment opens soon. Your seat is held and our team will contact you to complete the payment',
  emailedTo: (email: string) =>
    `We have emailed the details to ${email}. Keep that email; it is your receipt`,
  verifyFailed:
    'We could not confirm this payment. If money was taken, please contact us and we will sort it out',
  loadFailed: 'The payment window could not open. Please try again',
  paymentFailed: (reason: string) =>
    `Payment did not go through: ${reason}. You have not been charged; please try again`,
} as const;
