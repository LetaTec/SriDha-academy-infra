import { API_CLIENT } from '@services/http/api';

import type {
  Checkout,
  CreateCheckoutRequest,
  PaymentResult,
  VerifyPaymentRequest,
} from './types';

export const createCheckout = async (body: CreateCheckoutRequest) =>
  (await API_CLIENT.post<{ checkout: Checkout }>('/payments/checkout', body))
    .data.checkout;

export const verifyPayment = async (body: VerifyPaymentRequest) =>
  (await API_CLIENT.post<{ payment: PaymentResult }>('/payments/verify', body))
    .data.payment;
