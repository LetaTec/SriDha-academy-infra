import { RAZORPAY } from '@constants/payments';

import type { BillingDetails, Checkout, VerifyPaymentRequest } from './types';

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailure = {
  error?: { description?: string };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: 'payment.failed',
    callback: (failure: RazorpayFailure) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

// What happened in Razorpay's window: a signed payment to verify on the
// API, or the student closed it, possibly after a failed attempt
export type RazorpayResult =
  | { status: 'paid'; verification: VerifyPaymentRequest }
  | { status: 'closed'; failureReason: string | null };

let scriptLoading: Promise<void> | null = null;

// Razorpay's checkout script is only loaded when a student pays
const loadRazorpay = () => {
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY.scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      script.remove();
      reject(new Error('Razorpay checkout could not be loaded'));
    };
    document.body.append(script);
  });
  return scriptLoading;
};

// Opens Razorpay's own checkout, where the student enters card or UPI
// details. Razorpay keeps its window open after a failed attempt so the
// student can retry; the last failure is reported if they then close it.
export const payWithRazorpay = async (
  checkout: Checkout,
  billing: BillingDetails,
): Promise<RazorpayResult> => {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay || !checkout.provider.keyId) {
    throw new Error('Razorpay checkout is not available');
  }

  return new Promise(resolve => {
    let failureReason: string | null = null;

    const razorpay = new Razorpay({
      key: checkout.provider.keyId,
      order_id: checkout.provider.orderId,
      amount: checkout.amount.amountPaise,
      currency: checkout.amount.currency,
      name: RAZORPAY.merchantName,
      description: checkout.topic.title,
      prefill: {
        name: billing.fullName,
        email: billing.email,
        contact: billing.mobile,
      },
      theme: { color: RAZORPAY.themeColor },
      handler: (response: RazorpaySuccess) =>
        resolve({
          status: 'paid',
          verification: {
            paymentId: checkout.paymentId,
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          },
        }),
      modal: {
        ondismiss: () => resolve({ status: 'closed', failureReason }),
      },
    });

    razorpay.on('payment.failed', failure => {
      failureReason = failure.error?.description ?? null;
    });
    razorpay.open();
  });
};
