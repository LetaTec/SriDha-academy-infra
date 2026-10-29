import type {
  CHECKOUT_KIND,
  CheckoutKind,
  PaymentProvider,
  PaymentStatus,
} from '@constants/payments';
import type { EnrolmentStatus } from '@constants/catalogue';
import type { Price } from '@services/catalogue';

export type BillingDetails = {
  fullName: string;
  email: string;
  mobile: string;
};

// The amount is never sent: the API prices the batch or topic itself.
export type CreateCheckoutRequest = BillingDetails &
  (
    | { kind: typeof CHECKOUT_KIND.enrolment; batchId: string }
    | { kind: typeof CHECKOUT_KIND.preRegistration; topicId: string }
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
    keyId: string | null;
  };
};

export type VerifyPaymentRequest = {
  paymentId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
};

// A topic the student has pre-registered for, paid or still pending
export type PreRegistration = {
  id: string;
  status: EnrolmentStatus;
  createdAt: string;
  topic: {
    id: string;
    title: string;
    level: string | null;
    price: Price | null;
  };
};

export type PaymentResult = {
  paymentId: string;
  status: PaymentStatus;
};
