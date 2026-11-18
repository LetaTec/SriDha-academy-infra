import { stateForGstStateCode } from '../../payments/indianStates.js';
import { DEFAULT_TAX_CONFIG, SUPPLIER_CONFIG } from './gst.config.js';
import { computeTaxPaise } from './gst.rounding.js';
import {
  GST_ERROR_CODE,
  GstCalculationError,
  type CanonicalCustomerType,
  type CustomerType,
  type GstCalculationInput,
  type GstCalculationResult,
  type SupplyType,
} from './gst.types.js';

const SAC_CODE_PATTERN = /^[0-9]{6}$/;

/**
 * Normalizes customer type to canonical representation:
 * INDIVIDUAL (B2C) or BUSINESS (B2B).
 */
export const normalizeCustomerType = (raw: unknown): CanonicalCustomerType => {
  if (typeof raw !== 'string') {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidCustomerType,
      'Customer type must be INDIVIDUAL (B2C) or BUSINESS (B2B)',
      { customerType: raw },
    );
  }

  const normalized = raw.trim().toUpperCase();
  if (normalized === 'INDIVIDUAL' || normalized === 'B2C') {
    return 'INDIVIDUAL';
  }
  if (normalized === 'BUSINESS' || normalized === 'B2B') {
    return 'BUSINESS';
  }

  throw new GstCalculationError(
    GST_ERROR_CODE.invalidCustomerType,
    'Customer type must be INDIVIDUAL (B2C) or BUSINESS (B2B)',
    { customerType: raw },
  );
};

/**
 * Validates a 2-digit Indian GST state code (01–38, plus legacy 25 & 28).
 */
export const validateGstStateCode = (
  code: unknown,
  fieldName: 'supplierStateCode' | 'placeOfSupplyStateCode',
): string => {
  if (typeof code !== 'string') {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidStateCode,
      `${fieldName} must be a 2-digit GST state code string`,
      { [fieldName]: code },
    );
  }

  const trimmed = code.trim();
  const state = stateForGstStateCode(trimmed);
  if (!state) {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidStateCode,
      `${fieldName} '${trimmed}' is not a recognized Indian GST state code`,
      { [fieldName]: trimmed },
    );
  }

  return trimmed;
};

/**
 * Classifies supply as INTRA_STATE or INTER_STATE based on supplier
 * and place-of-supply state codes.
 */
export const classifySupplyType = (
  supplierStateCode: string,
  placeOfSupplyStateCode: string,
): SupplyType => {
  return supplierStateCode === placeOfSupplyStateCode
    ? 'INTRA_STATE'
    : 'INTER_STATE';
};

/**
 * Validates calculation input parameters.
 */
export const validateGstInput = (
  input: GstCalculationInput,
): {
  taxableAmountPaise: number;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  customerType: CanonicalCustomerType;
  sacCode: string;
  gstRateBasisPoints: number;
  supplyType: SupplyType;
} => {
  if (!input || typeof input !== 'object') {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidTaxableAmount,
      'Calculation input must be an object',
    );
  }

  // 1. Taxable amount validation
  if (
    typeof input.taxableAmountPaise !== 'number' ||
    !Number.isSafeInteger(input.taxableAmountPaise) ||
    input.taxableAmountPaise <= 0
  ) {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidTaxableAmount,
      'Taxable amount must be a positive safe integer in paise',
      { taxableAmountPaise: input.taxableAmountPaise },
    );
  }

  // 2. Pricing mode validation (only EXCLUSIVE supported in Phase 1/Milestone 5)
  if (input.pricingMode === 'INCLUSIVE') {
    throw new GstCalculationError(
      GST_ERROR_CODE.unsupportedPricingMode,
      'Inclusive pricing mode is currently unsupported. All catalogue prices are GST-exclusive',
      { pricingMode: input.pricingMode },
    );
  }
  if (input.pricingMode !== 'EXCLUSIVE') {
    throw new GstCalculationError(
      GST_ERROR_CODE.unsupportedPricingMode,
      'Pricing mode must be EXCLUSIVE',
      { pricingMode: input.pricingMode },
    );
  }

  // 3. State codes validation
  const supplierStateCode = validateGstStateCode(
    input.supplierStateCode,
    'supplierStateCode',
  );
  const placeOfSupplyStateCode = validateGstStateCode(
    input.placeOfSupplyStateCode,
    'placeOfSupplyStateCode',
  );

  // 4. Rate validation
  if (
    typeof input.gstRateBasisPoints !== 'number' ||
    !Number.isSafeInteger(input.gstRateBasisPoints) ||
    input.gstRateBasisPoints < 0 ||
    input.gstRateBasisPoints > 10000
  ) {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidGstRate,
      'GST rate must be a safe integer between 0 and 10000 basis points (0% to 100%)',
      { gstRateBasisPoints: input.gstRateBasisPoints },
    );
  }

  // 5. Supply type classification
  const supplyType = classifySupplyType(
    supplierStateCode,
    placeOfSupplyStateCode,
  );

  // 6. Intra-state rate parity check
  if (supplyType === 'INTRA_STATE' && input.gstRateBasisPoints % 2 !== 0) {
    throw new GstCalculationError(
      GST_ERROR_CODE.oddIntraStateRate,
      'Intra-state GST rate in basis points must be divisible by 2 to split equally into CGST and SGST',
      { gstRateBasisPoints: input.gstRateBasisPoints },
    );
  }

  // 7. SAC code validation (6 digits)
  if (
    typeof input.sacCode !== 'string' ||
    !SAC_CODE_PATTERN.test(input.sacCode.trim())
  ) {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidSacCode,
      'SAC code must be a 6-digit numeric string',
      { sacCode: input.sacCode },
    );
  }

  // 8. Customer type validation
  const customerType = normalizeCustomerType(input.customerType);

  return {
    taxableAmountPaise: input.taxableAmountPaise,
    supplierStateCode,
    placeOfSupplyStateCode,
    customerType,
    sacCode: input.sacCode.trim(),
    gstRateBasisPoints: input.gstRateBasisPoints,
    supplyType,
  };
};

/**
 * Pure, deterministic GST Calculation Engine.
 *
 * Implements:
 * - Integer paise arithmetic with BigInt precision
 * - Basis points representation of rates (1 bp = 0.01%)
 * - Deterministic HALF_UP_COMPONENT_SUM rounding
 * - Intra-state (CGST + SGST) and Inter-state (IGST) taxation
 * - Complete immutable snapshot output suitable for future invoices
 */
export const calculateGst = (
  input: GstCalculationInput,
): GstCalculationResult => {
  const validated = validateGstInput(input);

  let cgstRateBasisPoints = 0;
  let cgstPaise = 0;
  let sgstRateBasisPoints = 0;
  let sgstPaise = 0;
  let igstRateBasisPoints = 0;
  let igstPaise = 0;
  let totalGstPaise = 0;

  if (validated.supplyType === 'INTRA_STATE') {
    cgstRateBasisPoints = validated.gstRateBasisPoints / 2;
    sgstRateBasisPoints = validated.gstRateBasisPoints / 2;
    cgstPaise = computeTaxPaise(
      validated.taxableAmountPaise,
      cgstRateBasisPoints,
    );
    sgstPaise = computeTaxPaise(
      validated.taxableAmountPaise,
      sgstRateBasisPoints,
    );
    const totalGstBigInt = BigInt(cgstPaise) + BigInt(sgstPaise);
    if (totalGstBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new GstCalculationError(
        GST_ERROR_CODE.monetaryOverflow,
        'Total GST exceeds JavaScript safe integer limit',
        { cgstPaise, sgstPaise },
      );
    }
    totalGstPaise = Number(totalGstBigInt);
  } else {
    igstRateBasisPoints = validated.gstRateBasisPoints;
    igstPaise = computeTaxPaise(
      validated.taxableAmountPaise,
      igstRateBasisPoints,
    );
    totalGstPaise = igstPaise;
  }

  const totalAmountBigInt =
    BigInt(validated.taxableAmountPaise) + BigInt(totalGstPaise);
  if (totalAmountBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new GstCalculationError(
      GST_ERROR_CODE.monetaryOverflow,
      'Total amount exceeds JavaScript safe integer limit',
      {
        taxableAmountPaise: validated.taxableAmountPaise,
        totalGstPaise,
      },
    );
  }
  const totalAmountPaise = Number(totalAmountBigInt);

  return {
    taxableAmountPaise: validated.taxableAmountPaise,
    gstRateBasisPoints: validated.gstRateBasisPoints,
    totalGstPaise,
    cgstRateBasisPoints,
    cgstPaise,
    sgstRateBasisPoints,
    sgstPaise,
    igstRateBasisPoints,
    igstPaise,
    totalAmountPaise,
    supplierStateCode: validated.supplierStateCode,
    placeOfSupplyStateCode: validated.placeOfSupplyStateCode,
    supplyType: validated.supplyType,
    customerType: validated.customerType,
    sacCode: validated.sacCode,
    pricingMode: 'EXCLUSIVE',
    calculationVersion: DEFAULT_TAX_CONFIG.calculationVersion,
    roundingPolicy: DEFAULT_TAX_CONFIG.roundingPolicy,
  };
};

export type SriDhaGstParams = {
  taxableAmountPaise: number;
  placeOfSupplyStateCode: string;
  customerType: CustomerType;
};

/**
 * Calculates GST using SriDha Academy's server-controlled legal configuration
 * (LETATEC AI TECHNOLOGIES PRIVATE LIMITED, Rajasthan 08, SAC 999293, 18% GST).
 * Overrides of SAC or GST rate are strictly prohibited in SriDha billing.
 */
export const calculateSriDhaGst = (
  params: SriDhaGstParams,
): GstCalculationResult => {
  return calculateGst({
    taxableAmountPaise: params.taxableAmountPaise,
    supplierStateCode: SUPPLIER_CONFIG.stateCode,
    placeOfSupplyStateCode: params.placeOfSupplyStateCode,
    customerType: params.customerType,
    sacCode: DEFAULT_TAX_CONFIG.sacCode,
    gstRateBasisPoints: DEFAULT_TAX_CONFIG.gstRateBasisPoints,
    pricingMode: DEFAULT_TAX_CONFIG.pricingMode,
  });
};
