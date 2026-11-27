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
  // Razorpay's own flag: whether the money was ever captured. A "refunded"
  // payment may have been captured and refunded, or only authorised and
  // refunded automatically; only the first was ever a sale.
  captured?: boolean | null;
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
  captured?: boolean;
};

const toProviderPayment = (payment: RazorpayPayment): ProviderPayment => ({
  id: payment.id,
  orderId: payment.order_id,
  status: payment.status,
  amountPaise: payment.amount,
  currency: payment.currency,
  captured: typeof payment.captured === 'boolean' ? payment.captured : null,
});

const basicAuth = (keyId: string, keySecret: string) =>
  `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

// Every call to Razorpay has two deadlines: the response must start (the
// connection made and Razorpay answering) within responseStartMs, and the
// whole exchange, body included, must finish within totalMs. A call that
// misses either is treated exactly like a network failure: its outcome is
// unknown, never a failure. A read answers null; a refund is "unknown" and
// stays pending for reconciliation (its receipt is Razorpay's idempotency
// key, so a retry never refunds twice); an order is not created and the
// buyer is asked to try again. Payment state only changes on Razorpay's
// evidence (webhook, or a later read), so a timeout never confirms or
// fails a payment.
export type RazorpayTimeouts = { responseStartMs: number; totalMs: number };

export const RAZORPAY_TIMEOUTS: RazorpayTimeouts = {
  responseStartMs: 10_000,
  totalMs: 20_000,
};

const fetchRazorpay = async (
  url: string,
  init: RequestInit,
  timeouts: RazorpayTimeouts,
): Promise<Response | null> => {
  const responseStart = new AbortController();
  const timer = setTimeout(
    () => responseStart.abort(new Error('Razorpay did not start answering')),
    timeouts.responseStartMs,
  );
  try {
    return await fetch(url, {
      ...init,
      // The total deadline stays attached while the body is read
      signal: AbortSignal.any([
        responseStart.signal,
        AbortSignal.timeout(timeouts.totalMs),
      ]),
    });
  } catch {
    // Network error or a missed deadline (never logged with the request:
    // it carries the key in its Authorization header)
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// The JSON body, or null when it cannot be read in time or is not JSON
const readBody = async <T>(response: Response) =>
  (await response.json().catch(() => null)) as T | null;

// A GET against Razorpay's API, or null when it cannot be read
const readRazorpay = async <T>(
  url: string,
  keyId: string,
  keySecret: string,
  timeouts: RazorpayTimeouts,
): Promise<T | null> => {
  const response = await fetchRazorpay(
    url,
    { headers: { Authorization: basicAuth(keyId, keySecret) } },
    timeouts,
  );

  const body = response?.ok ? await readBody<T>(response) : null;
  if (body === null) {
    logger.warn('payments.provider_fetch_failed', {
      provider: PAYMENT_PROVIDER.razorpay,
      status: response?.status ?? 'network error or timeout',
    });
  }
  return body;
};

export const createRazorpayGateway = (
  keyId: string,
  keySecret: string,
  timeouts: RazorpayTimeouts = RAZORPAY_TIMEOUTS,
): PaymentGateway => ({
  provider: PAYMENT_PROVIDER.razorpay,
  keyId,
  fetchPayment: async paymentId => {
    const payment = await readRazorpay<RazorpayPayment>(
      `${RAZORPAY_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`,
      keyId,
      keySecret,
      timeouts,
    );
    return payment ? toProviderPayment(payment) : null;
  },
  fetchOrderPayments: async orderId => {
    const result = await readRazorpay<{ items: RazorpayPayment[] }>(
      `${RAZORPAY_ORDERS_URL}/${encodeURIComponent(orderId)}/payments`,
      keyId,
      keySecret,
      timeouts,
    );
    return result ? result.items.map(toProviderPayment) : null;
  },
  createRefund: async ({ providerPaymentId, amountPaise, receipt, notes }) => {
    const response = await fetchRazorpay(
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
      timeouts,
    );

    // Accepted, but the body did not arrive in time: the refund may exist,
    // so it is "unknown" (found later by its receipt), never "created" with
    // invented fields
    const refund = response?.ok
      ? await readBody<{
          id: string;
          status: string;
          amount: number;
          currency?: string;
          payment_id?: string;
          receipt?: string | null;
        }>(response)
      : null;
    if (response?.ok && refund === null) {
      logger.error('payments.provider_refund_unanswered', {
        provider: PAYMENT_PROVIDER.razorpay,
        status: 'body not read',
      });
      return { outcome: 'unknown' };
    }

    if (response?.ok && refund) {
      // Cast, not parsed: callers validate it (refundEvidence.ts) before
      // trusting any field
      const accepted = refund as {
        id: string;
        status: string;
        amount: number;
        currency?: string;
        payment_id?: string;
        receipt?: string | null;
      };
      return {
        outcome: 'created',
        refund: {
          id: accepted.id,
          status: accepted.status,
          amountPaise: accepted.amount,
          currency: accepted.currency ?? null,
          paymentId: accepted.payment_id ?? null,
          receipt: accepted.receipt ?? null,
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
      timeouts,
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
        timeouts,
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
    const response = await fetchRazorpay(
      RAZORPAY_ORDERS_URL,
      {
        method: 'POST',
        headers: {
          Authorization: basicAuth(keyId, keySecret),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amountPaise, currency, receipt }),
      },
      timeouts,
    );
    // An order whose answer did not arrive is not used: the buyer is asked
    // to try again, and an order Razorpay may have made is never paid
    // (nobody has its id)
    const order = response?.ok
      ? await readBody<{ id: string }>(response)
      : null;

    if (!order?.id) {
      logger.error('payments.provider_order_failed', {
        provider: PAYMENT_PROVIDER.razorpay,
        status: response?.status ?? 'network error or timeout',
      });
      throw new ApiError(
        502,
        ERROR_CODE.paymentProviderUnavailable,
        'Payments are unavailable right now. Please try again shortly',
      );
    }

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
