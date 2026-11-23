import type { IndianState } from '../../../contracts/payments.js';
import { stateForGstStateCode } from '../../payments/indianStates.js';
import {
  normalizeCustomerType,
  validateGstStateCode,
} from './gst.calculator.js';
import { SUPPLIER_CONFIG } from './gst.config.js';
import type { CustomerType } from './gst.types.js';

export type PlaceOfSupplyDeterminationRule =
  | 'B2B_GSTIN_REGISTRATION_STATE'
  | 'B2C_BILLING_ADDRESS_STATE'
  | 'SUPPLIER_LOCATION_FALLBACK'
  | 'SEZ_ZERO_RATED_INTER_STATE'
  | 'CROSS_BORDER_EXPORT_OR_OIDAR';

export type PlaceOfSupplyReviewReason =
  | 'GSTIN_BILLING_STATE_MISMATCH'
  | 'UNREGISTERED_BUSINESS'
  | 'POTENTIAL_MULTI_ESTABLISHMENT'
  | 'UNCLEAR_RECEIVING_ESTABLISHMENT'
  | 'SEZ_UNIT_REQUIRING_CA_VALIDATION'
  | 'FOREIGN_RECIPIENT_REQUIRING_CA_VALIDATION'
  | 'MISSING_RECIPIENT_ADDRESS';

export type PlaceOfSupplyDeterminationInput = {
  customerType: CustomerType;
  billingStateCode?: string | null;
  gstinStateCode?: string | null;
  isSez?: boolean;
  isForeignRecipient?: boolean;
  hasMultipleRegistrations?: boolean;
  receivingEstablishmentUnclear?: boolean;
};

export type PlaceOfSupplyDeterminationResult = {
  placeOfSupplyStateCode: string;
  state: IndianState;
  ruleApplied: PlaceOfSupplyDeterminationRule;
  caReviewRequired: boolean;
  reviewReasons: PlaceOfSupplyReviewReason[];
  notes: string;
};

/**
 * Determines the legal Place of Supply (POS) under Section 12 of the IGST Act, 2017:
 *
 * Statutory Framework:
 * - Section 12(2)(a): For B2B supplies to a registered person, POS is the location
 *   of the registered recipient (the establishment directly concerned with receiving
 *   the service, per Section 2(15) of the IGST Act).
 * - Section 12(2)(b)(i): For B2C supplies to an unregistered person where recipient
 *   address is on record, POS is the recipient's location (billing state).
 * - Section 12(2)(b)(ii): Fallback to supplier location only when no recipient address
 *   exists on record.
 * - Section 7(5)(b) & Section 16: Supplies to SEZ developer/unit are treated as inter-state
 *   zero-rated supplies, requiring authorized operations certification.
 * - Section 13: Cross-border supplies where recipient is outside India.
 *
 * NOTE: This module performs initial domestic determination and flags statutory edge cases
 * (multiple registrations, unclear receiving establishment, SEZ, cross-border, unregistered
 * business) for Chartered Accountant review under Decision C5.
 */
export const determinePlaceOfSupply = (
  input: PlaceOfSupplyDeterminationInput,
): PlaceOfSupplyDeterminationResult => {
  const customerType = normalizeCustomerType(input.customerType);
  const reviewReasons: PlaceOfSupplyReviewReason[] = [];

  // 1. Edge Case: Foreign Recipient (Cross-border / Export / OIDAR under Section 13 IGST Act)
  if (input.isForeignRecipient) {
    reviewReasons.push('FOREIGN_RECIPIENT_REQUIRING_CA_VALIDATION');
    const supplierState = stateForGstStateCode(SUPPLIER_CONFIG.stateCode)!;
    return {
      placeOfSupplyStateCode: SUPPLIER_CONFIG.stateCode,
      state: supplierState,
      ruleApplied: 'CROSS_BORDER_EXPORT_OR_OIDAR',
      caReviewRequired: true,
      reviewReasons,
      notes:
        'Recipient located outside India; statutory determination under Section 13 IGST Act (export zero-rating vs OIDAR) requires CA validation',
    };
  }

  // 2. Edge Case: SEZ Developer or Unit (Section 7(5)(b) and Section 16 IGST Act)
  if (input.isSez) {
    reviewReasons.push('SEZ_UNIT_REQUIRING_CA_VALIDATION');
    // If billing state or GSTIN state is provided, use it; otherwise fallback to supplier state
    const rawTargetState =
      input.gstinStateCode ||
      input.billingStateCode ||
      SUPPLIER_CONFIG.stateCode;
    const posStateCode = validateGstStateCode(
      rawTargetState,
      'placeOfSupplyStateCode',
    );
    const state = stateForGstStateCode(posStateCode)!;
    return {
      placeOfSupplyStateCode: posStateCode,
      state,
      ruleApplied: 'SEZ_ZERO_RATED_INTER_STATE',
      caReviewRequired: true,
      reviewReasons,
      notes:
        'Supply to SEZ developer/unit treated as inter-state zero-rated supply; requires CA review and authorized operations proof (Form I)',
    };
  }

  // 3. Fallback: Missing Recipient Address on Record (Section 12(2)(b)(ii) IGST Act)
  if (!input.billingStateCode || input.billingStateCode.trim() === '') {
    reviewReasons.push('MISSING_RECIPIENT_ADDRESS');
    const supplierState = stateForGstStateCode(SUPPLIER_CONFIG.stateCode)!;
    return {
      placeOfSupplyStateCode: SUPPLIER_CONFIG.stateCode,
      state: supplierState,
      ruleApplied: 'SUPPLIER_LOCATION_FALLBACK',
      caReviewRequired: true,
      reviewReasons,
      notes:
        'No recipient billing address on record; fallback to supplier location under Section 12(2)(b)(ii) IGST Act; flagged for CA review',
    };
  }

  const billingStateCode = validateGstStateCode(
    input.billingStateCode,
    'placeOfSupplyStateCode',
  );

  // 4. B2B Supplies (Section 12(2)(a) IGST Act)
  if (customerType === 'BUSINESS') {
    if (input.gstinStateCode && input.gstinStateCode.trim() !== '') {
      const gstinStateCode = validateGstStateCode(
        input.gstinStateCode,
        'placeOfSupplyStateCode',
      );
      const state = stateForGstStateCode(gstinStateCode)!;

      // Check review conditions for B2B:
      if (gstinStateCode !== billingStateCode) {
        reviewReasons.push('GSTIN_BILLING_STATE_MISMATCH');
      }
      if (input.hasMultipleRegistrations) {
        reviewReasons.push('POTENTIAL_MULTI_ESTABLISHMENT');
      }
      if (input.receivingEstablishmentUnclear) {
        reviewReasons.push('UNCLEAR_RECEIVING_ESTABLISHMENT');
      }

      const caReviewRequired = reviewReasons.length > 0;
      const noteDetails: string[] = [];
      if (gstinStateCode !== billingStateCode) {
        noteDetails.push('billing address state differs');
      }
      if (input.hasMultipleRegistrations) {
        noteDetails.push('multiple registrations exist');
      }
      if (input.receivingEstablishmentUnclear) {
        noteDetails.push('establishment receiving service is ambiguous');
      }

      const notes = caReviewRequired
        ? `B2B place of supply determined from GSTIN registration state (${gstinStateCode}); flagged for CA review (${noteDetails.join(', ')})`
        : 'B2B place of supply determined from GSTIN registration state (Section 12(2)(a) IGST Act)';

      return {
        placeOfSupplyStateCode: gstinStateCode,
        state,
        ruleApplied: 'B2B_GSTIN_REGISTRATION_STATE',
        caReviewRequired,
        reviewReasons,
        notes,
      };
    }

    // Business customer without a registered GSTIN:
    // Falls back to billing state under unregistered recipient rule Section 12(2)(b)(i)
    // but flagged for CA review to verify B2B business classification.
    reviewReasons.push('UNREGISTERED_BUSINESS');
    const state = stateForGstStateCode(billingStateCode)!;
    return {
      placeOfSupplyStateCode: billingStateCode,
      state,
      ruleApplied: 'B2C_BILLING_ADDRESS_STATE',
      caReviewRequired: true,
      reviewReasons,
      notes:
        'Business customer without GSTIN; place of supply determined from billing address under unregistered recipient rule (Section 12(2)(b)(i) IGST Act); flagged for CA review',
    };
  }

  // 5. B2C Supplies (Section 12(2)(b)(i) IGST Act)
  const state = stateForGstStateCode(billingStateCode)!;
  return {
    placeOfSupplyStateCode: billingStateCode,
    state,
    ruleApplied: 'B2C_BILLING_ADDRESS_STATE',
    caReviewRequired: false,
    reviewReasons: [],
    notes:
      'B2C place of supply determined from recipient billing address on record (Section 12(2)(b)(i) IGST Act)',
  };
};
