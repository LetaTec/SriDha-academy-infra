import type { ErrorRequestHandler, RequestHandler } from 'express';

// Every error response follows { message, code, details }.
export const ERROR_CODE = {
  requestValidationFailed: 'REQUEST_VALIDATION_FAILED',
  malformedRequest: 'MALFORMED_REQUEST',
  unauthenticated: 'UNAUTHENTICATED',
  sessionExpired: 'SESSION_EXPIRED',
  invalidCredentials: 'INVALID_CREDENTIALS',
  emailAlreadyRegistered: 'EMAIL_ALREADY_REGISTERED',
  invalidResetToken: 'INVALID_RESET_TOKEN',
  passwordRecoveryUnavailable: 'PASSWORD_RECOVERY_UNAVAILABLE',
  invalidSignInLink: 'INVALID_SIGN_IN_LINK',
  signInLinkUnavailable: 'SIGN_IN_LINK_UNAVAILABLE',
  originNotAllowed: 'ORIGIN_NOT_ALLOWED',
  batchNotFound: 'BATCH_NOT_FOUND',
  batchUnavailable: 'BATCH_UNAVAILABLE',
  batchFull: 'BATCH_FULL',
  alreadyEnrolled: 'ALREADY_ENROLLED',
  topicNotFound: 'TOPIC_NOT_FOUND',
  alreadyPreRegistered: 'ALREADY_PRE_REGISTERED',
  preRegistrationClosed: 'PRE_REGISTRATION_CLOSED',
  priceUnavailable: 'PRICE_UNAVAILABLE',
  paymentNotFound: 'PAYMENT_NOT_FOUND',
  paymentVerificationFailed: 'PAYMENT_VERIFICATION_FAILED',
  paymentProviderUnavailable: 'PAYMENT_PROVIDER_UNAVAILABLE',
  webhookUnavailable: 'WEBHOOK_UNAVAILABLE',
  webhookSignatureInvalid: 'WEBHOOK_SIGNATURE_INVALID',
  rateLimitExceeded: 'RATE_LIMIT_EXCEEDED',
  notFound: 'NOT_FOUND',
  forbidden: 'FORBIDDEN',
  internalError: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export type ApiFieldIssue = {
  message: string;
  path: Array<string | number>;
  code?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown | null;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details: unknown | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(
    new ApiError(
      404,
      ERROR_CODE.notFound,
      'The requested resource was not found',
    ),
  );
};

const isBodyParserError = (
  error: unknown,
): error is { type: string; status: number } =>
  typeof error === 'object' &&
  error !== null &&
  'type' in error &&
  'status' in error &&
  typeof (error as { status: unknown }).status === 'number';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }

  if (isBodyParserError(error) && error.status < 500) {
    res.status(400).json({
      message: 'The request body could not be read',
      code: ERROR_CODE.malformedRequest,
      details: null,
    });
    return;
  }

  // Keep the diagnostic detail in the server log only.
  console.error('[api] unhandled error - %s %s', req.method, req.path, error);

  res.status(500).json({
    message: 'Something went wrong. Please try again.',
    code: ERROR_CODE.internalError,
    details: null,
  });
};
