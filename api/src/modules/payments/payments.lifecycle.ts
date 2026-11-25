import { randomUUID } from 'node:crypto';

import type { AppContext } from '../../app/context.js';
import type { PaymentStatus } from '../../contracts/payments.js';
import { transaction, type DatabaseClient, type Row } from '../../db/client.js';
import { logger } from '../../logging/logger.js';
import { setEnrolmentStatus } from '../enrolments/enrolments.repository.js';
import { ENROLMENT_STATUS } from '../enrolments/enrolments.service.js';
import { setTestAttemptStatus } from '../test-attempts/testAttempts.repository.js';
import { AUDIT_ACTION, recordAudit } from '../finance/audit.service.js';
import { enqueuePaymentConfirmationEmails } from '../outbox/outbox.service.js';
import {
  findPaymentByOrderIdForUpdate,
  findPaymentByProviderPaymentIdForUpdate,
  findRefundByIdForUpdate,
  findRefundsForProvider,
  findSeatStatus,
  insertPaymentEvent,
  insertRefund,
  setPaymentAuthorized,
  setPaymentEventOutcome,
  setPaymentFailed,
  setPaymentPaid,
  setPreRegistrationStatus,
  sumActiveRefunds,
  updateRefundFromProvider,
  upsertDispute,
} from './payments.repository.js';
import {
  describeReported,
  exceptionField,
  REFUND_STATUS,
  validateRefundEvidence,
  type RawRefundEvidence,
} from './refundEvidence.js';

// The one place that decides how a payment event changes a payment: a
// Razorpay webhook, the browser's signed confirmation, or the API's own
// lookup of the payment at Razorpay all go through applyPaymentEvent.

export const PAYMENT_STATUS = {
  created: 'CREATED',
  authorized: 'AUTHORIZED',
  paid: 'PAID',
  failed: 'FAILED',
  expired: 'EXPIRED',
} as const satisfies Record<string, PaymentStatus>;

export const EVENT_SOURCE = {
  webhook: 'WEBHOOK',
  signature: 'CHECKOUT_SIGNATURE',
  fetch: 'API_FETCH',
} as const;

export const EVENT_OUTCOME = {
  applied: 'APPLIED',
  ignoredStale: 'IGNORED_STALE',
  rejectedMismatch: 'REJECTED_MISMATCH',
  unknownOrder: 'UNKNOWN_ORDER',
  unknownPayment: 'UNKNOWN_PAYMENT',
  recorded: 'RECORDED',
  capturedForConfirmedSeat: 'CAPTURED_FOR_CONFIRMED_SEAT',
} as const;

type EventOutcome = (typeof EVENT_OUTCOME)[keyof typeof EVENT_OUTCOME];

export type PaymentEvent = {
  provider: string;
  source: (typeof EVENT_SOURCE)[keyof typeof EVENT_SOURCE];
  // Unique per provider: Razorpay's x-razorpay-event-id for webhooks
  eventId: string;
  eventType: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  // Null when the source does not state them (a signature check)
  amountPaise: number | null;
  currency: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  // Present for refund.* events
  // Exactly as the provider sent it, unchecked: see refundEvidence.ts
  refund?: RawRefundEvidence;
  // Present for payment.dispute.* events
  dispute?: {
    id: string;
    paymentId: string;
    amountPaise: number;
    amountDeductedPaise: number;
    currency: string | null;
    status: string;
    phase: string | null;
    reasonCode: string | null;
  };
  // Already reduced to the fields this system keeps (sanitizePayload)
  payload: unknown;
};

const REFUND_STATUS_FOR_EVENT: Record<string, string> = {
  'refund.created': 'PENDING',
  'refund.processed': 'PROCESSED',
  'refund.failed': 'FAILED',
};

const FINAL_REFUND_STATUSES = ['PROCESSED', 'FAILED'];

const DISPUTE_STATUSES = ['open', 'under_review', 'won', 'lost', 'closed'];

const REFUND_EVENT_STATUS: Record<string, string> = {
  PENDING: REFUND_STATUS.pending,
  PROCESSED: REFUND_STATUS.processed,
  FAILED: REFUND_STATUS.failed,
};

const textOf = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

// A financially material report that cannot be applied is never only logged:
// it becomes a finance exception (REFUND_EXCEPTION_RECORDED), shown with the
// other refund exceptions and on the refund's own page. The provider event
// is stored once (a repeated delivery stops before this point), so one
// event records one exception.
const recordRefundException = async (
  tx: DatabaseClient,
  event: PaymentEvent,
  timestamp: string,
  exception: {
    refundId: string | null;
    field: string;
    reason?: string;
    problems?: string[];
    recorded?: Record<string, unknown>;
  },
) => {
  logger.error('payments.refund_mismatch', {
    refundId: exception.refundId,
    field: exception.field,
    eventType: event.eventType,
  });
  await recordAudit(tx, {
    actor: null,
    action: AUDIT_ACTION.refundException,
    entityType: 'refund',
    entityId: exception.refundId,
    details: {
      field: exception.field,
      ...(exception.reason ? { reason: exception.reason } : {}),
      ...(exception.problems ? { problems: exception.problems } : {}),
      eventType: event.eventType,
      eventId: event.eventId,
      recorded: exception.recorded ?? {},
      reported: describeReported(event.refund ?? {}),
    },
    at: new Date(timestamp),
  });
};

// A refund Razorpay reports: one finance staff requested (matched by its id
// or our receipt) moves on; one made in the Razorpay dashboard is recorded.
// Processed and failed are final, so older events arriving late are ignored.
// The report must be complete and describe the refund exactly (ids, payment,
// amount, currency, status, receipt) before it changes anything; otherwise
// the refund keeps its reserved amount and finance is told.
const applyRefundEvent = async (
  tx: DatabaseClient,
  event: PaymentEvent & { refund: NonNullable<PaymentEvent['refund']> },
  timestamp: string,
): Promise<{ outcome: EventOutcome; paymentId: string | null }> => {
  const { refund } = event;
  const reportedPaymentId = textOf(refund.paymentId);
  const payment = reportedPaymentId
    ? await findPaymentByProviderPaymentIdForUpdate(tx, reportedPaymentId)
    : null;
  const paymentId = payment ? String(payment.id) : null;

  const status = REFUND_STATUS_FOR_EVENT[event.eventType];
  if (!status) {
    return payment
      ? { outcome: EVENT_OUTCOME.recorded, paymentId }
      : { outcome: EVENT_OUTCOME.unknownPayment, paymentId: null };
  }

  const checked = validateRefundEvidence(refund, {
    // refund.created may report any status; processed and failed events
    // must carry the status they announce
    ...(status === 'PENDING'
      ? {}
      : { status: REFUND_EVENT_STATUS[status] as never }),
    ...(payment
      ? {
          providerPaymentId: String(payment.provider_payment_id),
          currency: String(payment.currency),
        }
      : {}),
  });
  if (!checked.ok) {
    // Incomplete or malformed: never settles a refund and never releases a
    // reserved amount. Tied to a refund when the receipt is unambiguous.
    const byReceipt = textOf(refund.receipt)
      ? await findRefundsForProvider(tx, null, textOf(refund.receipt))
      : [];
    await recordRefundException(tx, event, timestamp, {
      refundId: byReceipt.length === 1 ? String(byReceipt[0].id) : null,
      field: exceptionField(checked.problems[0].code),
      reason: 'The provider event is incomplete or does not match',
      problems: checked.problems.map(item => item.code),
      recorded: payment ? { paymentId } : {},
    });
    return { outcome: EVENT_OUTCOME.rejectedMismatch, paymentId };
  }
  const evidence = checked.evidence;
  if (!payment || !paymentId) {
    return { outcome: EVENT_OUTCOME.unknownPayment, paymentId: null };
  }

  const candidates = await findRefundsForProvider(
    tx,
    evidence.id,
    evidence.receipt,
  );
  if (candidates.length > 1) {
    // The id points at one refund and the receipt at another (or two share a
    // receipt): the report cannot be tied to a single refund
    await recordRefundException(tx, event, timestamp, {
      refundId: null,
      field: 'correlation',
      reason: 'The provider refund matches more than one refund on record',
      recorded: { paymentId },
    });
    return { outcome: EVENT_OUTCOME.rejectedMismatch, paymentId };
  }

  // Locked after the payment, never before: the one lock order everywhere
  const existing = candidates[0]
    ? String(candidates[0].payment_id) === paymentId
      ? await findRefundByIdForUpdate(tx, String(candidates[0].id))
      : candidates[0]
    : undefined;
  if (existing) {
    // Razorpay's report must describe this refund exactly; otherwise it is
    // recorded as an exception for finance and changes nothing
    const mismatch =
      String(existing.payment_id) !== paymentId
        ? 'payment'
        : existing.provider_refund_id !== null &&
            String(existing.provider_refund_id) !== evidence.id
          ? 'provider_refund_id'
          : evidence.amountPaise !== Number(existing.amount_paise)
            ? 'amount'
            : evidence.currency.toUpperCase() !==
                String(existing.currency).toUpperCase()
              ? 'currency'
              : existing.receipt !== null &&
                  evidence.receipt !== null &&
                  evidence.receipt !== String(existing.receipt)
                ? 'receipt'
                : null;
    if (mismatch) {
      await recordRefundException(tx, event, timestamp, {
        refundId: String(existing.id),
        field: mismatch,
        recorded: {
          paymentId: String(existing.payment_id),
          providerRefundId:
            existing.provider_refund_id === null
              ? null
              : String(existing.provider_refund_id),
          amountPaise: Number(existing.amount_paise),
          currency: String(existing.currency),
        },
      });
      return { outcome: EVENT_OUTCOME.rejectedMismatch, paymentId };
    }

    const current = String(existing.status);
    // Razorpay confirming a refund overrides a failure recorded here
    const overridesFailure = current === 'FAILED' && status === 'PROCESSED';
    if (overridesFailure) {
      // Reinstating it must not take refunds past what was captured
      const active = await sumActiveRefunds(tx, paymentId);
      if (
        active + Number(existing.amount_paise) >
        Number(payment.amount_paise)
      ) {
        // Razorpay has returned money our ledger no longer reserves for this
        // refund. Nothing is rewritten and the cap is not bypassed: the
        // discrepancy is kept for finance to resolve.
        await recordRefundException(tx, event, timestamp, {
          refundId: String(existing.id),
          field: 'amount',
          reason:
            'Razorpay reports this refund processed, but its amount was released and has since been reserved again; reinstating it would exceed the captured amount',
          recorded: {
            paymentId,
            refundStatus: current,
            amountPaise: Number(existing.amount_paise),
            capturedPaise: Number(payment.amount_paise),
            activeRefundsPaise: active,
          },
        });
        return { outcome: EVENT_OUTCOME.rejectedMismatch, paymentId };
      }
      logger.warn('payments.refund_failure_overridden', {
        paymentId,
        refundId: String(existing.id),
      });
      await recordAudit(tx, {
        actor: null,
        action: AUDIT_ACTION.refundRecorded,
        entityType: 'refund',
        entityId: String(existing.id),
        details: {
          paymentId,
          providerRefundId: evidence.id,
          amountPaise: Number(existing.amount_paise),
          status: 'PROCESSED',
          previousStatus: 'FAILED',
          reason: 'Razorpay reported the refund processed',
        },
        at: new Date(timestamp),
      });
    }
    const stale =
      !overridesFailure &&
      (FINAL_REFUND_STATUSES.includes(current) || current === status);
    await updateRefundFromProvider(
      tx,
      {
        id: String(existing.id),
        providerRefundId: evidence.id,
        status,
        failureReason: null,
      },
      timestamp,
    );
    return {
      outcome: stale ? EVENT_OUTCOME.ignoredStale : EVENT_OUTCOME.applied,
      paymentId,
    };
  }

  // Not requested here: made in the Razorpay dashboard. It may not take the
  // refunds past what was captured.
  if (status !== 'FAILED') {
    const active = await sumActiveRefunds(tx, paymentId);
    if (active + evidence.amountPaise > Number(payment.amount_paise)) {
      await recordRefundException(tx, event, timestamp, {
        refundId: null,
        field: 'amount',
        reason:
          'A refund made at Razorpay would take refunds past the captured amount, so it was not recorded',
        recorded: {
          paymentId,
          capturedPaise: Number(payment.amount_paise),
          activeRefundsPaise: active,
        },
      });
      return { outcome: EVENT_OUTCOME.rejectedMismatch, paymentId };
    }
  }

  const refundId = randomUUID();
  await insertRefund(tx, {
    id: refundId,
    paymentId,
    provider: String(payment.provider),
    providerRefundId: evidence.id,
    receipt: evidence.receipt,
    requestKey: null,
    amountPaise: evidence.amountPaise,
    // The provider's own currency, checked against the payment's above
    currency: evidence.currency,
    status,
    reason: null,
    source: 'PROVIDER_DASHBOARD',
    requestedBy: null,
    timestamp,
  });
  await recordAudit(tx, {
    actor: null,
    action: AUDIT_ACTION.refundRecorded,
    entityType: 'refund',
    entityId: refundId,
    details: {
      paymentId,
      providerRefundId: evidence.id,
      amountPaise: evidence.amountPaise,
      status,
    },
    at: new Date(timestamp),
  });
  return { outcome: EVENT_OUTCOME.applied, paymentId };
};

// The latest state of a dispute (chargeback) Razorpay reports
const applyDisputeEvent = async (
  tx: DatabaseClient,
  event: PaymentEvent & { dispute: NonNullable<PaymentEvent['dispute']> },
  timestamp: string,
): Promise<{ outcome: EventOutcome; paymentId: string | null }> => {
  const { dispute } = event;
  const payment = await findPaymentByProviderPaymentIdForUpdate(
    tx,
    dispute.paymentId,
  );
  if (!payment)
    return { outcome: EVENT_OUTCOME.unknownPayment, paymentId: null };

  const paymentId = String(payment.id);
  if (!DISPUTE_STATUSES.includes(dispute.status)) {
    return { outcome: EVENT_OUTCOME.recorded, paymentId };
  }

  await upsertDispute(tx, {
    id: randomUUID(),
    paymentId,
    provider: String(payment.provider),
    providerDisputeId: dispute.id,
    phase: dispute.phase,
    status: dispute.status,
    reasonCode: dispute.reasonCode,
    amountPaise: dispute.amountPaise,
    amountDeductedPaise: dispute.amountDeductedPaise,
    currency: dispute.currency ?? String(payment.currency),
    timestamp,
  });
  await recordAudit(tx, {
    actor: null,
    action: AUDIT_ACTION.disputeRecorded,
    entityType: 'payment',
    entityId: paymentId,
    details: {
      providerDisputeId: dispute.id,
      status: dispute.status,
      amountPaise: dispute.amountPaise,
      amountDeductedPaise: dispute.amountDeductedPaise,
    },
    at: new Date(timestamp),
  });
  return { outcome: EVENT_OUTCOME.applied, paymentId };
};

const TRANSITION = {
  authorize: 'authorize',
  capture: 'capture',
  fail: 'fail',
} as const;

type Transition = (typeof TRANSITION)[keyof typeof TRANSITION];

// Events that move a payment. Anything else (refunds, disputes, other
// notifications) is stored and acknowledged without changing the payment.
const TRANSITION_FOR_EVENT: Record<string, Transition> = {
  'payment.signature_verified': TRANSITION.authorize,
  'payment.authorized': TRANSITION.authorize,
  'payment.captured': TRANSITION.capture,
  'order.paid': TRANSITION.capture,
  'payment.failed': TRANSITION.fail,
};

// Which states each transition may leave. Events can arrive late or out
// of order, so a transition that would move a payment backwards is
// recorded and ignored: PAID is never undone, and a failure followed by a
// capture (Razorpay documents this for UPI retries) still ends PAID.
const ALLOWED_FROM: Record<Transition, readonly string[]> = {
  authorize: [
    PAYMENT_STATUS.created,
    PAYMENT_STATUS.failed,
    PAYMENT_STATUS.expired,
  ],
  capture: [
    PAYMENT_STATUS.created,
    PAYMENT_STATUS.authorized,
    PAYMENT_STATUS.failed,
    PAYMENT_STATUS.expired,
  ],
  fail: [PAYMENT_STATUS.created, PAYMENT_STATUS.authorized],
};

// Marks a payment captured and confirms the seat it was for, inside the
// caller's transaction
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
  } else if (payment.pre_registration_id !== null) {
    await setPreRegistrationStatus(
      tx,
      String(payment.pre_registration_id),
      ENROLMENT_STATUS.confirmed,
      timestamp,
    );
  } else {
    await setTestAttemptStatus(
      tx,
      String(payment.test_attempt_id),
      ENROLMENT_STATUS.confirmed,
      timestamp,
    );
  }
};

const mismatchOf = (payment: Row, event: PaymentEvent) => {
  if (
    event.amountPaise !== null &&
    event.amountPaise !== Number(payment.amount_paise)
  ) {
    return 'amount';
  }
  if (event.currency !== null && event.currency !== String(payment.currency)) {
    return 'currency';
  }
  return null;
};

const applyTransition = async (
  tx: DatabaseClient,
  payment: Row,
  transition: Transition,
  event: PaymentEvent,
  timestamp: string,
  options?: { webOrigin?: string; financeEmails?: readonly string[] },
): Promise<EventOutcome> => {
  const paymentId = String(payment.id);

  if (!ALLOWED_FROM[transition].includes(String(payment.status))) {
    return EVENT_OUTCOME.ignoredStale;
  }

  if (transition === TRANSITION.authorize) {
    await setPaymentAuthorized(
      tx,
      paymentId,
      event.providerPaymentId,
      timestamp,
    );
    return EVENT_OUTCOME.applied;
  }

  if (transition === TRANSITION.fail) {
    await setPaymentFailed(
      tx,
      {
        id: paymentId,
        providerPaymentId: event.providerPaymentId,
        failureCode: event.failureCode ?? null,
        failureReason: event.failureReason ?? null,
      },
      timestamp,
    );
    return EVENT_OUTCOME.applied;
  }

  // Capture. The money has been taken, so the payment is always recorded
  // as paid; if another payment already confirmed this seat (a retried
  // checkout captured twice), it is flagged for a refund instead of being
  // treated as a new sale.
  const seatStatus = await findSeatStatus(tx, {
    enrolmentId:
      payment.enrolment_id === null ? null : String(payment.enrolment_id),
    preRegistrationId:
      payment.pre_registration_id === null
        ? null
        : String(payment.pre_registration_id),
    testAttemptId:
      payment.test_attempt_id === null || payment.test_attempt_id === undefined
        ? null
        : String(payment.test_attempt_id),
  });
  const seatAlreadyConfirmed = seatStatus === ENROLMENT_STATUS.confirmed;

  if (payment.status === PAYMENT_STATUS.expired) {
    logger.warn('payments.captured_after_expiry', { paymentId });
  }

  await markPaymentPaid(
    tx,
    payment,
    String(event.providerPaymentId ?? payment.provider_payment_id ?? ''),
    timestamp,
  );

  if (seatAlreadyConfirmed) {
    logger.error('payments.capture_for_confirmed_seat', {
      paymentId,
      providerPaymentId: event.providerPaymentId,
    });
    return EVENT_OUTCOME.capturedForConfirmedSeat;
  }

  // No tax invoice is issued here. Recording the capture and confirming the
  // seat must never depend on invoicing: a failed SQL statement aborts the
  // whole transaction, so an invoicing error here would lose the capture.
  // Invoices are issued afterwards, each in its own transaction, by the
  // invoice reconciliation job (and only once invoicing is activated).

  await enqueuePaymentConfirmationEmails(tx, {
    paymentId,
    webOrigin: options?.webOrigin ?? 'https://sridhaacademy.com',
    financeEmails: options?.financeEmails,
    timestamp,
  });

  return EVENT_OUTCOME.applied;
};

export type PaymentEventResult = {
  // False when this provider event id had already been stored
  stored: boolean;
  outcome: EventOutcome | null;
  paymentId: string | null;
  // Set when this event confirmed a seat (the customer should be told)
  confirmedPaymentId: string | null;
};

// Stores the event once, then applies it, in one transaction with the
// payment row locked. A repeated delivery of the same provider event is a
// no-op, so webhooks can be retried freely.
export const applyPaymentEvent = (
  context: Pick<AppContext, 'db' | 'now'> & {
    config?: {
      webOrigin?: string;
      financeNotificationEmails?: readonly string[];
    };
  },
  event: PaymentEvent,
): Promise<PaymentEventResult> =>
  transaction(context.db, async tx => {
    const timestamp = context.now().toISOString();
    const eventRowId = await insertPaymentEvent(tx, {
      ...event,
      receivedAt: timestamp,
    });

    if (!eventRowId) {
      return {
        stored: false,
        outcome: null,
        paymentId: null,
        confirmedPaymentId: null,
      };
    }

    // Refunds and disputes are matched by the provider payment id
    const handled = event.refund
      ? await applyRefundEvent(
          tx,
          { ...event, refund: event.refund },
          timestamp,
        )
      : event.dispute
        ? await applyDisputeEvent(
            tx,
            { ...event, dispute: event.dispute },
            timestamp,
          )
        : null;
    if (handled) {
      await setPaymentEventOutcome(
        tx,
        eventRowId,
        handled.outcome,
        handled.paymentId,
      );
      return {
        stored: true,
        outcome: handled.outcome,
        paymentId: handled.paymentId,
        confirmedPaymentId: null,
      };
    }

    const transition = TRANSITION_FOR_EVENT[event.eventType];
    const payment = event.providerOrderId
      ? await findPaymentByOrderIdForUpdate(tx, event.providerOrderId)
      : null;
    const paymentId = payment ? String(payment.id) : null;

    let outcome: EventOutcome;
    if (!transition) {
      outcome = EVENT_OUTCOME.recorded;
    } else if (!payment) {
      outcome = EVENT_OUTCOME.unknownOrder;
    } else {
      const mismatch = mismatchOf(payment, event);
      if (mismatch) {
        logger.error('payments.event_mismatch', {
          paymentId,
          eventType: event.eventType,
          source: event.source,
          field: mismatch,
        });
        outcome = EVENT_OUTCOME.rejectedMismatch;
      } else {
        outcome = await applyTransition(
          tx,
          payment,
          transition,
          event,
          timestamp,
          {
            webOrigin: context.config?.webOrigin,
            financeEmails: context.config?.financeNotificationEmails,
          },
        );
      }
    }

    await setPaymentEventOutcome(tx, eventRowId, outcome, paymentId);

    return {
      stored: true,
      outcome,
      paymentId,
      confirmedPaymentId:
        transition === TRANSITION.capture && outcome === EVENT_OUTCOME.applied
          ? paymentId
          : null,
    };
  });

// Keeps only the fields this system uses from a provider payload. Card,
// UPI, bank, email, phone and address details are never stored.
const PAYMENT_FIELDS = [
  'id',
  'entity',
  'order_id',
  'amount',
  'currency',
  'status',
  'captured',
  'method',
  'amount_refunded',
  'refund_status',
  'fee',
  'tax',
  'error_code',
  'error_description',
  'error_reason',
  'error_source',
  'error_step',
  'created_at',
];
const ORDER_FIELDS = [
  'id',
  'entity',
  'amount',
  'amount_paid',
  'currency',
  'status',
  'receipt',
  'created_at',
];
const REFUND_FIELDS = [
  'id',
  'entity',
  'payment_id',
  'amount',
  'currency',
  'status',
  'speed_processed',
  'receipt',
  'created_at',
];
const DISPUTE_FIELDS = [
  'id',
  'entity',
  'payment_id',
  'amount',
  'currency',
  'status',
  'phase',
  'reason_code',
  'amount_deducted',
  'created_at',
];

const pick = (value: unknown, fields: readonly string[]) => {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    fields
      .filter(field => field in source)
      .map(field => [field, source[field]]),
  );
};

const entityOf = (payload: unknown, name: string) =>
  (payload as Record<string, { entity?: unknown } | undefined> | undefined)?.[
    name
  ]?.entity;

export const sanitizeWebhookBody = (body: {
  event: string;
  created_at?: unknown;
  payload?: unknown;
}) => {
  const kept = {
    event: body.event,
    created_at: body.created_at,
    payment: pick(entityOf(body.payload, 'payment'), PAYMENT_FIELDS),
    order: pick(entityOf(body.payload, 'order'), ORDER_FIELDS),
    refund: pick(entityOf(body.payload, 'refund'), REFUND_FIELDS),
    dispute: pick(entityOf(body.payload, 'dispute'), DISPUTE_FIELDS),
  };
  return Object.fromEntries(
    Object.entries(kept).filter(([, value]) => value !== undefined),
  );
};
