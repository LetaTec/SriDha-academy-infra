import type { EnrolmentStatus } from '@constants/catalogue';
import type {
  CheckoutKind,
  PaymentProvider,
  PaymentStatus,
} from '@constants/payments';

// One order as the team sees it: who, what for, how much and whether paid
export type TeamOrder = {
  id: string;
  createdAt: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  amountPaise: number;
  providerOrderId: string;
  providerPaymentId: string | null;
  kind: CheckoutKind;
  topic: string;
  batch: string | null;
  seatStatus: EnrolmentStatus;
  student: {
    accountEmail: string;
    name: string;
    email: string;
    mobile: string;
  };
};
