import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import { transaction, type DatabaseClient } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { emailSchema, mobileSchema } from '../auth/auth.schema.js';
import type { Price, Row } from '../catalogue/catalogue.repository.js';
import {
  createEnrolment,
  ENROLMENT_STATUS,
} from '../enrolments/enrolments.service.js';
import type { PaymentGateway, PaymentProvider } from './gateway.js';

export const CHECKOUT_KIND = {
  enrolment: 'ENROLMENT',
  preRegistration: 'PRE_REGISTRATION',
} as const;

export const PAYMENT_STATUS = {
  created: 'CREATED',
  paid: 'PAID',
} as const;

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
]);

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const verifyPaymentSchema = z.strictObject({
  paymentId: z.string().trim().min(1).max(100),
  providerOrderId: z.string().trim().min(1).max(100),
  providerPaymentId: z.string().trim().min(1).max(100),
  signature: z.string().trim().min(1).max(200),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export type Checkout = {
  paymentId: string;
  status: (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
  kind: (typeof CHECKOUT_KIND)[keyof typeof CHECKOUT_KIND];
  amount: Price;
  topic: { id: string; title: string; level: string | null };
  batch: { id: string; name: string; scheduleLabel: string } | null;
  provider: {
    name: PaymentProvider;
    orderId: string;
    // Present for Razorpay: the public key that opens its checkout
    keyId: string | null;
  };
};

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
const prepareEnrolment = async (
  context: AppContext,
  userId: string,
  batchId: string,
): Promise<Purchase> => {
  const { db } = context;
  const batch = await db.get<Row>(
    `SELECT b.id, b.name, b.schedule_label, t.id AS t_id, t.title AS t_title,
            t.level AS t_level, t.price_paise AS t_price_paise
     FROM batches b JOIN topics t ON t.id = b.topic_id WHERE b.id = $1`,
    [batchId],
  );

  if (!batch) {
    throw new ApiError(
      404,
      ERROR_CODE.batchNotFound,
      'This batch no longer exists',
    );
  }

  const amountPaise = requirePrice(batch.t_price_paise);
  const existing = await db.get<{ id: string; status: string }>(
    'SELECT id, status FROM enrolments WHERE user_id = $1 AND batch_id = $2',
    [userId, batchId],
  );

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
      ? String(existing.id)
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
    const topic = await tx.get<Row>(
      `SELECT t.id AS t_id, t.title AS t_title, t.level AS t_level,
              t.price_paise AS t_price_paise,
              (SELECT COUNT(*) FROM batches b WHERE b.topic_id = t.id) AS batch_count
       FROM topics t WHERE t.id = $1`,
      [topicId],
    );

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
    const existing = await tx.get<{ id: string; status: string }>(
      'SELECT id, status FROM pre_registrations WHERE user_id = $1 AND topic_id = $2',
      [userId, topicId],
    );

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
      await tx.query(
        'UPDATE pre_registrations SET status = $1, updated_at = $2 WHERE id = $3',
        [PRE_REGISTRATION_STATUS.pendingPayment, timestamp, preRegistrationId],
      );
    } else {
      preRegistrationId = randomUUID();
      await tx.query(
        `INSERT INTO pre_registrations (id, user_id, topic_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          preRegistrationId,
          userId,
          topicId,
          PRE_REGISTRATION_STATUS.pendingPayment,
          timestamp,
          timestamp,
        ],
      );
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

  await context.db.query(
    `INSERT INTO payments (id, user_id, enrolment_id, pre_registration_id, amount_paise, currency,
       provider, provider_order_id, status, billing_name, billing_email, billing_mobile,
       created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      paymentId,
      userId,
      purchase.enrolmentId,
      purchase.preRegistrationId,
      purchase.amountPaise,
      PAYMENT_CURRENCY,
      gateway.provider,
      orderId,
      PAYMENT_STATUS.created,
      input.fullName,
      input.email,
      input.mobile,
      timestamp,
      timestamp,
    ],
  );

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
  await tx.query(
    `UPDATE payments SET status = $1, provider_payment_id = $2, updated_at = $3
     WHERE id = $4`,
    [PAYMENT_STATUS.paid, providerPaymentId, timestamp, String(payment.id)],
  );

  if (payment.enrolment_id !== null) {
    await tx.query(
      'UPDATE enrolments SET status = $1, updated_at = $2 WHERE id = $3',
      [ENROLMENT_STATUS.confirmed, timestamp, String(payment.enrolment_id)],
    );
  } else {
    await tx.query(
      'UPDATE pre_registrations SET status = $1, updated_at = $2 WHERE id = $3',
      [
        PRE_REGISTRATION_STATUS.confirmed,
        timestamp,
        String(payment.pre_registration_id),
      ],
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

  return transaction(context.db, async tx => {
    const payment = await tx.get<Row>(
      'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
      [input.paymentId, userId],
    );

    if (!payment) {
      throw new ApiError(
        404,
        ERROR_CODE.paymentNotFound,
        'This payment does not exist',
      );
    }

    if (payment.status === PAYMENT_STATUS.paid) {
      return { paymentId: input.paymentId, status: PAYMENT_STATUS.paid };
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

    return { paymentId: input.paymentId, status: PAYMENT_STATUS.paid };
  });
};
