// Checkout, payment verification, enrolments and pre-registrations. See
// catalogue.ts for what this folder is.

import type { Batch, Lesson, Price } from './catalogue.js';

// A seat in a batch (an enrolment) or a pre-registration for a topic
// shares these statuses
export type SeatStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';

export type CheckoutKind = 'ENROLMENT' | 'PRE_REGISTRATION';

// CREATED: order made, nothing paid. AUTHORIZED: the provider signed the
// payment but has not reported it captured yet. PAID: captured (only a
// capture reported by the provider gets here). FAILED and EXPIRED: no money
// was taken for this order.
export type PaymentStatus =
  'CREATED' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'EXPIRED';

export type PaymentProvider = 'RAZORPAY' | 'TEST';

// The 28 states and 8 union territories of India, as written on a tax
// invoice
export type IndianState =
  | 'Andhra Pradesh'
  | 'Arunachal Pradesh'
  | 'Assam'
  | 'Bihar'
  | 'Chhattisgarh'
  | 'Goa'
  | 'Gujarat'
  | 'Haryana'
  | 'Himachal Pradesh'
  | 'Jharkhand'
  | 'Karnataka'
  | 'Kerala'
  | 'Madhya Pradesh'
  | 'Maharashtra'
  | 'Manipur'
  | 'Meghalaya'
  | 'Mizoram'
  | 'Nagaland'
  | 'Odisha'
  | 'Punjab'
  | 'Rajasthan'
  | 'Sikkim'
  | 'Tamil Nadu'
  | 'Telangana'
  | 'Tripura'
  | 'Uttar Pradesh'
  | 'Uttarakhand'
  | 'West Bengal'
  | 'Andaman and Nicobar Islands'
  | 'Chandigarh'
  | 'Dadra and Nagar Haveli and Daman and Diu'
  | 'Delhi'
  | 'Jammu and Kashmir'
  | 'Ladakh'
  | 'Lakshadweep'
  | 'Puducherry';

// INDIVIDUAL: a person (B2C). BUSINESS: a registered business (B2B), which
// also gives its legal name and GSTIN for its tax invoice.
export type CustomerType = 'INDIVIDUAL' | 'BUSINESS';

export type BillingDetails = {
  customerType: CustomerType;
  // The person paying (for a business, its contact person)
  fullName: string;
  email: string;
  mobile: string;
  // The billing address printed on the tax invoice
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: IndianState;
  // A 6-digit Indian PIN code
  pinCode: string;
  // BUSINESS only
  businessLegalName?: string;
  gstin?: string;
  purchaseOrderReference?: string;
};

// The amount is never sent: the API prices the batch (ENROLMENT, with
// batchId) or the topic (PRE_REGISTRATION, with topicId) itself
export type CreateCheckoutRequest = BillingDetails & {
  kind: CheckoutKind;
  batchId?: string;
  topicId?: string;
};

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
  // Whether the seat (or pre-registration) is confirmed. A payment can be
  // PAID with the seat unconfirmed: it arrived after the batch filled, and
  // the team follows up (a payment exception)
  seatConfirmed: boolean;
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
