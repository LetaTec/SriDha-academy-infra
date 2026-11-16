import type { AppContext } from '../../app/context.js';
import type { PaymentStatus } from '../../contracts/payments.js';
import { transaction, type DatabaseClient, type Row } from '../../db/client.js';
import { logger } from '../../logging/logger.js';
import { setEnrolmentStatus } from '../enrolments/enrolments.repository.js';
import { ENROLMENT_STATUS } from '../enrolments/enrolments.service.js';
import {
  findPaymentByOrderIdForUpdate,
  findSeatStatus,
  insertPaymentEvent,
  setPaymentAuthorized,
  setPaymentEventOutcome,
  setPaymentFailed,
  setPaymentPaid,
  setPreRegistrationStatus,
} from './payments.repository.js';

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
  // Already reduced to the fields this system keeps (sanitizePayload)
  payload: unknown;
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
  } else {
    await setPreRegistrationStatus(
      tx,
      String(payment.pre_registration_id),
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
  context: AppContext,
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
