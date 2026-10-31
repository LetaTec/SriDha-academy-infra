import { createHmac, timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';
import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import { transaction } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { logger } from '../../logging/logger.js';
import { findPaymentByOrderId } from './payments.repository.js';
import {
  markPaymentPaid,
  PAYMENT_STATUS,
  sendPaymentConfirmation,
} from './payments.service.js';

// Events that mean the money has been captured
const PAID_EVENTS = new Set(['payment.captured', 'order.paid']);

// Only the fields we use. Razorpay sends many more and adds new ones, so
// this schema is not strict; the signature proves the body came from them.
const webhookEventSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z
        .object({
          entity: z.object({
            id: z.string(),
            order_id: z.string().nullable().optional(),
            amount: z.number(),
          }),
        })
        .optional(),
    })
    .optional(),
});

// Razorpay signs the raw body with the webhook secret (HMAC-SHA256, hex)
const isSignatureValid = (body: Buffer, signature: string, secret: string) => {
  const expected = Buffer.from(
    createHmac('sha256', secret).update(body).digest('hex'),
    'utf8',
  );
  const received = Buffer.from(signature, 'utf8');
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
};

// Confirms the seat for a captured payment and returns its id, or null when
// nothing changed. Unknown orders, payments that are already confirmed and
// other events are acknowledged and ignored, so Razorpay stops retrying.
const confirmCapturedPayment = async (
  context: AppContext,
  orderId: string,
  providerPaymentId: string,
  amountPaise: number,
) =>
  transaction(context.db, async tx => {
    const payment = await findPaymentByOrderId(tx, orderId);

    if (!payment || payment.status === PAYMENT_STATUS.paid) return null;

    if (Number(payment.amount_paise) !== amountPaise) {
      logger.error('payments.webhook_amount_mismatch', {
        orderId,
        paymentId: String(payment.id),
        webhookAmountPaise: amountPaise,
        orderAmountPaise: Number(payment.amount_paise),
      });
      return null;
    }

    await markPaymentPaid(
      tx,
      payment,
      providerPaymentId,
      context.now().toISOString(),
    );
    return String(payment.id);
  });

export const createRazorpayWebhookHandler =
  (context: AppContext): RequestHandler =>
  async (req, res) => {
    const secret = context.config.razorpayWebhookSecret;
    if (!secret) {
      throw new ApiError(
        503,
        ERROR_CODE.webhookUnavailable,
        'Payment webhooks are not configured',
      );
    }

    const signature = req.get('x-razorpay-signature');
    const body = Buffer.isBuffer(req.body) ? req.body : null;
    if (!body || !signature || !isSignatureValid(body, signature, secret)) {
      throw new ApiError(
        400,
        ERROR_CODE.webhookSignatureInvalid,
        'The webhook signature does not match',
      );
    }

    let event: z.infer<typeof webhookEventSchema>;
    try {
      event = webhookEventSchema.parse(JSON.parse(body.toString('utf8')));
    } catch {
      throw new ApiError(
        400,
        ERROR_CODE.malformedRequest,
        'The webhook body could not be read',
      );
    }

    const entity = event.payload?.payment?.entity;
    if (PAID_EVENTS.has(event.event) && entity?.order_id) {
      const confirmedPaymentId = await confirmCapturedPayment(
        context,
        entity.order_id,
        entity.id,
        entity.amount,
      );
      if (confirmedPaymentId) {
        await sendPaymentConfirmation(context, confirmedPaymentId);
      }
    }

    res.json({ received: true });
  };
