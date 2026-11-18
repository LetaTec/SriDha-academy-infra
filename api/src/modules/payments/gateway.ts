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
  // Every payment made against an order, or null when the provider cannot
  // be read (the caller must not conclude that nothing was paid)
  fetchOrderPayments: (orderId: string) => Promise<ProviderPayment[] | null>;
  // Asks the provider to refund a captured payment. The receipt is our own
  // refund id, which Razorpay treats as an idempotency key.
  createRefund: (request: RefundRequest) => Promise<RefundRequestResult>;
  // Looks up a specific refund by its provider id, or null when it cannot be read
  fetchRefund: (refundId: string) => Promise<ProviderRefund | null>;
  // Looks up all refunds on a payment, or null when the provider cannot be read
  fetchPaymentRefunds: (paymentId: string) => Promise<ProviderRefund[] | null>;
};

export type RefundRequest = {
  providerPaymentId: string;
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
};

// Razorpay refund statuses: pending, processed, failed. Every field is what
// the provider sent, unchecked (see refundEvidence.ts)
export type ProviderRefund = {
  id: string;
  status: string;
  amountPaise: number;
  currency?: string | null;
  paymentId?: string | null;
  receipt?: string | null;
};

export type RefundRequestResult =
  // Accepted: the provider gave the refund an id
  | { outcome: 'created'; refund: ProviderRefund }
  // Refused by the provider (a definite answer): no refund exists
  | { outcome: 'rejected'; reason: string }
  // No answer (network or provider error): a refund may or may not exist;
  // the refund.created webhook or reconciliation settles it
  | { outcome: 'unknown' };

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';
const RAZORPAY_PAYMENTS_URL = 'https://api.razorpay.com/v1/payments';
const RAZORPAY_REFUNDS_URL = 'https://api.razorpay.com/v1/refunds';
const REFUND_LIST_PAGE_SIZE = 100;
const REFUND_LIST_MAX_PAGES = 50;
// Request timeout, idempotency conflict, rate limited
const UNDECIDED_REFUND_STATUSES = [408, 409, 429];

type RazorpayPayment = {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  currency: string;
};

const toProviderPayment = (payment: RazorpayPayment): ProviderPayment => ({
  id: payment.id,
  orderId: payment.order_id,
  status: payment.status,
  amountPaise: payment.amount,
  currency: payment.currency,
});

const basicAuth = (keyId: string, keySecret: string) =>
  `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

// A GET against Razorpay's API, or null when it cannot be read
const readRazorpay = async <T>(
  url: string,
  keyId: string,
  keySecret: string,
): Promise<T | null> => {
  const response = await fetch(url, {
    headers: { Authorization: basicAuth(keyId, keySecret) },
  }).catch(() => null);

  if (!response?.ok) {
    logger.warn('payments.provider_fetch_failed', {
      provider: PAYMENT_PROVIDER.razorpay,
      status: response?.status ?? 'network error',
    });
    return null;
  }

  return (await response.json()) as T;
};

export const createRazorpayGateway = (
  keyId: string,
  keySecret: string,
): PaymentGateway => ({
  provider: PAYMENT_PROVIDER.razorpay,
  keyId,
  fetchPayment: async paymentId => {
    const payment = await readRazorpay<RazorpayPayment>(
      `${RAZORPAY_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`,
      keyId,
      keySecret,
    );
    return payment ? toProviderPayment(payment) : null;
  },
  fetchOrderPayments: async orderId => {
    const result = await readRazorpay<{ items: RazorpayPayment[] }>(
      `${RAZORPAY_ORDERS_URL}/${encodeURIComponent(orderId)}/payments`,
      keyId,
      keySecret,
    );
    return result ? result.items.map(toProviderPayment) : null;
  },
  createRefund: async ({ providerPaymentId, amountPaise, receipt, notes }) => {
    const response = await fetch(
      `${RAZORPAY_PAYMENTS_URL}/${encodeURIComponent(providerPaymentId)}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: basicAuth(keyId, keySecret),
          'Content-Type': 'application/json',
          // Razorpay's idempotency for refunds: a retried request with the
          // same key never creates a second refund
          'X-Refund-Idempotency': receipt,
        },
        body: JSON.stringify({
          amount: amountPaise,
          receipt,
          notes,
          speed: 'normal',
        }),
      },
    ).catch(() => null);

    if (response?.ok) {
      // Cast, not parsed: callers validate it (refundEvidence.ts) before
      // trusting any field
      const refund = (await response.json().catch(() => null)) as {
        id: string;
        status: string;
        amount: number;
        currency?: string;
        payment_id?: string;
        receipt?: string | null;
      } | null;
      return {
        outcome: 'created',
        refund: {
          id: refund?.id as string,
          status: refund?.status as string,
          amountPaise: refund?.amount as number,
          currency: refund?.currency ?? null,
          paymentId: refund?.payment_id ?? null,
          receipt: refund?.receipt ?? null,
        },
      };
    }

    // A 4xx is Razorpay refusing the refund, except a timeout, a conflict
    // (an idempotent request still in progress) or rate limiting, which say
    // nothing about whether the refund exists; anything else is no answer
    if (
      response &&
      response.status >= 400 &&
      response.status < 500 &&
      !UNDECIDED_REFUND_STATUSES.includes(response.status)
    ) {
      const body = (await response.json().catch(() => null)) as {
        error?: { description?: string };
      } | null;
      const reason = body?.error?.description ?? `HTTP ${response.status}`;
      logger.warn('payments.provider_refund_rejected', {
        provider: PAYMENT_PROVIDER.razorpay,
        status: response.status,
      });
      return { outcome: 'rejected', reason };
    }

    logger.error('payments.provider_refund_unanswered', {
      provider: PAYMENT_PROVIDER.razorpay,
      status: response?.status ?? 'network error',
    });
    return { outcome: 'unknown' };
  },
  fetchRefund: async refundId => {
    const refund = await readRazorpay<{
      id: string;
      status: string;
      amount: number;
      currency?: string;
      payment_id?: string;
      receipt?: string | null;
    }>(
      `${RAZORPAY_REFUNDS_URL}/${encodeURIComponent(refundId)}`,
      keyId,
      keySecret,
    );
    return refund
      ? {
          id: refund.id,
          status: refund.status,
          amountPaise: refund.amount,
          currency: refund.currency ?? null,
          paymentId: refund.payment_id ?? null,
          receipt: refund.receipt ?? null,
        }
      : null;
  },
  // Every refund on the payment, page by page (Razorpay returns at most
  // 100 per request). Null unless every page was read: a partial list
  // would make a refund look missing.
  fetchPaymentRefunds: async paymentId => {
    const refunds: ProviderRefund[] = [];
    for (let page = 0; page < REFUND_LIST_MAX_PAGES; page++) {
      const result = await readRazorpay<{
        items: Array<{
          id: string;
          status: string;
          amount: number;
          currency?: string;
          payment_id?: string;
          receipt?: string | null;
        }>;
      }>(
        `${RAZORPAY_PAYMENTS_URL}/${encodeURIComponent(paymentId)}/refunds?count=${REFUND_LIST_PAGE_SIZE}&skip=${page * REFUND_LIST_PAGE_SIZE}`,
        keyId,
        keySecret,
      );
      if (!result) return null;
      refunds.push(
        ...result.items.map(item => ({
          id: item.id,
          status: item.status,
          amountPaise: item.amount,
          currency: item.currency ?? null,
          paymentId: item.payment_id ?? null,
          receipt: item.receipt ?? null,
        })),
      );
      if (result.items.length < REFUND_LIST_PAGE_SIZE) return refunds;
    }
    logger.error('payments.provider_refund_list_too_long', {
      provider: PAYMENT_PROVIDER.razorpay,
    });
    return null;
  },
  createOrder: async ({ amountPaise, currency, receipt }) => {
    const response = await fetch(RAZORPAY_ORDERS_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(keyId, keySecret),
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
  // Test mode has no provider record: nothing was paid at Razorpay
  fetchOrderPayments: async () => [],
  createRefund: async () => ({
    outcome: 'rejected',
    reason: 'Test-mode payments cannot be refunded',
  }),
  fetchRefund: async () => null,
  fetchPaymentRefunds: async () => [],
});

export const createPaymentGateway = (config: AppConfig): PaymentGateway =>
  config.razorpay
    ? createRazorpayGateway(config.razorpay.keyId, config.razorpay.keySecret)
    : createTestGateway();
