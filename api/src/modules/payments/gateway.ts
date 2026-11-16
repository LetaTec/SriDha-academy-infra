import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type { AppConfig } from '../../config/env.js';
import type { PaymentProvider } from '../../contracts/payments.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { logger } from '../../logging/logger.js';

export const PAYMENT_PROVIDER = {
  razorpay: 'RAZORPAY',
  test: 'TEST',
} as const satisfies Record<string, PaymentProvider>;

export type { PaymentProvider };

// A payment as the provider holds it. Status values are Razorpay's:
// created, authorized, captured, refunded, failed.
export type ProviderPayment = {
  id: string;
  orderId: string | null;
  status: string;
  amountPaise: number;
  currency: string;
};

export type PaymentGateway = {
  provider: PaymentProvider;
  // Public key the browser needs to open the provider's checkout
  keyId: string | null;
  createOrder: (order: {
    amountPaise: number;
    currency: string;
    receipt: string;
  }) => Promise<{ orderId: string }>;
  // True only when the provider signed this payment for this order
  verifySignature: (payment: {
    orderId: string;
    paymentId: string;
    signature: string;
  }) => boolean;
  // The provider's own record of a payment, or null when it cannot be read
  // (unknown payment, provider unreachable); callers then wait for the
  // webhook instead of guessing
  fetchPayment: (paymentId: string) => Promise<ProviderPayment | null>;
};

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';
const RAZORPAY_PAYMENTS_URL = 'https://api.razorpay.com/v1/payments';

export const createRazorpayGateway = (
  keyId: string,
  keySecret: string,
): PaymentGateway => ({
  provider: PAYMENT_PROVIDER.razorpay,
  keyId,
  fetchPayment: async paymentId => {
    const response = await fetch(
      `${RAZORPAY_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        },
      },
    ).catch(() => null);

    if (!response?.ok) {
      logger.warn('payments.provider_fetch_failed', {
        provider: PAYMENT_PROVIDER.razorpay,
        status: response?.status ?? 'network error',
      });
      return null;
    }

    const payment = (await response.json()) as {
      id: string;
      order_id: string | null;
      status: string;
      amount: number;
      currency: string;
    };
    return {
      id: payment.id,
      orderId: payment.order_id,
      status: payment.status,
      amountPaise: payment.amount,
      currency: payment.currency,
    };
  },
  createOrder: async ({ amountPaise, currency, receipt }) => {
    const response = await fetch(RAZORPAY_ORDERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: amountPaise, currency, receipt }),
    }).catch(() => null);

    if (!response?.ok) {
      logger.error('payments.provider_order_failed', {
        provider: PAYMENT_PROVIDER.razorpay,
        status: response?.status ?? 'network error',
      });
      throw new ApiError(
        502,
        ERROR_CODE.paymentProviderUnavailable,
        'Payments are unavailable right now. Please try again shortly',
      );
    }

    const order = (await response.json()) as { id: string };
    return { orderId: order.id };
  },
  // Razorpay signs "order_id|payment_id" with the key secret
  verifySignature: ({ orderId, paymentId, signature }) => {
    const expected = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const received = Buffer.from(signature, 'utf8');
    const wanted = Buffer.from(expected, 'utf8');
    return (
      received.length === wanted.length && timingSafeEqual(received, wanted)
    );
  },
});

// Without Razorpay keys, orders are saved as payment pending. Nothing can be
// confirmed as paid in test mode.
export const createTestGateway = (): PaymentGateway => ({
  provider: PAYMENT_PROVIDER.test,
  keyId: null,
  createOrder: async () => ({ orderId: `order_test_${randomUUID()}` }),
  verifySignature: () => false,
  fetchPayment: async () => null,
});

export const createPaymentGateway = (config: AppConfig): PaymentGateway =>
  config.razorpay
    ? createRazorpayGateway(config.razorpay.keyId, config.razorpay.keySecret)
    : createTestGateway();
