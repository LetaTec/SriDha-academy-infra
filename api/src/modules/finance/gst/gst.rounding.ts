/**
 * Monetary Precision and Rounding Policy:
 *
 * All calculations use BigInt integer arithmetic to prevent floating-point
 * IEEE-754 drift.
 *
 * Tax rates are represented in integer basis points:
 * 1 basis point = 0.01% = 1 / 10,000.
 *
 * Rounding policy: HALF_UP_COMPONENT_SUM
 * 1. Line tax components (CGST and SGST for intra-state, or IGST for inter-state)
 *    are computed independently and rounded half-up to the nearest integer paisa:
 *    (numerator + (denominator / 2)) / denominator
 * 2. Total GST is the exact sum of the rounded components:
 *    Intra-state: totalGstPaise = cgstPaise + sgstPaise
 *    Inter-state: totalGstPaise = igstPaise
 * 3. Total amount is the exact sum of taxable amount and total GST:
 *    totalAmountPaise = taxableAmountPaise + totalGstPaise
 *
 * This policy guarantees:
 * - CGST === SGST for equal split rates without jurisdictional bias.
 * - cgstPaise + sgstPaise === totalGstPaise (zero component-sum discrepancy).
 * - taxableAmountPaise + totalGstPaise === totalAmountPaise (zero total discrepancy).
 * - Exact reproducibility across all platforms.
 */

import { GST_ERROR_CODE, GstCalculationError } from './gst.types.js';

export const BASIS_POINTS_DIVISOR = 10000n;

/**
 * Rounds (numerator / denominator) half-up to the nearest integer.
 * In integer division for non-negative numbers:
 * (numerator + (denominator / 2n)) / denominator
 */
export const roundHalfUp = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= 0n) {
    throw new RangeError('Denominator must be positive');
  }
  if (numerator < 0n) {
    throw new RangeError('Numerator must be non-negative');
  }
  return (numerator + denominator / 2n) / denominator;
};

/**
 * Computes tax amount in integer paise from taxable amount (in paise)
 * and rate (in basis points). Validates inputs and guards against safe-integer
 * overflow.
 */
export const computeTaxPaise = (
  taxableAmountPaise: number,
  rateBasisPoints: number,
): number => {
  if (
    typeof taxableAmountPaise !== 'number' ||
    !Number.isSafeInteger(taxableAmountPaise) ||
    taxableAmountPaise < 0
  ) {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidTaxableAmount,
      'Taxable amount must be a non-negative safe integer in paise',
      { taxableAmountPaise },
    );
  }

  if (
    typeof rateBasisPoints !== 'number' ||
    !Number.isSafeInteger(rateBasisPoints) ||
    rateBasisPoints < 0 ||
    rateBasisPoints > 10000
  ) {
    throw new GstCalculationError(
      GST_ERROR_CODE.invalidGstRate,
      'GST rate must be a safe integer between 0 and 10000 basis points (0% to 100%)',
      { rateBasisPoints },
    );
  }

  const numerator = BigInt(taxableAmountPaise) * BigInt(rateBasisPoints);
  const taxBigInt = roundHalfUp(numerator, BASIS_POINTS_DIVISOR);

  if (
    taxBigInt > BigInt(Number.MAX_SAFE_INTEGER) ||
    BigInt(taxableAmountPaise) + taxBigInt > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new GstCalculationError(
      GST_ERROR_CODE.monetaryOverflow,
      'Calculated monetary amount exceeds JavaScript safe integer limit',
      { taxableAmountPaise, rateBasisPoints },
    );
  }

  return Number(taxBigInt);
};
