import { randomUUID } from 'node:crypto';

import type { AppContext } from '../../../app/context.js';
import type {
  Invoice,
  TaxQuote,
  TaxSnapshot,
} from '../../../contracts/finance.js';
import {
  transaction,
  type DatabaseClient,
  type Row,
} from '../../../db/client.js';
import { logger } from '../../../logging/logger.js';
import { SUPPLIER_CONFIG } from '../gst/gst.config.js';
import { calculateSriDhaGst } from '../gst/gst.calculator.js';
import { determinePlaceOfSupply } from '../gst/gst.placeOfSupply.js';
import { findTaxQuoteById } from '../quotes/quotes.repository.js';
import { assertTaxCalculationEligibility } from '../tax/tax.eligibility.js';
import {
  getInvoicingActivation,
  lockApprovalsForIssuance,
} from './invoicing.activation.js';
import {
  allocateInvoiceNumber,
  clearIssuanceFailure,
  countDeferredIssuances,
  findInvoiceByPaymentId,
  findPaymentForInvoiceUpdate,
  insertInvoice,
  listInvoicesBreakingInvariants,
  listInvoicesWithoutSnapshot,
  listPaymentIdsAwaitingInvoice,
  recordIssuanceFailure,
  toIsoTimestamp,
  type TaxConfigurationApproval,
} from './invoices.repository.js';
import {
  findTaxSnapshotByPaymentId,
  insertTaxSnapshot,
  type NewTaxSnapshot,
} from './taxSnapshots.repository.js';

export type IssueInvoiceResult = {
  invoice: Invoice;
  snapshot: TaxSnapshot;
  // False when the invoice already existed (nothing was issued now)
  created: boolean;
};

export const INVOICE_INELIGIBLE = {
  paymentNotFound: 'PAYMENT_NOT_FOUND',
  notPaid: 'PAYMENT_NOT_PAID',
  testPayment: 'TEST_PAYMENT',
  // The payment did not collect a quoted GST amount (today's checkout
  // charges the catalogue price only), so no tax invoice may state GST
  taxNotCollected: 'GST_NOT_COLLECTED',
  paidBeforeApproval: 'PAID_BEFORE_APPROVAL',
  incompleteBilling: 'INCOMPLETE_BILLING_DETAILS',
  quoteMismatch: 'QUOTE_DOES_NOT_MATCH_PAYMENT',
  configurationMismatch: 'QUOTE_NOT_ON_APPROVED_CONFIGURATION',
  snapshotWithoutInvoice: 'SNAPSHOT_WITHOUT_INVOICE',
  // The approval was revoked or replaced after the job read it
  approvalChanged: 'APPROVAL_CHANGED',
} as const;

export type InvoiceIneligibleReason =
  (typeof INVOICE_INELIGIBLE)[keyof typeof INVOICE_INELIGIBLE];

export class InvoiceIneligibleError extends Error {
  readonly reason: InvoiceIneligibleReason;
  readonly details?: Record<string, unknown>;

  constructor(
    reason: InvoiceIneligibleReason,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'InvoiceIneligibleError';
    this.reason = reason;
    this.details = details;
  }
}

const textOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

type BillingDetails = {
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  name: string;
  email: string;
  mobile: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  pinCode: string;
  businessName: string | null;
  gstin: string | null;
  gstinStateCode: string | null;
};

// The customer's details exactly as given at checkout. Anything missing
// stops the invoice: nothing is ever filled in or guessed.
const billingDetailsOf = (payment: Row): BillingDetails => {
  const missing: string[] = [];
  const need = (column: string) => {
    const value = textOf(payment[column]);
    if (!value) {
      missing.push(column);
    }
    return value ?? '';
  };

  const customerType = payment.customer_type;
  if (customerType !== 'INDIVIDUAL' && customerType !== 'BUSINESS') {
    missing.push('customer_type');
  }
  const isBusiness = customerType === 'BUSINESS';

  const details: BillingDetails = {
    customerType: isBusiness ? 'BUSINESS' : 'INDIVIDUAL',
    name: need('billing_name'),
    email: need('billing_email'),
    mobile: need('billing_mobile'),
    addressLine1: need('address_line1'),
    addressLine2: textOf(payment.address_line2),
    city: need('billing_city'),
    state: need('billing_state'),
    stateCode: need('billing_state_code'),
    pinCode: need('pin_code'),
    businessName: isBusiness ? need('business_legal_name') : null,
    gstin: isBusiness ? need('gstin') : null,
    gstinStateCode: isBusiness ? need('gstin_state_code') : null,
  };

  if (missing.length > 0) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.incompleteBilling,
      `Payment ${String(payment.id)} is missing billing details: ${missing.join(', ')}`,
      { missing },
    );
  }
  return details;
};

// The quote must be the one this payment collected, for the same item and
// customer, on the approved configuration, and its total must be exactly
// the amount Razorpay captured
const assertQuoteMatchesPayment = (
  payment: Row,
  quote: TaxQuote,
  billing: BillingDetails,
  approval: TaxConfigurationApproval,
) => {
  const paymentId = String(payment.id);
  const collectedPaise = Number(payment.amount_paise);

  if (
    quote.sacCode !== approval.sacCode ||
    quote.gstRateBasisPoints !== approval.gstRateBasisPoints ||
    quote.pricingMode !== approval.pricingMode ||
    quote.calculationVersion !== approval.calculationVersion ||
    quote.roundingPolicy !== approval.roundingPolicy ||
    quote.supplierStateCode !== SUPPLIER_CONFIG.stateCode
  ) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.configurationMismatch,
      `The quote for payment ${paymentId} was not calculated on the approved tax configuration`,
    );
  }

  if (quote.status !== 'CONSUMED') {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.quoteMismatch,
      `The quote for payment ${paymentId} was never redeemed at checkout`,
    );
  }

  if (quote.totalAmountPaise !== collectedPaise) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.quoteMismatch,
      `The invoice would state ${quote.totalAmountPaise} paise but payment ${paymentId} collected ${collectedPaise} paise`,
      { quotedPaise: quote.totalAmountPaise, collectedPaise },
    );
  }

  const paidItemId =
    quote.itemType === 'BATCH' ? payment.item_batch_id : payment.item_topic_id;
  if (String(paidItemId ?? '') !== quote.itemId) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.quoteMismatch,
      `The quote for payment ${paymentId} is for a different item`,
    );
  }

  if (quote.customerType !== billing.customerType) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.quoteMismatch,
      `The quote for payment ${paymentId} is for a different customer type`,
    );
  }
};

/**
 * Issues the tax invoice and its snapshot for one paid payment, inside the
 * caller's transaction (number allocation, invoice and snapshot commit or
 * roll back together; the database also refuses to commit an invoice
 * without its snapshot).
 *
 * Requires an active approval, so it cannot be called before invoicing is
 * activated. Idempotent: an issued invoice is returned as it is. The amounts
 * are the GST the customer was quoted and paid, never recalculated on top of
 * the amount collected.
 */
export const issueInvoiceForPayment = async (
  tx: DatabaseClient,
  params: {
    paymentId: string;
    now: Date;
    approval: TaxConfigurationApproval;
  },
): Promise<IssueInvoiceResult> => {
  const { paymentId, now, approval } = params;

  // The approval is checked again inside this transaction, under a lock a
  // revocation must wait for, so no invoice is issued after a revocation
  await lockApprovalsForIssuance(tx);
  const current = await getInvoicingActivation(
    tx,
    { invoicingEnabled: true },
    now,
  );
  if (!current.active || current.approval.id !== approval.id) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.approvalChanged,
      'The tax configuration approval changed; invoicing stops until the job reads it again',
    );
  }

  const payment = await findPaymentForInvoiceUpdate(tx, paymentId);
  if (!payment) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.paymentNotFound,
      `Payment ${paymentId} does not exist`,
    );
  }

  const existingInvoice = await findInvoiceByPaymentId(tx, paymentId);
  const existingSnapshot = await findTaxSnapshotByPaymentId(tx, paymentId);
  if (existingInvoice && existingSnapshot) {
    return {
      invoice: existingInvoice,
      snapshot: existingSnapshot,
      created: false,
    };
  }
  if (existingSnapshot) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.snapshotWithoutInvoice,
      `Payment ${paymentId} has a tax snapshot but no invoice`,
    );
  }

  if (payment.status !== 'PAID') {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.notPaid,
      `Payment ${paymentId} is not paid`,
    );
  }
  if (payment.provider === 'TEST') {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.testPayment,
      `Payment ${paymentId} is a test-mode payment`,
    );
  }
  if (payment.tax_status !== 'QUOTED' || !payment.tax_quote_id) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.taxNotCollected,
      `Payment ${paymentId} did not collect GST (tax status ${String(payment.tax_status)})`,
    );
  }
  const paidAt = payment.paid_at
    ? new Date(toIsoTimestamp(payment.paid_at))
    : null;
  if (!paidAt || paidAt < new Date(approval.effectiveFrom)) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.paidBeforeApproval,
      `Payment ${paymentId} was paid before the approved tax configuration took effect`,
    );
  }

  const billing = billingDetailsOf(payment);

  const quote = await findTaxQuoteById(tx, String(payment.tax_quote_id));
  if (!quote) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.quoteMismatch,
      `The quote for payment ${paymentId} does not exist`,
    );
  }
  assertQuoteMatchesPayment(payment, quote, billing, approval);

  const placeOfSupply = determinePlaceOfSupply({
    customerType: billing.customerType,
    billingStateCode: billing.stateCode,
    gstinStateCode: billing.gstinStateCode,
  });
  assertTaxCalculationEligibility(placeOfSupply);

  // Cross-check: the quote must still be what the approved calculation
  // gives for this customer; the rates printed come from the same result
  const gst = calculateSriDhaGst({
    taxableAmountPaise: quote.taxableAmountPaise,
    placeOfSupplyStateCode: placeOfSupply.placeOfSupplyStateCode,
    customerType: billing.customerType,
  });
  if (
    gst.placeOfSupplyStateCode !== quote.placeOfSupplyStateCode ||
    gst.supplyType !== quote.supplyType ||
    gst.cgstPaise !== quote.cgstPaise ||
    gst.sgstPaise !== quote.sgstPaise ||
    gst.igstPaise !== quote.igstPaise ||
    gst.totalGstPaise !== quote.totalGstPaise ||
    gst.totalAmountPaise !== quote.totalAmountPaise
  ) {
    throw new InvoiceIneligibleError(
      INVOICE_INELIGIBLE.quoteMismatch,
      `The quote for payment ${paymentId} does not match the billing details paid with`,
    );
  }

  const nowIso = now.toISOString();
  const timeOfSupply = paidAt.toISOString();

  // An invoice row without a snapshot can only predate migration 018; it
  // keeps its number and is completed, so the sequence has no gap
  let invoice: Invoice;
  if (existingInvoice) {
    invoice = existingInvoice;
    logger.warn('invoices.completing_incomplete_invoice', {
      paymentId,
      invoiceNumber: existingInvoice.invoiceNumber,
    });
  } else {
    const allocation = await allocateInvoiceNumber(tx, now);
    invoice = {
      id: randomUUID(),
      invoiceNumber: allocation.invoiceNumber,
      paymentId,
      fiscalYear: allocation.fiscalYear,
      sequenceNumber: allocation.sequenceNumber,
      timeOfSupply,
      issuedAt: nowIso,
      status: 'ISSUED',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await insertInvoice(tx, { ...invoice, timestamp: nowIso });
  }

  const newSnapshot: NewTaxSnapshot = {
    id: randomUUID(),
    paymentId,
    invoiceId: invoice.id,
    quoteId: quote.id,
    supplierLegalName: SUPPLIER_CONFIG.legalName,
    supplierGstin: SUPPLIER_CONFIG.gstin,
    supplierStateCode: SUPPLIER_CONFIG.stateCode,
    supplierAddress: SUPPLIER_CONFIG.registeredAddress,
    recipientName: billing.name,
    recipientEmail: billing.email,
    recipientMobile: billing.mobile,
    recipientCustomerType: billing.customerType,
    recipientAddressLine1: billing.addressLine1,
    recipientAddressLine2: billing.addressLine2,
    recipientCity: billing.city,
    recipientState: billing.state,
    recipientStateCode: billing.stateCode,
    recipientPinCode: billing.pinCode,
    recipientBusinessName: billing.businessName,
    recipientGstin: billing.gstin,
    recipientGstinStateCode: billing.gstinStateCode,
    placeOfSupplyStateCode: quote.placeOfSupplyStateCode,
    supplyType: quote.supplyType,
    sacCode: quote.sacCode,
    pricingMode: 'EXCLUSIVE',
    taxableAmountPaise: quote.taxableAmountPaise,
    gstRateBasisPoints: quote.gstRateBasisPoints,
    cgstRateBasisPoints: gst.cgstRateBasisPoints,
    cgstPaise: quote.cgstPaise,
    sgstRateBasisPoints: gst.sgstRateBasisPoints,
    sgstPaise: quote.sgstPaise,
    igstRateBasisPoints: gst.igstRateBasisPoints,
    igstPaise: quote.igstPaise,
    totalGstPaise: quote.totalGstPaise,
    totalAmountPaise: quote.totalAmountPaise,
    calculationVersion: quote.calculationVersion,
    roundingPolicy: quote.roundingPolicy,
    timestamp: nowIso,
  };
  await insertTaxSnapshot(tx, newSnapshot);

  const { timestamp: _timestamp, ...snapshotFields } = newSnapshot;
  return {
    invoice,
    snapshot: { ...snapshotFields, createdAt: nowIso },
    created: true,
  };
};

// Issues one payment's invoice in a transaction of its own
export const issueInvoice = (
  context: Pick<AppContext, 'db' | 'now'>,
  approval: TaxConfigurationApproval,
  paymentId: string,
): Promise<IssueInvoiceResult> =>
  transaction(context.db, tx =>
    issueInvoiceForPayment(tx, { paymentId, now: context.now(), approval }),
  );

export type InvoiceReconciliationResult = {
  active: boolean;
  inactiveReason: string | null;
  // Invoices issued by this run
  processed: number;
  failed: number;
  // Payments waiting to retry after failed attempts
  deferred: number;
  // Invoices that still have no snapshot and need a person to review them
  incompleteInvoices: number;
  // Issued invoices whose amounts or tax status break the money rules
  // (only possible for invoices written before migrations 018/019)
  inconsistentInvoices: number;
};

const RECONCILIATION_BATCH = 50;

// Delay before retrying after the nth failure: 1h, 2h, 4h, 8h, 16h, then
// 24h at most (computed by the database from the stored attempt count)
export const ISSUANCE_RETRY_BASE_HOURS = 1;
export const ISSUANCE_RETRY_MAX_HOURS = 24;

/**
 * Issues the invoices that are due: paid payments that collected quoted
 * GST and have no snapshot yet, including an invoice row left incomplete
 * before migration 018. Each payment is its own transaction, so one
 * failure never leaves a partial invoice; a payment that fails backs off
 * and newer payments go first, so failures cannot block the queue. Does
 * nothing (apart from reporting invoices that need a person) until
 * invoicing is activated.
 */
export const reconcileMissingInvoices = async (
  context: Pick<AppContext, 'db' | 'now' | 'config'>,
  options: { limit?: number } = {},
): Promise<InvoiceReconciliationResult> => {
  const activation = await getInvoicingActivation(
    context.db,
    context.config,
    context.now(),
  );

  let processed = 0;
  let failed = 0;

  if (activation.active) {
    const paymentIds = await listPaymentIdsAwaitingInvoice(context.db, {
      effectiveFrom: activation.approval.effectiveFrom,
      now: context.now().toISOString(),
      limit: options.limit ?? RECONCILIATION_BATCH,
    });

    for (const paymentId of paymentIds) {
      try {
        const result = await issueInvoice(
          context,
          activation.approval,
          paymentId,
        );
        await clearIssuanceFailure(context.db, paymentId);
        if (result.created) processed++;
      } catch (error) {
        failed++;
        const reason =
          error instanceof InvoiceIneligibleError ? error.reason : null;
        const message = error instanceof Error ? error.message : String(error);
        await recordIssuanceFailure(context.db, {
          paymentId,
          reason,
          error: message.slice(0, 500),
          at: context.now().toISOString(),
          baseDelayHours: ISSUANCE_RETRY_BASE_HOURS,
          maxDelayHours: ISSUANCE_RETRY_MAX_HOURS,
        });
        logger.error('invoices.reconciliation_failed', {
          paymentId,
          reason: reason ?? undefined,
          error: message,
        });
        if (reason === INVOICE_INELIGIBLE.approvalChanged) break;
      }
    }
  }

  const incomplete = await listInvoicesWithoutSnapshot(context.db);
  if (incomplete.length > 0) {
    logger.error('invoices.incomplete_requires_review', {
      count: incomplete.length,
      invoiceNumbers: incomplete.map(item => item.invoiceNumber),
    });
  }
  const inconsistent = await listInvoicesBreakingInvariants(context.db);
  if (inconsistent.length > 0) {
    logger.error('invoices.inconsistent_requires_review', {
      count: inconsistent.length,
      invoiceNumbers: inconsistent,
    });
  }

  return {
    active: activation.active,
    inactiveReason: activation.active ? null : activation.reason,
    processed,
    failed,
    deferred: await countDeferredIssuances(
      context.db,
      context.now().toISOString(),
    ),
    incompleteInvoices: incomplete.length,
    inconsistentInvoices: inconsistent.length,
  };
};
