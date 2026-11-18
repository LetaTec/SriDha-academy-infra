import { createHmac } from 'node:crypto';

import {
  createRazorpayGateway,
  type PaymentGateway,
  type ProviderPayment,
  type ProviderRefund,
  type RefundRequest,
  type RefundRequestResult,
} from '../modules/payments/gateway.js';

export const FAKE_RAZORPAY_KEY_ID = 'rzp_test_key';
export const FAKE_RAZORPAY_KEY_SECRET = 'rzp_test_secret';

// Razorpay's real signature check, with orders made locally and no network
// calls. Payments are captured automatically, as Razorpay does by default
// for Orders API payments: once a payment's signature has checked out,
// looking it up reports it captured for its order's amount. Refunds are
// accepted and reported pending, as Razorpay does before processing them.
export const createFakeRazorpay = (): PaymentGateway => {
  const real = createRazorpayGateway(
    FAKE_RAZORPAY_KEY_ID,
    FAKE_RAZORPAY_KEY_SECRET,
  );
  const orderAmounts = new Map<string, number>();
  const signedOrders = new Map<string, string>();
  const refunds = new Map<string, ProviderRefund>();
  let orderNumber = 0;
  let refundNumber = 0;

  const captured = (paymentId: string): ProviderPayment | null => {
    const orderId = signedOrders.get(paymentId);
    const amountPaise = orderId ? orderAmounts.get(orderId) : undefined;
    if (!orderId || amountPaise === undefined) return null;
    return {
      id: paymentId,
      orderId,
      status: 'captured',
      amountPaise,
      currency: 'INR',
    };
  };

  return {
    ...real,
    createOrder: async ({ amountPaise }) => {
      orderNumber += 1;
      const orderId = `order_${orderNumber}`;
      orderAmounts.set(orderId, amountPaise);
      return { orderId };
    },
    verifySignature: payment => {
      const valid = real.verifySignature(payment);
      if (valid) signedOrders.set(payment.paymentId, payment.orderId);
      return valid;
    },
    fetchPayment: async paymentId => captured(paymentId),
    fetchOrderPayments: async orderId =>
      [...signedOrders.entries()]
        .filter(([, order]) => order === orderId)
        .map(([paymentId]) => captured(paymentId))
        .filter((payment): payment is ProviderPayment => payment !== null),
    createRefund: async ({ providerPaymentId, amountPaise, receipt }) => {
      refundNumber += 1;
      const refund: ProviderRefund = {
        id: `rfnd_${refundNumber}`,
        status: 'pending',
        amountPaise,
        currency: 'INR',
        paymentId: providerPaymentId,
        receipt,
      };
      refunds.set(refund.id, refund);
      return {
        outcome: 'created',
        refund,
      };
    },
    fetchRefund: async refundId => refunds.get(refundId) ?? null,
    fetchPaymentRefunds: async paymentId =>
      [...refunds.values()].filter(
        r => r.paymentId === paymentId,
      ),
  };
};

// A Razorpay whose answers each test sets: what a payment lookup returns,
// which payments an order has (or that Razorpay cannot be reached), and how
// a refund request is answered. Every refund request is recorded.
export const createScriptedRazorpay = () => {
  const real = createRazorpayGateway(
    FAKE_RAZORPAY_KEY_ID,
    FAKE_RAZORPAY_KEY_SECRET,
  );
  let orderNumber = 0;
  const payments = new Map<string, ProviderPayment>();
  const orderPayments = new Map<string, ProviderPayment[] | 'unreachable'>();
  const refundRequests: RefundRequest[] = [];
  const refunds = new Map<string, ProviderRefund>();
  const paymentRefunds = new Map<string, ProviderRefund[] | 'unreachable'>();
  const state: {
    refundResult: (request: RefundRequest) => RefundRequestResult;
  } = {
    refundResult: request => ({
      outcome: 'created',
      refund: {
        id: `rfnd_${refundRequests.length}`,
        status: 'pending',
        amountPaise: request.amountPaise,
        currency: 'INR',
        paymentId: request.providerPaymentId,
        receipt: request.receipt,
      },
    }),
  };

  const gateway: PaymentGateway = {
    ...real,
    createOrder: async () => ({ orderId: `order_${(orderNumber += 1)}` }),
    fetchPayment: async paymentId => payments.get(paymentId) ?? null,
    fetchOrderPayments: async orderId => {
      const answer = orderPayments.get(orderId);
      if (answer === 'unreachable') return null;
      return answer ?? [];
    },
    createRefund: async request => {
      refundRequests.push(request);
      const result = state.refundResult(request);
      if (result.outcome === 'created') {
        refunds.set(result.refund.id, result.refund);
      }
      return result;
    },
    fetchRefund: async refundId => refunds.get(refundId) ?? null,
    fetchPaymentRefunds: async paymentId => {
      const answer = paymentRefunds.get(paymentId);
      if (answer === 'unreachable') return null;
      return (
        answer ??
        [...refunds.values()].filter(
          r => r.paymentId === paymentId,
        )
      );
    },
  };

  return {
    gateway,
    payments,
    orderPayments,
    refundRequests,
    refunds,
    paymentRefunds,
    state,
  };
};

// The signature Razorpay puts on a payment, made with the fake's key secret
export const signFakePayment = (orderId: string, paymentId: string) =>
  createHmac('sha256', FAKE_RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
