import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';
import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { PAYMENT_PROVIDER } from './gateway.js';
import {
  applyPaymentEvent,
  EVENT_SOURCE,
  sanitizeWebhookBody,
} from './payments.lifecycle.js';
import { sendPaymentConfirmation } from './payments.service.js';

// Only the fields we use. Razorpay sends many more and adds new ones, so
// this schema is not strict; the signature proves the body came from them.
const webhookEventSchema = z.object({
  event: z.string(),
  created_at: z.number().optional(),
  payload: z
    .object({
      payment: z
        .object({
          entity: z.object({
            id: z.string(),
            order_id: z.string().nullable().optional(),
            amount: z.number(),
            currency: z.string().optional(),
            error_code: z.string().nullable().optional(),
            error_description: z.string().nullable().optional(),
          }),
        })
        .optional(),
      refund: z
        .object({ entity: z.object({ payment_id: z.string().optional() }) })
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

// Razorpay delivers at least once and names each event in
// x-razorpay-event-id. Without that header, the body's own hash stands in,
// so an identical redelivery is still recognised.
const eventIdOf = (header: string | undefined, body: Buffer) =>
  header?.trim() ||
  `body-sha256:${createHash('sha256').update(body).digest('hex')}`;

// Every verified event is stored once and acknowledged. Payment events move
// the payment (see payments.lifecycle.ts); refund, dispute and other events
// are kept for the finance records. Razorpay stops retrying on any 2xx.
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

    let raw: unknown;
    let event: z.infer<typeof webhookEventSchema>;
    try {
      raw = JSON.parse(body.toString('utf8'));
      event = webhookEventSchema.parse(raw);
    } catch {
      throw new ApiError(
        400,
        ERROR_CODE.malformedRequest,
        'The webhook body could not be read',
      );
    }

    const payment = event.payload?.payment?.entity;
    const result = await applyPaymentEvent(context, {
      provider: PAYMENT_PROVIDER.razorpay,
      source: EVENT_SOURCE.webhook,
      eventId: eventIdOf(req.get('x-razorpay-event-id'), body),
      eventType: event.event,
      providerPaymentId:
        payment?.id ?? event.payload?.refund?.entity.payment_id ?? null,
      providerOrderId: payment?.order_id ?? null,
      amountPaise: payment?.amount ?? null,
      currency: payment?.currency ?? null,
      failureCode: payment?.error_code ?? null,
      failureReason: payment?.error_description ?? null,
      payload: sanitizeWebhookBody(
        raw as { event: string; created_at?: unknown; payload?: unknown },
      ),
    });

    if (result.confirmedPaymentId) {
      await sendPaymentConfirmation(context, result.confirmedPaymentId);
    }

    res.json({ received: true });
  };
