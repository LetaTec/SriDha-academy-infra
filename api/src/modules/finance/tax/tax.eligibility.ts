import type { PlaceOfSupplyDeterminationResult } from '../gst/gst.placeOfSupply.js';

export type TaxCalculationEligibility =
  | 'ELIGIBLE_DOMESTIC'
  | 'UNSUPPORTED_CROSS_BORDER'
  | 'UNSUPPORTED_SEZ'
  | 'BLOCKED_MISSING_ADDRESS'
  | 'BLOCKED_AMBIGUOUS_ESTABLISHMENT';

export class TaxEligibilityError extends Error {
  readonly eligibility: TaxCalculationEligibility;
  readonly details?: Record<string, unknown>;

  constructor(
    eligibility: TaxCalculationEligibility,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TaxEligibilityError';
    this.eligibility = eligibility;
    this.details = details;
  }
}

/**
 * Statutory calculation eligibility gate.
 *
 * Verifies that a transaction is legally eligible for ordinary domestic GST
 * calculation before invoking the calculation engine.
 *
 * Rejects with explicit errors:
 * - Foreign recipients (Section 13 IGST Act / OIDAR / Export)
 * - SEZ developer or units (Section 7(5)(b) & Section 16 zero-rating)
 * - Missing recipient billing address
 * - Ambiguous B2B multi-establishment receiving locations
 *
 * Only transactions satisfying all domestic statutory conditions proceed to
 * `calculateSriDhaGst()`.
 */
export const assertTaxCalculationEligibility = (
  pos: PlaceOfSupplyDeterminationResult,
): 'ELIGIBLE_DOMESTIC' => {
  if (
    pos.ruleApplied === 'CROSS_BORDER_EXPORT_OR_OIDAR' ||
    pos.reviewReasons.includes('FOREIGN_RECIPIENT_REQUIRING_CA_VALIDATION')
  ) {
    throw new TaxEligibilityError(
      'UNSUPPORTED_CROSS_BORDER',
      'Cross-border services under Section 13 IGST Act require formal CA export/OIDAR approval before calculation',
      {
        placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
        reviewReasons: pos.reviewReasons,
      },
    );
  }

  if (
    pos.ruleApplied === 'SEZ_ZERO_RATED_INTER_STATE' ||
    pos.reviewReasons.includes('SEZ_UNIT_REQUIRING_CA_VALIDATION')
  ) {
    throw new TaxEligibilityError(
      'UNSUPPORTED_SEZ',
      'Supplies to SEZ units require verified authorized operations documentation and CA zero-rating approval',
      {
        placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
        reviewReasons: pos.reviewReasons,
      },
    );
  }

  if (
    pos.ruleApplied === 'SUPPLIER_LOCATION_FALLBACK' ||
    pos.reviewReasons.includes('MISSING_RECIPIENT_ADDRESS')
  ) {
    throw new TaxEligibilityError(
      'BLOCKED_MISSING_ADDRESS',
      'Cannot calculate tax without recipient billing address on record',
      {
        placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
        reviewReasons: pos.reviewReasons,
      },
    );
  }

  if (
    pos.reviewReasons.includes('POTENTIAL_MULTI_ESTABLISHMENT') ||
    pos.reviewReasons.includes('UNCLEAR_RECEIVING_ESTABLISHMENT')
  ) {
    throw new TaxEligibilityError(
      'BLOCKED_AMBIGUOUS_ESTABLISHMENT',
      'B2B recipient has multiple establishments; establishment receiving service must be unambiguously resolved',
      {
        placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
        reviewReasons: pos.reviewReasons,
      },
    );
  }

  return 'ELIGIBLE_DOMESTIC';
};
