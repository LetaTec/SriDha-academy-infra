import { API_CLIENT } from '@services/http/api';

import type {
  Checkout,
  CreateCheckoutRequest,
  EnrolmentsResponse,
  PaymentResult,
  TestAttemptResponse,
  TestAttemptsResponse,
  VerifyPaymentRequest,
} from './types';

// The signed-in student's batches: every seat booked with their email
export const listMyBatches = async () =>
  (await API_CLIENT.get<EnrolmentsResponse>('/enrolments')).data.enrolments;

export const createCheckout = async (body: CreateCheckoutRequest) =>
  (await API_CLIENT.post<{ checkout: Checkout }>('/payments/checkout', body))
    .data.checkout;

export const verifyPayment = async (body: VerifyPaymentRequest) =>
  (await API_CLIENT.post<{ payment: PaymentResult }>('/payments/verify', body))
    .data.payment;

// The signed-in student's paid attempts at one topic's test, newest first
export const listTestAttempts = async (topicId: string) =>
  (
    await API_CLIENT.get<TestAttemptsResponse>('/test-attempts', {
      params: { topicId },
    })
  ).data.attempts;

// Starts a paid attempt; the API sets when it ends. Starting a running
// attempt returns it unchanged.
export const startTestAttempt = async (attemptId: string) =>
  (
    await API_CLIENT.post<TestAttemptResponse>(
      `/test-attempts/${encodeURIComponent(attemptId)}/start`,
      {},
    )
  ).data.attempt;

// Ends a running attempt when the student submits their answers
export const finishTestAttempt = async (attemptId: string) =>
  (
    await API_CLIENT.post<TestAttemptResponse>(
      `/test-attempts/${encodeURIComponent(attemptId)}/finish`,
      {},
    )
  ).data.attempt;
