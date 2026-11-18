/**
 * Confirmed Legal Supplier Configuration for SriDha Academy.
 * Legal supplier: LETATEC AI TECHNOLOGIES PRIVATE LIMITED (F1, F2, F3).
 * Customer-facing brand: SriDha Academy.
 */
export const SUPPLIER_CONFIG = {
  legalName: 'LETATEC AI TECHNOLOGIES PRIVATE LIMITED',
  gstin: '08AAGCL9166P1ZL',
  state: 'Rajasthan',
  stateCode: '08',
  registeredAddress:
    'LG32, Jaipur Electronics Market, Ridhi Sidhi Chowraha, Shyam Nagar, Jaipur, Rajasthan – 302019',
  effectiveDate: '2026-07-01',
  displayBrand: 'SriDha Academy',
} as const;

/**
 * Initial CA-provided Tax Configuration for Course Enrolments and Online Coaching.
 * SAC: 999293 (Commercial training and coaching services).
 * GST: 18% = 1800 basis points.
 */
export const DEFAULT_TAX_CONFIG = {
  sacCode: '999293',
  gstRateBasisPoints: 1800, // 18% = 1,800 basis points (1 bp = 0.01%)
  pricingMode: 'EXCLUSIVE' as const,
  calculationVersion: 'v1',
  roundingPolicy: 'HALF_UP_COMPONENT_SUM',
  // Decision C8: line-item component rounding vs invoice total rounding awaits formal CA confirmation
  roundingPolicyStatus: 'PROPOSED_PENDING_CA_APPROVAL',
} as const;

/**
 * Common GST rates in basis points.
 * 100% = 10,000 bp
 *  28% = 2,800 bp
 *  18% = 1,800 bp
 *  12% = 1,200 bp
 *   9% =   900 bp
 *   5% =   500 bp
 *   0% =     0 bp
 */
export const GST_RATE_BP = {
  standard18: 1800,
  half9: 900,
  reduced12: 1200,
  half6: 600,
  low5: 500,
  half2_5: 250,
  zero: 0,
} as const;
