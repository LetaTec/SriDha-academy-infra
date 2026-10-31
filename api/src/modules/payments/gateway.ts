import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type { AppConfig } from '../../config/env.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { logger } from '../../logging/logger.js';

export const PAYMENT_PROVIDER = {
  razorpay: 'RAZORPAY',
  test: 'TEST',
} as const;

export type PaymentProvider =
  (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];

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
};

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';

export const createRazorpayGateway = (
  keyId: string,
  keySecret: string,
): PaymentGateway => ({
  provider: PAYMENT_PROVIDER.razorpay,
  keyId,
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
});

export const createPaymentGateway = (config: AppConfig): PaymentGateway =>
  config.razorpay
    ? createRazorpayGateway(config.razorpay.keyId, config.razorpay.keySecret)
    : createTestGateway();
