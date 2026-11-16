import {
  createRazorpayGateway,
  type PaymentGateway,
} from '../modules/payments/gateway.js';

export const FAKE_RAZORPAY_KEY_ID = 'rzp_test_key';
export const FAKE_RAZORPAY_KEY_SECRET = 'rzp_test_secret';

// Razorpay's real signature check, with orders made locally and no network
// calls. Payments are captured automatically, as Razorpay does by default
// for Orders API payments: once a payment's signature has checked out,
// looking it up reports it captured for its order's amount. Tests that need
// other provider behaviour (authorised only, unreachable, mismatched) build
// their own gateway, as payments.lifecycle.test.ts does.
export const createFakeRazorpay = (): PaymentGateway => {
  const real = createRazorpayGateway(
    FAKE_RAZORPAY_KEY_ID,
    FAKE_RAZORPAY_KEY_SECRET,
  );
  const orderAmounts = new Map<string, number>();
  const signedOrders = new Map<string, string>();
  let orderNumber = 0;

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
    fetchPayment: async paymentId => {
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
    },
  };
};
