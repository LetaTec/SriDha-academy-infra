// The team's views. See catalogue.ts for what this folder is.

import type {
  CheckoutKind,
  PaymentProvider,
  PaymentStatus,
  SeatStatus,
} from './payments.js';

// One order as the team sees it: who, what for, how much and whether paid.
// Billing details are what the student typed at checkout.
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
  seatStatus: SeatStatus;
  student: {
    accountEmail: string;
    name: string;
    email: string;
    mobile: string;
  };
};

export type TeamOrdersResponse = { orders: TeamOrder[] };
