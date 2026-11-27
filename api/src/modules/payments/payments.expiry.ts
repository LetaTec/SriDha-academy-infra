import type { AppContext } from '../../app/context.js';
import { transaction } from '../../db/client.js';
import { logger } from '../../logging/logger.js';
import { AUDIT_ACTION, recordAudit } from '../finance/audit.service.js';
import { PAYMENT_PROVIDER, type PaymentGateway } from './gateway.js';
import { applyPaymentEvent, EVENT_SOURCE } from './payments.lifecycle.js';
import {
  listUnsettledPaymentsBefore,
  setPaymentExpired,
} from './payments.repository.js';

// Razorpay auto-captures authorised payments for up to 3 days by default,
// and a bank can report a late authorisation up to 3 days after creation.
// After this long, with a margin, no money can still arrive for an order.
export const PAYMENT_EXPIRY_AFTER_HOURS = 96;

const HOUR_MS = 60 * 60 * 1000;

// Marks abandoned payments EXPIRED, but only after asking Razorpay about
// the order: a captured payment found there is applied as a capture
// instead, and an order Razorpay cannot answer for is left for the next
// run. Test-mode payments have no provider record and simply expire.
export const expireStalePayments = async (
  context: Pick<AppContext, 'db' | 'now'>,
  gateway: PaymentGateway,
) => {
  const now = context.now();
  const cutoff = new Date(now.getTime() - PAYMENT_EXPIRY_AFTER_HOURS * HOUR_MS);
  const candidates = await listUnsettledPaymentsBefore(
    context.db,
    cutoff.toISOString(),
  );
  const result = { expired: 0, captured: 0, skipped: 0 };

  for (const payment of candidates) {
    const paymentId = String(payment.id);
    const orderId = String(payment.provider_order_id);

    if (payment.provider === PAYMENT_PROVIDER.razorpay) {
      const providerPayments = await gateway.fetchOrderPayments(orderId);
      if (providerPayments === null) {
        result.skipped += 1;
        continue;
      }

      // A refunded payment counts only if Razorpay says it was captured
      // first: an authorisation refunded automatically was never a sale
      const captured = providerPayments.find(
        item =>
          item.status === 'captured' ||
          (item.status === 'refunded' && item.captured === true),
      );
      if (captured) {
        const applied = await applyPaymentEvent(context, {
          provider: PAYMENT_PROVIDER.razorpay,
          source: EVENT_SOURCE.fetch,
          eventId: `fetch:${captured.id}:captured`,
          eventType: 'payment.captured',
          providerPaymentId: captured.id,
          providerOrderId: captured.orderId,
          amountPaise: captured.amountPaise,
          currency: captured.currency,
          payload: {
            id: captured.id,
            order_id: captured.orderId,
            amount: captured.amountPaise,
            currency: captured.currency,
            status: captured.status,
          },
        });
        if (applied.outcome === 'APPLIED') result.captured += 1;
        continue;
      }
    }

    const expired = await transaction(context.db, async tx => {
      const changed = await setPaymentExpired(tx, paymentId, now.toISOString());
      if (changed) {
        await recordAudit(tx, {
          actor: null,
          action: AUDIT_ACTION.paymentExpired,
          entityType: 'payment',
          entityId: paymentId,
          details: { orderId, expiredAfterHours: PAYMENT_EXPIRY_AFTER_HOURS },
          at: now,
        });
      }
      return changed;
    });
    if (expired) result.expired += 1;
  }

  logger.info('jobs.payment_expiry_finished', result);
  return result;
};
