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
        .object({
          // Deliberately loose: a refund event that is incomplete or the
          // wrong type is still stored and judged by refundEvidence.ts, which
          // records an exception for finance. Rejecting it here would only
          // make Razorpay retry it for ever and leave no record.
          entity: z.object({
            id: z.unknown().optional(),
            payment_id: z.unknown().optional(),
            amount: z.unknown().optional(),
            currency: z.unknown().optional(),
            receipt: z.unknown().optional(),
            status: z.unknown().optional(),
          }),
        })
        .optional(),
      dispute: z
        .object({
          entity: z.object({
            id: z.string(),
            payment_id: z.string(),
            amount: z.number(),
            amount_deducted: z.number().optional(),
            currency: z.string().optional(),
            status: z.string(),
            phase: z.string().nullable().optional(),
            reason_code: z.string().nullable().optional(),
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
    const refund = event.payload?.refund?.entity;
    const dispute = event.payload?.dispute?.entity;
    await applyPaymentEvent(context, {
      provider: PAYMENT_PROVIDER.razorpay,
      source: EVENT_SOURCE.webhook,
      eventId: eventIdOf(req.get('x-razorpay-event-id'), body),
      eventType: event.event,
      providerPaymentId:
        payment?.id ??
        (typeof refund?.payment_id === 'string' ? refund.payment_id : null) ??
        dispute?.payment_id ??
        null,
      providerOrderId: payment?.order_id ?? null,
      amountPaise: payment?.amount ?? null,
      currency: payment?.currency ?? null,
      failureCode: payment?.error_code ?? null,
      failureReason: payment?.error_description ?? null,
      // A dispute event can also carry the payment entity; the dispute
      // itself is what is being reported
      ...(refund && event.event.startsWith('refund.')
        ? {
            refund: {
              id: refund.id,
              paymentId: refund.payment_id,
              amountPaise: refund.amount,
              currency: refund.currency,
              receipt: refund.receipt,
              status: refund.status,
            },
          }
        : {}),
      ...(dispute && event.event.startsWith('payment.dispute.')
        ? {
            dispute: {
              id: dispute.id,
              paymentId: dispute.payment_id,
              amountPaise: dispute.amount,
              amountDeductedPaise: dispute.amount_deducted ?? 0,
              currency: dispute.currency ?? null,
              status: dispute.status,
              phase: dispute.phase ?? null,
              reasonCode: dispute.reason_code ?? null,
            },
          }
        : {}),
      payload: sanitizeWebhookBody(
        raw as { event: string; created_at?: unknown; payload?: unknown },
      ),
    });

    // Emails queued by a capture are sent by the outbox worker, so the
    // acknowledgement never waits for the email provider (a slow provider
    // could otherwise make Razorpay time out, retry and disable the webhook)
    res.json({ received: true });
  };
