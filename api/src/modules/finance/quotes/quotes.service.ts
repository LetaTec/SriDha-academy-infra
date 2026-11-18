import { createHash, randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AppContext } from '../../../app/context.js';
import type {
  TaxQuote,
  TaxQuoteRequestBody,
} from '../../../contracts/finance.js';
import type { DatabaseClient } from '../../../db/client.js';
import { ApiError, ERROR_CODE } from '../../../http/errors.js';
import { emailSchema } from '../../auth/auth.schema.js';
import { checkGstin } from '../gstin.js';
import { calculateSriDhaGst } from '../gst/gst.calculator.js';
import { DEFAULT_TAX_CONFIG } from '../gst/gst.config.js';
import { determinePlaceOfSupply } from '../gst/gst.placeOfSupply.js';
import { GST_STATE_CODE, INDIAN_STATES } from '../../payments/indianStates.js';
import {
  findBatchForPurchase,
  findTopicForPreRegistration,
} from '../../payments/payments.repository.js';
import { assertTaxCalculationEligibility } from '../tax/tax.eligibility.js';
import {
  consumeTaxQuote,
  findActiveTaxQuoteByKey,
  findTaxQuoteRowForUpdate,
  insertTaxQuote,
  type NewTaxQuote,
} from './quotes.repository.js';

export const taxQuoteRequestSchema = z
  .strictObject({
    itemType: z.enum(['TOPIC', 'BATCH']),
    itemId: z.string().trim().min(1).max(150),
    customerType: z.enum(['INDIVIDUAL', 'BUSINESS']),
    customerEmail: emailSchema,
    addressLine1: z.string().trim().min(3).max(200),
    addressLine2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2).max(80),
    state: z.enum(INDIAN_STATES, 'Select your state'),
    pinCode: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{5}$/, 'Enter the 6-digit PIN code'),
    businessLegalName: z.string().trim().max(200).optional(),
    gstin: z.string().max(30).optional(),
    isSez: z.boolean().optional(),
    isForeignRecipient: z.boolean().optional(),
    hasMultipleRegistrations: z.boolean().optional(),
    receivingEstablishmentUnclear: z.boolean().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.customerType === 'INDIVIDUAL') {
      if (input.businessLegalName !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['businessLegalName'],
          message: 'Only a business purchase has this',
        });
      }
      if (input.gstin !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['gstin'],
          message: 'Only a business purchase has this',
        });
      }
      return;
    }

    if (!input.businessLegalName || input.businessLegalName.trim().length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['businessLegalName'],
        message: "Enter the business's legal name",
      });
    }

    if (!input.gstin?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['gstin'],
        message: 'Enter the GSTIN',
      });
      return;
    }

    const gstin = checkGstin(input.gstin);
    if (!gstin.valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['gstin'],
        message: 'Invalid GSTIN format or checksum',
      });
    } else if (gstin.state !== input.state) {
      ctx.addIssue({
        code: 'custom',
        path: ['gstin'],
        message: `This GSTIN is registered in ${gstin.state}. Choose ${gstin.state} as the billing state, or check the GSTIN`,
      });
    }
  }) satisfies z.ZodType<TaxQuoteRequestBody>;

export type TaxQuoteInput = z.infer<typeof taxQuoteRequestSchema>;

const QUOTE_VALIDITY_MS = 30 * 60 * 1000; // 30 minutes

const requireCataloguePrice = (pricePaise: unknown): number => {
  const amount = Number(pricePaise);
  if (pricePaise === null || !Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(
      409,
      ERROR_CODE.priceUnavailable,
      'This topic or batch does not have a fee yet',
    );
  }
  return amount;
};

// Binds a quote to who asked (user id, or the billing email for a guest),
// the item, the catalogue price and the billing details that decide tax
const computeQuoteKey = (params: {
  identityAnchor: string;
  itemType: 'TOPIC' | 'BATCH';
  itemId: string;
  cataloguePricePaise: number;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  billingStateCode: string;
  pinCode: string;
  gstin: string | null;
}) => {
  const canonicalBilling = JSON.stringify({
    customerType: params.customerType,
    stateCode: params.billingStateCode,
    pinCode: params.pinCode,
    gstin: params.gstin,
  });
  return createHash('sha256')
    .update(
      `${params.identityAnchor}:${params.itemType}:${params.itemId}:${params.cataloguePricePaise}:${canonicalBilling}`,
    )
    .digest('hex');
};

export type TaxQuoteRedemption = {
  quoteId: string;
  // The signed-in user at checkout, if any, and the billing email given
  userId: string | null;
  customerEmail: string;
  itemType: 'TOPIC' | 'BATCH';
  itemId: string;
  // The catalogue price the server reads at checkout time
  cataloguePricePaise: number;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  billingStateCode: string;
  pinCode: string;
  // Normalised GSTIN for a business, otherwise null
  gstin: string | null;
  now: Date;
};

/**
 * Redeems a quote at checkout, inside the checkout transaction: the quote
 * is locked, must belong to this customer, be unexpired and unused, be for
 * this item at today's catalogue price, match the billing details and the
 * current tax configuration; then it is marked used, once. The amount to
 * charge is the returned quote's totalAmountPaise.
 *
 * Not wired into checkout yet: charging GST changes the live price, which
 * waits for the CA approval and INVOICING_ENABLED (see DECISION.md).
 */
export const redeemTaxQuote = async (
  tx: DatabaseClient,
  redemption: TaxQuoteRedemption,
): Promise<TaxQuote> => {
  const row = await findTaxQuoteRowForUpdate(tx, redemption.quoteId);
  const email = redemption.customerEmail.trim().toLowerCase();

  // Someone else's quote is reported exactly like a missing one
  const ownedByCaller =
    row !== null &&
    String(row.customer_email) === email &&
    (row.user_id === null || String(row.user_id) === redemption.userId);
  if (!row || !ownedByCaller) {
    throw new ApiError(
      404,
      ERROR_CODE.taxQuoteNotFound,
      'This price quote was not found',
    );
  }

  if (row.status === 'CONSUMED') {
    throw new ApiError(
      409,
      ERROR_CODE.taxQuoteAlreadyUsed,
      'This price quote has already been used',
    );
  }
  if (
    row.status !== 'ACTIVE' ||
    new Date(String(row.expires_at)) <= redemption.now
  ) {
    throw new ApiError(
      409,
      ERROR_CODE.taxQuoteExpired,
      'This price quote has expired. Please review the price again',
    );
  }

  const expectedKey = computeQuoteKey({
    identityAnchor:
      row.user_id === null ? String(row.customer_email) : String(row.user_id),
    itemType: redemption.itemType,
    itemId: redemption.itemId,
    cataloguePricePaise: redemption.cataloguePricePaise,
    customerType: redemption.customerType,
    billingStateCode: redemption.billingStateCode,
    pinCode: redemption.pinCode,
    gstin: redemption.gstin,
  });
  const onCurrentConfiguration =
    String(row.sac_code) === DEFAULT_TAX_CONFIG.sacCode &&
    Number(row.gst_rate_basis_points) ===
      DEFAULT_TAX_CONFIG.gstRateBasisPoints &&
    String(row.calculation_version) === DEFAULT_TAX_CONFIG.calculationVersion &&
    String(row.rounding_policy) === DEFAULT_TAX_CONFIG.roundingPolicy;
  if (
    String(row.quote_key) !== expectedKey ||
    Number(row.taxable_amount_paise) !== redemption.cataloguePricePaise ||
    !onCurrentConfiguration
  ) {
    throw new ApiError(
      409,
      ERROR_CODE.taxQuoteMismatch,
      'The price or billing details have changed since this quote. Please review the price again',
    );
  }

  const consumed = await consumeTaxQuote(
    tx,
    redemption.quoteId,
    redemption.now.toISOString(),
  );
  if (!consumed) {
    throw new ApiError(
      409,
      ERROR_CODE.taxQuoteAlreadyUsed,
      'This price quote has already been used',
    );
  }
  return consumed;
};

/**
 * Creates a server-controlled, deterministic tax quote bound to the customer
 * and server-derived price. Rejects client-supplied prices or untrusted tax rates.
 */
export const createTaxQuote = async (
  context: Pick<AppContext, 'db' | 'now'>,
  input: TaxQuoteInput,
  options?: { userId?: string | null },
): Promise<TaxQuote> => {
  // 1. Fetch trusted catalogue base price from server DB
  let cataloguePricePaise: number;
  if (input.itemType === 'BATCH') {
    const batch = await findBatchForPurchase(context.db, input.itemId);
    if (!batch) {
      throw new ApiError(404, ERROR_CODE.batchNotFound, 'Batch not found');
    }
    cataloguePricePaise = requireCataloguePrice(batch.t_price_paise);
  } else {
    const topic = await findTopicForPreRegistration(context.db, input.itemId);
    if (!topic) {
      throw new ApiError(404, ERROR_CODE.topicNotFound, 'Topic not found');
    }
    cataloguePricePaise = requireCataloguePrice(topic.t_price_paise);
  }

  // 2. Place of Supply determination
  const billingStateCode = GST_STATE_CODE[input.state];
  const checkedGstin =
    input.customerType === 'BUSINESS' && input.gstin
      ? checkGstin(input.gstin)
      : null;
  const normalizedGstin = checkedGstin?.valid ? checkedGstin.gstin : null;
  const gstinStateCode = checkedGstin?.valid ? checkedGstin.stateCode : null;

  const posResult = determinePlaceOfSupply({
    customerType: input.customerType,
    billingStateCode,
    gstinStateCode,
    isSez: input.isSez,
    isForeignRecipient: input.isForeignRecipient,
    hasMultipleRegistrations: input.hasMultipleRegistrations,
    receivingEstablishmentUnclear: input.receivingEstablishmentUnclear,
  });

  // 3. Statutory Calculation Eligibility Gate
  // Rejects SEZ, foreign cross-border, missing address, or ambiguous establishments
  assertTaxCalculationEligibility(posResult);

  // 4. Deterministic GST calculation using locked SriDha legal configuration
  const gstResult = calculateSriDhaGst({
    taxableAmountPaise: cataloguePricePaise,
    placeOfSupplyStateCode: posResult.placeOfSupplyStateCode,
    customerType: input.customerType,
  });

  // 5. Canonical Quote Key (binds customer, item, catalogue price, and canonical billing)
  const quoteKey = computeQuoteKey({
    identityAnchor: options?.userId ?? input.customerEmail.toLowerCase().trim(),
    itemType: input.itemType,
    itemId: input.itemId,
    cataloguePricePaise,
    customerType: input.customerType,
    billingStateCode,
    pinCode: input.pinCode,
    gstin: normalizedGstin,
  });

  const now = context.now();
  const nowIso = now.toISOString();

  // 6. Check for existing active quote
  const existingQuote = await findActiveTaxQuoteByKey(
    context.db,
    quoteKey,
    nowIso,
  );
  if (existingQuote) {
    return existingQuote;
  }

  // 7. Insert new quote
  const expiresAt = new Date(now.getTime() + QUOTE_VALIDITY_MS).toISOString();
  const quoteId = randomUUID();

  const newQuote: NewTaxQuote = {
    id: quoteId,
    quoteKey,
    userId: options?.userId ?? null,
    customerEmail: input.customerEmail.toLowerCase().trim(),
    itemType: input.itemType,
    itemId: input.itemId,
    customerType: input.customerType,
    taxableAmountPaise: gstResult.taxableAmountPaise,
    gstRateBasisPoints: gstResult.gstRateBasisPoints,
    cgstPaise: gstResult.cgstPaise,
    sgstPaise: gstResult.sgstPaise,
    igstPaise: gstResult.igstPaise,
    totalGstPaise: gstResult.totalGstPaise,
    totalAmountPaise: gstResult.totalAmountPaise,
    supplierStateCode: gstResult.supplierStateCode,
    placeOfSupplyStateCode: gstResult.placeOfSupplyStateCode,
    supplyType: gstResult.supplyType,
    sacCode: gstResult.sacCode,
    pricingMode: 'EXCLUSIVE',
    calculationVersion: gstResult.calculationVersion,
    roundingPolicy: gstResult.roundingPolicy,
    expiresAt,
    timestamp: nowIso,
  };

  await insertTaxQuote(context.db, newQuote);

  return {
    id: quoteId,
    quoteKey,
    itemType: input.itemType,
    itemId: input.itemId,
    customerType: input.customerType,
    taxableAmountPaise: gstResult.taxableAmountPaise,
    gstRateBasisPoints: gstResult.gstRateBasisPoints,
    cgstPaise: gstResult.cgstPaise,
    sgstPaise: gstResult.sgstPaise,
    igstPaise: gstResult.igstPaise,
    totalGstPaise: gstResult.totalGstPaise,
    totalAmountPaise: gstResult.totalAmountPaise,
    supplierStateCode: gstResult.supplierStateCode,
    placeOfSupplyStateCode: gstResult.placeOfSupplyStateCode,
    supplyType: gstResult.supplyType,
    sacCode: gstResult.sacCode,
    pricingMode: 'EXCLUSIVE',
    calculationVersion: gstResult.calculationVersion,
    roundingPolicy: gstResult.roundingPolicy,
    status: 'ACTIVE',
    expiresAt,
    createdAt: nowIso,
  };
};
