import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import type {
  Checkout,
  CheckoutKind,
  CreateCheckoutRequest,
  CustomerType,
  PaymentResult,
  PaymentStatus,
  VerifyPaymentRequest,
} from '../../contracts/payments.js';
import { transaction } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { logger } from '../../logging/logger.js';
import { findUserIdByEmail } from '../auth/auth.repository.js';
import { emailSchema, mobileSchema } from '../auth/auth.schema.js';
import { USER_ROLE } from '../auth/roles.js';
import { checkGstin } from '../finance/gstin.js';
import { processEmailOutbox } from '../outbox/outbox.service.js';
import { GST_STATE_CODE, INDIAN_STATES } from './indianStates.js';
import {
  BATCH_AVAILABILITY,
  countActiveEnrolmentsForBatch,
  lockBatchRow,
  resolveBatchAvailability,
  toDateOnly,
  type Row,
} from '../catalogue/catalogue.repository.js';
import {
  findEnrolmentForBatch,
  renewEnrolmentHold,
} from '../enrolments/enrolments.repository.js';
import {
  createEnrolment,
  ENROLMENT_STATUS,
} from '../enrolments/enrolments.service.js';
import type { PaymentGateway } from './gateway.js';
import {
  applyPaymentEvent,
  EVENT_SOURCE,
  PAYMENT_STATUS,
} from './payments.lifecycle.js';
import {
  findBatchForPurchase,
  findPaymentById,
  findPaymentSeatStatus,
  findSeatForRenewal,
  findPreRegistration,
  findTopicForPreRegistration,
  insertBuyerIfNew,
  insertPayment,
  insertPreRegistration,
  setPreRegistrationStatus,
} from './payments.repository.js';

export const CHECKOUT_KIND = {
  enrolment: 'ENROLMENT',
  preRegistration: 'PRE_REGISTRATION',
} as const satisfies Record<string, CheckoutKind>;

export { PAYMENT_STATUS };

export const PRE_REGISTRATION_STATUS = ENROLMENT_STATUS;

const PAYMENT_CURRENCY = 'INR';

export const CUSTOMER_TYPE = {
  individual: 'INDIVIDUAL',
  business: 'BUSINESS',
} as const satisfies Record<string, CustomerType>;

const GSTIN_PROBLEM_MESSAGE: Record<string, string> = {
  length: 'A GSTIN has 15 characters. Please check the GSTIN',
  format: 'This is not in the GSTIN format. Please check the GSTIN',
  state:
    'The first two digits are not a GST state code. Please check the GSTIN',
  checksum:
    'The last character does not match the rest. Please check the GSTIN',
};

// The client names a batch or a topic; the amount always comes from the
// catalogue, and the seat is filed under the billing email. Who the tax
// invoice is for comes with it: an individual's billing address, or a
// business's legal name, GSTIN and address. Card and UPI details are
// entered in the provider's own checkout and never reach this API.
export const createCheckoutSchema = z
  .strictObject({
    kind: z.enum([CHECKOUT_KIND.enrolment, CHECKOUT_KIND.preRegistration]),
    batchId: z.string().trim().max(100).optional(),
    topicId: z.string().trim().max(150).optional(),
    customerType: z.enum(
      [CUSTOMER_TYPE.individual, CUSTOMER_TYPE.business],
      'Choose individual or business',
    ),
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    email: emailSchema,
    mobile: mobileSchema,
    addressLine1: z
      .string()
      .trim()
      .min(3, 'Enter the billing address')
      .max(200),
    addressLine2: z.string().trim().max(200).optional(),
    state: z.enum(INDIAN_STATES, 'Select your state'),
    city: z.string().trim().min(2, 'Enter your city').max(80),
    pinCode: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{5}$/, 'Enter the 6-digit PIN code'),
    businessLegalName: z.string().trim().max(200).optional(),
    gstin: z.string().max(30).optional(),
    purchaseOrderReference: z.string().trim().max(60).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.kind === CHECKOUT_KIND.enrolment && !input.batchId) {
      ctx.addIssue({
        code: 'custom',
        path: ['batchId'],
        message: 'Select a batch',
      });
    }
    if (input.kind === CHECKOUT_KIND.preRegistration && !input.topicId) {
      ctx.addIssue({
        code: 'custom',
        path: ['topicId'],
        message: 'Select a topic',
      });
    }

    if (input.customerType === CUSTOMER_TYPE.individual) {
      for (const field of [
        'businessLegalName',
        'gstin',
        'purchaseOrderReference',
      ] as const) {
        if (input[field] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Only a business purchase has this',
          });
        }
      }
      return;
    }

    if (!input.businessLegalName || input.businessLegalName.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['businessLegalName'],
        message: "Enter the business's legal name",
      });
    }

    if (!input.gstin?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['gstin'],
        message: 'Enter the GSTIN',
      });
      return;
    }
    const gstin = checkGstin(input.gstin);
    if (!gstin.valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['gstin'],
        message: GSTIN_PROBLEM_MESSAGE[gstin.problem],
      });
    } else if (gstin.state !== input.state) {
      ctx.addIssue({
        code: 'custom',
        path: ['gstin'],
        message: `This GSTIN is registered in ${gstin.state}. Choose ${gstin.state} as the billing state, or check the GSTIN`,
      });
    }
  }) satisfies z.ZodType<CreateCheckoutRequest>;

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

// The billing details as they are kept on the payment: GSTIN normalised,
// both states as GST state codes, business fields only for a business
const toBillingSnapshot = (input: CreateCheckoutInput) => {
  const gstin =
    input.customerType === CUSTOMER_TYPE.business && input.gstin
      ? checkGstin(input.gstin)
      : null;
  return {
    customerType: input.customerType,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2?.trim() || null,
    pinCode: input.pinCode,
    billingStateCode: GST_STATE_CODE[input.state],
    businessLegalName: gstin ? (input.businessLegalName ?? null) : null,
    gstin: gstin?.valid ? gstin.gstin : null,
    gstinStateCode: gstin?.valid ? gstin.stateCode : null,
    gstinCheck: gstin?.valid ? 'FORMAT_VALID' : null,
    purchaseOrderReference: gstin
      ? input.purchaseOrderReference?.trim() || null
      : null,
  };
};

export const verifyPaymentSchema = z.strictObject({
  paymentId: z.string().trim().min(1).max(100),
  providerOrderId: z.string().trim().min(1).max(100),
  providerPaymentId: z.string().trim().min(1).max(100),
  signature: z.string().trim().min(1).max(200),
}) satisfies z.ZodType<VerifyPaymentRequest>;

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export type { Checkout };

type Purchase = {
  enrolmentId: string | null;
  preRegistrationId: string | null;
  amountPaise: number;
  topic: Checkout['topic'];
  batch: Checkout['batch'];
};

// What was sold, as recorded on the payment: reports and documents read
// this snapshot, never the live catalogue, which can be renamed or repriced
const describeItem = (purchase: Purchase) =>
  purchase.batch
    ? `${purchase.topic.title} — ${purchase.batch.name}`
    : `${purchase.topic.title} — Pre-registration`;

const toPurchaseTopic = (row: Row): Checkout['topic'] => ({
  id: String(row.t_id),
  title: String(row.t_title),
  level: row.t_level === null ? null : String(row.t_level),
});

const requirePrice = (pricePaise: unknown) => {
  const amount = Number(pricePaise);
  if (pricePaise === null || !Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(
      409,
      ERROR_CODE.priceUnavailable,
      'This topic does not have a fee yet',
    );
  }
  return amount;
};

// Reuses an enrolment that is still waiting for payment, so a student can
// retry a failed or abandoned payment for the same seat.
// A student coming back to an unpaid seat gets a fresh hold, as long as the
// batch still has room once their own old hold is left out of the count.
const renewSeatHold = async (
  context: AppContext,
  enrolmentId: string,
  batchId: string,
) =>
  transaction(context.db, async tx => {
    const now = context.now();
    // Locked like a new hold (see lockBatchRow)
    const batch = await lockBatchRow(tx, batchId);
    if (!batch) {
      throw new ApiError(
        404,
        ERROR_CODE.batchNotFound,
        'This batch no longer exists',
      );
    }

    // Checked again under the lock: a capture may have confirmed this seat
    // since the caller looked, or captured a payment that arrived after
    // the batch filled (a payment exception the team is resolving). Either
    // way a new order would take the buyer's money a second time.
    const seat = await findSeatForRenewal(tx, enrolmentId);
    if (seat.status === ENROLMENT_STATUS.confirmed) {
      throw new ApiError(
        409,
        ERROR_CODE.alreadyEnrolled,
        'This email has already paid for this batch',
        { enrolmentId },
      );
    }
    if (seat.hasPaymentUnderReview) {
      throw new ApiError(
        409,
        ERROR_CODE.paymentUnderReview,
        'We have already received a payment for this seat and our team is reviewing it. Please do not pay again; we will contact you',
        { enrolmentId },
      );
    }

    const taken = await countActiveEnrolmentsForBatch(
      tx,
      batchId,
      now,
      enrolmentId,
    );
    const availability = resolveBatchAvailability(
      batch,
      taken,
      toDateOnly(now),
    );

    if (availability === BATCH_AVAILABILITY.full) {
      throw new ApiError(409, ERROR_CODE.batchFull, 'This batch is full', {
        availability,
      });
    }

    if (availability !== BATCH_AVAILABILITY.open) {
      throw new ApiError(
        409,
        ERROR_CODE.batchUnavailable,
        'This batch is not open for enrolment',
        { availability },
      );
    }

    await renewEnrolmentHold(tx, enrolmentId, now.toISOString());
    return enrolmentId;
  });

const prepareEnrolment = async (
  context: AppContext,
  userId: string,
  batchId: string,
): Promise<Purchase> => {
  const { db } = context;
  const batch = await findBatchForPurchase(db, batchId);

  if (!batch) {
    throw new ApiError(
      404,
      ERROR_CODE.batchNotFound,
      'This batch no longer exists',
    );
  }

  const amountPaise = requirePrice(batch.t_price_paise);
  const existing = await findEnrolmentForBatch(db, userId, batchId);

  if (existing?.status === ENROLMENT_STATUS.confirmed) {
    throw new ApiError(
      409,
      ERROR_CODE.alreadyEnrolled,
      'This email has already paid for this batch',
      { enrolmentId: String(existing.id) },
    );
  }

  const enrolmentId =
    existing?.status === ENROLMENT_STATUS.pendingPayment
      ? await renewSeatHold(context, String(existing.id), batchId)
      : (await createEnrolment(context, userId, batchId)).id;

  return {
    enrolmentId,
    preRegistrationId: null,
    amountPaise,
    topic: toPurchaseTopic(batch),
    batch: {
      id: String(batch.id),
      name: String(batch.name),
      scheduleLabel: String(batch.schedule_label),
    },
  };
};

// Pre-registration is for topics whose batches are not out yet; once a
// batch is published, students choose it instead.
const preparePreRegistration = async (
  context: AppContext,
  userId: string,
  topicId: string,
): Promise<Purchase> => {
  const timestamp = context.now().toISOString();

  return transaction(context.db, async tx => {
    const topic = await findTopicForPreRegistration(tx, topicId);

    if (!topic) {
      throw new ApiError(
        404,
        ERROR_CODE.topicNotFound,
        'This topic no longer exists',
      );
    }

    if (Number(topic.batch_count) > 0) {
      throw new ApiError(
        409,
        ERROR_CODE.preRegistrationClosed,
        'Batches are open for this topic. Choose a batch to enrol',
      );
    }

    const amountPaise = requirePrice(topic.t_price_paise);
    const existing = await findPreRegistration(tx, userId, topicId);

    if (existing?.status === PRE_REGISTRATION_STATUS.confirmed) {
      throw new ApiError(
        409,
        ERROR_CODE.alreadyPreRegistered,
        'This email has already pre-registered for this topic',
      );
    }

    let preRegistrationId: string;
    if (existing) {
      preRegistrationId = String(existing.id);
      await setPreRegistrationStatus(
        tx,
        preRegistrationId,
        PRE_REGISTRATION_STATUS.pendingPayment,
        timestamp,
      );
    } else {
      preRegistrationId = randomUUID();
      await insertPreRegistration(tx, {
        id: preRegistrationId,
        userId,
        topicId,
        status: PRE_REGISTRATION_STATUS.pendingPayment,
        timestamp,
      });
    }

    return {
      enrolmentId: null,
      preRegistrationId,
      amountPaise,
      topic: toPurchaseTopic(topic),
      batch: null,
    };
  });
};

// Students do not sign in. Each seat belongs to the email it was paid
// with: the first checkout from a new email adds a passwordless student
// record for it, and later ones reuse it.
const findOrCreateBuyer = async (context: AppContext, email: string) => {
  await insertBuyerIfNew(context.db, {
    id: randomUUID(),
    email,
    role: USER_ROLE.student,
    timestamp: context.now().toISOString(),
  });
  const userId = await findUserIdByEmail(context.db, email);
  if (!userId) throw new Error('The buyer record was not saved');
  return userId;
};

export const createCheckout = async (
  context: AppContext,
  gateway: PaymentGateway,
  input: CreateCheckoutInput,
): Promise<Checkout> => {
  const userId = await findOrCreateBuyer(context, input.email);
  // The schema guarantees the id that matches the kind
  const purchase =
    input.kind === CHECKOUT_KIND.enrolment
      ? await prepareEnrolment(context, userId, String(input.batchId))
      : await preparePreRegistration(context, userId, String(input.topicId));

  const paymentId = randomUUID();
  const { orderId } = await gateway.createOrder({
    amountPaise: purchase.amountPaise,
    currency: PAYMENT_CURRENCY,
    receipt: paymentId,
  });
  const timestamp = context.now().toISOString();

  await insertPayment(context.db, {
    id: paymentId,
    userId,
    enrolmentId: purchase.enrolmentId,
    preRegistrationId: purchase.preRegistrationId,
    amountPaise: purchase.amountPaise,
    currency: PAYMENT_CURRENCY,
    provider: gateway.provider,
    providerOrderId: orderId,
    status: PAYMENT_STATUS.created,
    billingName: input.fullName,
    billingEmail: input.email,
    billingMobile: input.mobile,
    billingState: input.state,
    billingCity: input.city,
    ...toBillingSnapshot(input),
    itemDescription: describeItem(purchase),
    itemTopicId: purchase.topic.id,
    itemBatchId: purchase.batch?.id ?? null,
    unitPricePaise: purchase.amountPaise,
    timestamp,
  });

  return {
    paymentId,
    status: PAYMENT_STATUS.created,
    kind: input.kind,
    amount: {
      amountPaise: purchase.amountPaise,
      currency: PAYMENT_CURRENCY,
      taxLabel: null,
    },
    topic: purchase.topic,
    batch: purchase.batch,
    provider: { name: gateway.provider, orderId, keyId: gateway.keyId },
  };
};

// The browser's confirmation. A valid provider signature proves Razorpay
// authorised this payment for this order, so the payment becomes
// AUTHORIZED; it becomes PAID only when Razorpay's own record shows it
// captured for the same order, amount and currency. If Razorpay cannot be
// read, or has not captured yet, the payment stays AUTHORIZED and the
// capture webhook completes it. No account is needed: only the provider
// and this API know the key that signs payments.
export const verifyPayment = async (
  context: AppContext,
  gateway: PaymentGateway,
  input: VerifyPaymentInput,
): Promise<PaymentResult> => {
  const payment = await findPaymentById(context.db, input.paymentId);

  if (!payment) {
    throw new ApiError(
      404,
      ERROR_CODE.paymentNotFound,
      'This payment does not exist',
    );
  }

  // The answer says whether the seat is confirmed, not only whether money
  // arrived: a payment for a batch that filled is PAID with no seat
  const result = async (status: PaymentStatus): Promise<PaymentResult> => ({
    paymentId: input.paymentId,
    status,
    seatConfirmed:
      (await findPaymentSeatStatus(context.db, input.paymentId)) ===
      ENROLMENT_STATUS.confirmed,
  });

  if (payment.status === PAYMENT_STATUS.paid) {
    return result(PAYMENT_STATUS.paid);
  }

  const isValid =
    String(payment.provider_order_id) === input.providerOrderId &&
    gateway.verifySignature({
      orderId: input.providerOrderId,
      paymentId: input.providerPaymentId,
      signature: input.signature,
    });

  if (!isValid) {
    throw new ApiError(
      400,
      ERROR_CODE.paymentVerificationFailed,
      'We could not confirm this payment. You have not been charged twice; please contact us if money was taken',
    );
  }

  await applyPaymentEvent(context, {
    provider: gateway.provider,
    source: EVENT_SOURCE.signature,
    eventId: `signature:${input.providerPaymentId}`,
    eventType: 'payment.signature_verified',
    providerPaymentId: input.providerPaymentId,
    providerOrderId: input.providerOrderId,
    amountPaise: null,
    currency: null,
    payload: {
      payment_id: input.providerPaymentId,
      order_id: input.providerOrderId,
    },
  });

  const remote = await gateway.fetchPayment(input.providerPaymentId);
  if (remote) {
    const applied = await applyPaymentEvent(context, {
      provider: gateway.provider,
      source: EVENT_SOURCE.fetch,
      eventId: `fetch:${remote.id}:${remote.status}`,
      eventType: `payment.${remote.status}`,
      providerPaymentId: remote.id,
      providerOrderId: remote.orderId,
      amountPaise: remote.amountPaise,
      currency: remote.currency,
      payload: {
        id: remote.id,
        order_id: remote.orderId,
        amount: remote.amountPaise,
        currency: remote.currency,
        status: remote.status,
      },
    });

    if (applied.confirmedPaymentId) {
      await sendPaymentConfirmation(context, applied.confirmedPaymentId);
    }
  }

  const current = await findPaymentById(context.db, input.paymentId);
  return result(String(current?.status ?? payment.status) as PaymentStatus);
};

// Dispatches outbox emails immediately so that on happy paths the confirmation
// email is sent with zero delay. If dispatch fails, the row remains in the
// email_outbox table for the background worker to retry with exponential backoff.
export const sendPaymentConfirmation = async (
  context: AppContext,
  _paymentId: string,
) => {
  if (!context.mailer) return;

  try {
    await processEmailOutbox(context);
  } catch (error) {
    logger.error('payments.outbox_process_failed', { error });
  }
};
