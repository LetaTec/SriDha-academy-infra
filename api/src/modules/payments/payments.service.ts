import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import type {
  Checkout,
  CheckoutKind,
  CreateCheckoutRequest,
  PaymentStatus,
  VerifyPaymentRequest,
} from '../../contracts/payments.js';
import { transaction, type DatabaseClient } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { logger } from '../../logging/logger.js';
import { emailSchema, mobileSchema } from '../auth/auth.schema.js';
import {
  BATCH_AVAILABILITY,
  countActiveEnrolmentsForBatch,
  getBatchRow,
  resolveBatchAvailability,
  toDateOnly,
  type Row,
} from '../catalogue/catalogue.repository.js';
import {
  findEnrolmentForBatch,
  renewEnrolmentHold,
  setEnrolmentStatus,
} from '../enrolments/enrolments.repository.js';
import {
  createEnrolment,
  ENROLMENT_STATUS,
} from '../enrolments/enrolments.service.js';
import type { PaymentGateway } from './gateway.js';
import {
  findBatchForPurchase,
  findPaymentConfirmationRow,
  findPaymentForUser,
  findPreRegistration,
  findTopicForPreRegistration,
  insertPayment,
  insertPreRegistration,
  setPaymentPaid,
  setPreRegistrationStatus,
} from './payments.repository.js';

export const CHECKOUT_KIND = {
  enrolment: 'ENROLMENT',
  preRegistration: 'PRE_REGISTRATION',
} as const satisfies Record<string, CheckoutKind>;

export const PAYMENT_STATUS = {
  created: 'CREATED',
  paid: 'PAID',
} as const satisfies Record<string, PaymentStatus>;

export const PRE_REGISTRATION_STATUS = ENROLMENT_STATUS;

const PAYMENT_CURRENCY = 'INR';

// Who the receipt is for. Card and UPI details are entered in the
// provider's own checkout and never reach this API.
const billingFields = {
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: emailSchema,
  mobile: mobileSchema,
};

// The client names a batch or a topic; the amount always comes from the
// catalogue and the student from the session.
export const createCheckoutSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal(CHECKOUT_KIND.enrolment),
    batchId: z.string().trim().min(1, 'Select a batch').max(100),
    ...billingFields,
  }),
  z.strictObject({
    kind: z.literal(CHECKOUT_KIND.preRegistration),
    topicId: z.string().trim().min(1, 'Select a topic').max(150),
    ...billingFields,
  }),
]) satisfies z.ZodType<CreateCheckoutRequest>;

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

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
    const batch = await getBatchRow(tx, batchId);
    if (!batch) {
      throw new ApiError(
        404,
        ERROR_CODE.batchNotFound,
        'This batch no longer exists',
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
      'You have already paid for this batch',
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
        'You have already pre-registered for this topic',
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

export const createCheckout = async (
  context: AppContext,
  gateway: PaymentGateway,
  userId: string,
  input: CreateCheckoutInput,
): Promise<Checkout> => {
  const purchase =
    input.kind === CHECKOUT_KIND.enrolment
      ? await prepareEnrolment(context, userId, input.batchId)
      : await preparePreRegistration(context, userId, input.topicId);

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

// Marks a payment as paid and confirms the seat it was for. Shared by the
// browser's verification and Razorpay's webhook, inside their transaction.
export const markPaymentPaid = async (
  tx: DatabaseClient,
  payment: Row,
  providerPaymentId: string,
  timestamp: string,
) => {
  await setPaymentPaid(
    tx,
    String(payment.id),
    PAYMENT_STATUS.paid,
    providerPaymentId,
    timestamp,
  );

  if (payment.enrolment_id !== null) {
    await setEnrolmentStatus(
      tx,
      String(payment.enrolment_id),
      ENROLMENT_STATUS.confirmed,
      timestamp,
    );
  } else {
    await setPreRegistrationStatus(
      tx,
      String(payment.pre_registration_id),
      PRE_REGISTRATION_STATUS.confirmed,
      timestamp,
    );
  }
};

// Confirms the seat only when the provider's signature matches the order
// this student created.
export const verifyPayment = async (
  context: AppContext,
  gateway: PaymentGateway,
  userId: string,
  input: VerifyPaymentInput,
) => {
  const timestamp = context.now().toISOString();

  const result = await transaction(context.db, async tx => {
    const payment = await findPaymentForUser(tx, input.paymentId, userId);

    if (!payment) {
      throw new ApiError(
        404,
        ERROR_CODE.paymentNotFound,
        'This payment does not exist',
      );
    }

    if (payment.status === PAYMENT_STATUS.paid) {
      return { confirmedNow: false };
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

    await markPaymentPaid(tx, payment, input.providerPaymentId, timestamp);

    return { confirmedNow: true };
  });

  if (result.confirmedNow) {
    await sendPaymentConfirmation(context, input.paymentId);
  }

  return { paymentId: input.paymentId, status: PAYMENT_STATUS.paid };
};

const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Emails the student once their payment is confirmed, by the browser or by
// Razorpay's webhook. A failed email is logged and never undoes the payment.
export const sendPaymentConfirmation = async (
  context: AppContext,
  paymentId: string,
) => {
  if (!context.mailer) return;

  try {
    const row = await findPaymentConfirmationRow(context.db, paymentId);
    if (!row) return;

    await context.mailer.sendPaymentConfirmation(String(row.billing_email), {
      fullName: String(row.billing_name),
      topic: String(row.topic_title),
      batch: row.batch_name === null ? null : String(row.batch_name),
      amount: formatRupees(Number(row.amount_paise)),
      paymentReference: String(row.provider_payment_id ?? row.id),
      learningUrl: `${context.config.webOrigin}/my-learning`,
    });
  } catch (error) {
    logger.error('payments.confirmation_email_failed', { paymentId, error });
  }
};
