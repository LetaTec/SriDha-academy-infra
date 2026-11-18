export type CustomerType = 'INDIVIDUAL' | 'BUSINESS' | 'B2C' | 'B2B';
export type CanonicalCustomerType = 'INDIVIDUAL' | 'BUSINESS';

export type PricingMode = 'EXCLUSIVE' | 'INCLUSIVE';

export type SupplyType = 'INTRA_STATE' | 'INTER_STATE';

export type GstCalculationInput = {
  taxableAmountPaise: number;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  customerType: CustomerType;
  sacCode: string;
  gstRateBasisPoints: number;
  pricingMode: PricingMode;
};

export type GstCalculationResult = {
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  totalGstPaise: number;
  cgstRateBasisPoints: number;
  cgstPaise: number;
  sgstRateBasisPoints: number;
  sgstPaise: number;
  igstRateBasisPoints: number;
  igstPaise: number;
  totalAmountPaise: number;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  supplyType: SupplyType;
  customerType: CanonicalCustomerType;
  sacCode: string;
  pricingMode: 'EXCLUSIVE';
  calculationVersion: string;
  roundingPolicy: string;
};

export const GST_ERROR_CODE = {
  invalidTaxableAmount: 'INVALID_TAXABLE_AMOUNT',
  invalidStateCode: 'INVALID_STATE_CODE',
  invalidSacCode: 'INVALID_SAC_CODE',
  invalidGstRate: 'INVALID_GST_RATE',
  oddIntraStateRate: 'ODD_INTRA_STATE_RATE',
  invalidCustomerType: 'INVALID_CUSTOMER_TYPE',
  unsupportedPricingMode: 'UNSUPPORTED_PRICING_MODE',
  monetaryOverflow: 'MONETARY_OVERFLOW',
} as const;

export type GstErrorCode = (typeof GST_ERROR_CODE)[keyof typeof GST_ERROR_CODE];

export class GstCalculationError extends Error {
  readonly code: GstErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: GstErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'GstCalculationError';
    this.code = code;
    this.details = details;
  }
}
