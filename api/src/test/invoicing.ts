import { randomUUID } from 'node:crypto';

import type { TaxQuote } from '../contracts/finance.js';
import { transaction, type Database } from '../db/client.js';
import { insertTaxConfigurationApproval } from '../modules/finance/invoices/invoices.repository.js';
import { CURRENT_TAX_CONFIGURATION } from '../modules/finance/invoices/invoicing.activation.js';
import {
  createTaxQuote,
  redeemTaxQuote,
} from '../modules/finance/quotes/quotes.service.js';
import {
  applyPaymentEvent,
  EVENT_SOURCE,
} from '../modules/payments/payments.lifecycle.js';
import {
  insertBuyerIfNew,
  insertPayment,
  insertPreRegistration,
} from '../modules/payments/payments.repository.js';

// Test fixtures for invoicing: a recorded approval, and a payment that
// collected quoted GST (which today's checkout never produces; invoicing
// can only be exercised this way until checkout charges quotes).

export const TEST_TOPIC_ID = 'topic_accounts_gst_class_11';

// GST registration is effective 1 July 2026 (IST); approvals in these tests
// take effect 1 minute before recording so they pass the 5-minute backdating guard,
// with payments 30 seconds ago and processing happening now or later.
export const TEST_APPROVAL_BASE_TIME = Math.floor(Date.now() / 1000) * 1000;
export const TEST_APPROVAL_EFFECTIVE_FROM = new Date(
  TEST_APPROVAL_BASE_TIME - 60_000,
).toISOString();
export const TEST_PAID_AT = new Date(TEST_APPROVAL_BASE_TIME - 30_000);
export const TEST_LATER = new Date(TEST_APPROVAL_BASE_TIME + 60_000);

// Inserted directly (the route needs a signed-in super admin). The newest
// insert is the latest record; it is recorded an hour before it takes
// effect unless a test says otherwise.
//
// It takes effect at the fixed TEST_APPROVAL_EFFECTIVE_FROM, the instant
// every test clock and payment time here is measured from. It used to be
// "a minute before the call", which drifted with the real clock: a call
// more than 30 seconds into a slow run made the approval start after a
// test clock of TEST_APPROVAL_EFFECTIVE_FROM + 30s, so invoicing was "not
// yet effective" and nothing was issued.
//
// The database refuses an approval that starts more than 5 minutes before
// it is recorded (real time). A file that runs longer than that (e.g.
// invoices.test.ts, which moves its clocks forward with refreshTimeline)
// gets the latest start the guard allows instead, 4 minutes back.
const BACKDATING_GUARD_MARGIN_MS = 4 * 60 * 1000;

export const recordTestApproval = (
  db: Database,
  overrides: Partial<Parameters<typeof insertTaxConfigurationApproval>[1]> = {},
) => {
  const effectiveFrom =
    overrides.effectiveFrom ??
    new Date(
      Math.max(
        new Date(TEST_APPROVAL_EFFECTIVE_FROM).getTime(),
        Date.now() - BACKDATING_GUARD_MARGIN_MS,
      ),
    ).toISOString();
  return insertTaxConfigurationApproval(db, {
    id: randomUUID(),
    status: 'APPROVED',
    ...CURRENT_TAX_CONFIGURATION,
    effectiveFrom,
    approvedBy: 'Test fixture CA',
    approvalReference: 'TEST-FIXTURE-ONLY',
    recordedBy: 'admin@sridha.test',
    recordedAt: new Date(
      new Date(effectiveFrom).getTime() - 60 * 60 * 1000,
    ).toISOString(),
    ...overrides,
  });
};

type BillingOverrides = Partial<{
  billingCity: string;
  state: 'Maharashtra' | 'Rajasthan';
  billingStateCode: string;
  pinCode: string;
}>;

export type QuotedPayment = {
  paymentId: string;
  orderId: string;
  quote: TaxQuote;
  amountPaise: number;
};

/**
 * A guest buys a topic with a redeemed quote: the payment is created for
 * the quote's total (or `chargedPaise`, to simulate a mismatch), marked
 * QUOTED, and left CREATED. Call captureQuotedPayment to pay it.
 */
export const createQuotedPayment = async (
  db: Database,
  options: {
    at: Date;
    chargedPaise?: number;
    billing?: BillingOverrides;
  },
): Promise<QuotedPayment> => {
  const timestamp = options.at.toISOString();
  const email = `invoice.buyer.${randomUUID()}@example.com`;
  const state = options.billing?.state ?? 'Maharashtra';
  const billingStateCode =
    options.billing?.billingStateCode ?? (state === 'Rajasthan' ? '08' : '27');
  const pinCode = options.billing?.pinCode ?? '400030';

  const quote = await createTaxQuote(
    { db, now: () => options.at },
    {
      itemType: 'TOPIC',
      itemId: TEST_TOPIC_ID,
      customerType: 'INDIVIDUAL',
      customerEmail: email,
      addressLine1: '42 Worli Seaface',
      city: 'Mumbai',
      state,
      pinCode,
    },
  );

  const userId = randomUUID();
  const preRegistrationId = randomUUID();
  const paymentId = randomUUID();
  const orderId = `order_${randomUUID()}`;
  const amountPaise = options.chargedPaise ?? quote.totalAmountPaise;

  await insertBuyerIfNew(db, {
    id: userId,
    email,
    role: 'STUDENT',
    timestamp,
  });
  await insertPreRegistration(db, {
    id: preRegistrationId,
    userId,
    topicId: TEST_TOPIC_ID,
    status: 'PENDING_PAYMENT',
    timestamp,
  });
  await insertPayment(db, {
    id: paymentId,
    userId,
    enrolmentId: null,
    preRegistrationId,
    amountPaise,
    currency: 'INR',
    provider: 'RAZORPAY',
    providerOrderId: orderId,
    status: 'CREATED',
    billingName: 'Invoice Test Buyer',
    billingEmail: email,
    billingMobile: '+91 98765 12345',
    billingState: state,
    billingCity: options.billing?.billingCity ?? 'Mumbai',
    customerType: 'INDIVIDUAL',
    addressLine1: '42 Worli Seaface',
    addressLine2: null,
    pinCode,
    billingStateCode,
    businessLegalName: null,
    gstin: null,
    gstinStateCode: null,
    gstinCheck: null,
    purchaseOrderReference: null,
    itemDescription: 'Learn GST for Class 11',
    itemTopicId: TEST_TOPIC_ID,
    itemBatchId: null,
    unitPricePaise: quote.taxableAmountPaise,
    timestamp,
  });

  await transaction(db, async tx => {
    await redeemTaxQuote(tx, {
      quoteId: quote.id,
      userId: null,
      customerEmail: email,
      itemType: 'TOPIC',
      itemId: TEST_TOPIC_ID,
      cataloguePricePaise: quote.taxableAmountPaise,
      customerType: 'INDIVIDUAL',
      billingStateCode,
      pinCode,
      gstin: null,
      now: options.at,
    });
    await tx.query(
      `UPDATE payments SET tax_status = 'QUOTED', tax_quote_id = $2
       WHERE id = $1`,
      [paymentId, quote.id],
    );
  });

  return { paymentId, orderId, quote, amountPaise };
};

// Razorpay's capture webhook, through the real payment lifecycle
export const captureQuotedPayment = (
  db: Database,
  payment: QuotedPayment,
  at: Date,
) =>
  applyPaymentEvent(
    { db, now: () => at },
    {
      provider: 'RAZORPAY',
      source: EVENT_SOURCE.webhook,
      eventId: `evt_${randomUUID()}`,
      eventType: 'payment.captured',
      providerPaymentId: `pay_${randomUUID()}`,
      providerOrderId: payment.orderId,
      amountPaise: payment.amountPaise,
      currency: 'INR',
      payload: {},
    },
  );

export const countRows = async (db: Database, table: string) => {
  const row = await db.get<{ n: string | number }>(
    `SELECT COUNT(*) AS n FROM ${table}`,
  );
  return Number(row?.n ?? 0);
};
