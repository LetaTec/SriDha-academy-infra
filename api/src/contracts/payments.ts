// Checkout, payment verification, enrolments and pre-registrations. See
// catalogue.ts for what this folder is.

import type { Batch, Lesson, Price } from './catalogue.js';

// A seat in a batch (an enrolment) or a pre-registration for a topic
// shares these statuses
export type SeatStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';

export type CheckoutKind = 'ENROLMENT' | 'PRE_REGISTRATION';

export type PaymentStatus = 'CREATED' | 'PAID';

export type PaymentProvider = 'RAZORPAY' | 'TEST';

export type BillingDetails = {
  fullName: string;
  email: string;
  mobile: string;
};

// The amount is never sent: the API prices the batch or topic itself
export type CreateCheckoutRequest = BillingDetails &
  (
    | { kind: 'ENROLMENT'; batchId: string }
    | { kind: 'PRE_REGISTRATION'; topicId: string }
  );

export type Checkout = {
  paymentId: string;
  status: PaymentStatus;
  kind: CheckoutKind;
  amount: Price;
  topic: { id: string; title: string; level: string | null };
  batch: { id: string; name: string; scheduleLabel: string } | null;
  provider: {
    name: PaymentProvider;
    orderId: string;
    // Present for Razorpay: the public key that opens its checkout
    keyId: string | null;
  };
};

export type CheckoutResponse = { checkout: Checkout };

export type VerifyPaymentRequest = {
  paymentId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
};

export type PaymentResult = {
  paymentId: string;
  status: PaymentStatus;
};

export type PaymentResultResponse = { payment: PaymentResult };

// A seat the student has started or paid for, with its batch and topic
export type Enrolment = {
  id: string;
  status: SeatStatus;
  createdAt: string;
  subject: { id: string; slug: string; name: string };
  topic: {
    id: string;
    title: string;
    shortTitle: string;
    summary: string;
    level: string | null;
    icon: string | null;
    featuredRank: number | null;
    price: Price | null;
    lessons: Lesson[];
  };
  batch: Batch;
};

export type EnrolmentsResponse = { enrolments: Enrolment[] };

// A topic the student has pre-registered for, paid or still pending
export type PreRegistration = {
  id: string;
  status: SeatStatus;
  createdAt: string;
  topic: {
    id: string;
    title: string;
    level: string | null;
    price: Price | null;
  };
};

export type PreRegistrationsResponse = { preRegistrations: PreRegistration[] };
