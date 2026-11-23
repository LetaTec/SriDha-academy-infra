// The finance area's request and response shapes. See catalogue.ts for what
// this folder is.

// One append-only audit record: who (null actor = the system), what, on
// which record, and when
export type AuditEntry = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  requestId: string | null;
};

export type AuditLogResponse = { entries: AuditEntry[] };

// A refund finance staff ask for. Without amountPaise, everything not yet
// refunded is refunded. requestKey (a UUID the client makes once per
// intended refund) makes a repeated submission return the first refund.
export type RefundRequestBody = {
  amountPaise?: number;
  reason: string;
  requestKey?: string;
};

export type Refund = {
  id: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  // PENDING: asked for, not yet completed by Razorpay (or no answer yet)
  // REQUIRES_REVIEW: Razorpay has not confirmed it a day after the request;
  // its amount stays reserved until a person resolves it
  status: 'PENDING' | 'REQUIRES_REVIEW' | 'PROCESSED' | 'FAILED';
  // FINANCE_ADMIN: requested here; PROVIDER_DASHBOARD: made in Razorpay
  source: 'FINANCE_ADMIN' | 'PROVIDER_DASHBOARD';
  providerRefundId: string | null;
  reason: string | null;
  failureReason: string | null;
  // Why a person must check this refund (REQUIRES_REVIEW only)
  reviewReason: string | null;
  createdAt: string;
};

export type RefundResponse = { refund: Refund };

export type ReconcileRefundsRequestBody = {
  olderThanMinutes?: number;
};

export type ReconcileRefundsResponse = {
  processed: number;
  failed: number;
  pending: number;
  // Newly flagged for a person to check
  needsReview: number;
  skipped: number;
};

// Historical payments report for CA review (Section 6 of architecture).
// Read-only report of payments received since SriDha registration (1 July 2026).
export type HistoricalPaymentItem = {
  paymentId: string;
  createdAt: string;
  createdAtIst: string;
  paidAt: string | null;
  paidAtIst: string | null;
  paidAtEstimated: boolean;
  status: 'CREATED' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'EXPIRED';
  amountPaise: number;
  amountRupees: string;
  currency: string;
  provider: 'RAZORPAY' | 'TEST';
  providerOrderId: string;
  providerPaymentId: string | null;
  billingName: string;
  billingEmail: string;
  billingMobile: string;
  billingState: string | null;
  billingCity: string | null;
  topicTitleCatalogueCurrent: string | null;
  batchNameCatalogueCurrent: string | null;
  seatStatus: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | null;
  refundCount: number;
  // The refund amounts below are by the refund's own status, whatever the
  // payment's. On a payment that was never captured here they are also
  // counted in refundExceptionPaise and never in the summary's refunds.
  // Refunds Razorpay has processed (money returned)
  refundedAmountPaise: number;
  refundedAmountRupees: string;
  // Refunds requested but not yet confirmed by Razorpay
  refundPendingPaise: number;
  // Refunds Razorpay has not confirmed a day after the request, or whose
  // reported amount differs (a person must check)
  refundUnderReviewPaise: number;
  // Refunds Razorpay refused (no money returned; never deducted)
  refundFailedPaise: number;
  // Processed, pending or under-review refunds on a payment that is not
  // PAID here: unreconciled activity, never deducted from collections
  refundExceptionPaise: number;
  // Captured amount less processed refunds; 0 unless the payment is PAID
  netCollectedPaise: number;
  taxStatus:
    'LEGACY_UNREVIEWED' | 'PENDING_CONFIGURATION' | 'QUOTED' | 'NOT_APPLICABLE';
};

// Money figures are amounts captured at Razorpay, not bank receipts
// (settlement fees and timing are not included)
export type HistoricalPaymentsReportSummary = {
  // Every real payment record in scope, whatever its status
  realPaymentsCount: number;
  // PAID payments only: money actually captured
  realCapturedCount: number;
  realCapturedPaise: number;
  realCapturedRupees: string;
  // Processed refunds on PAID payments (deducted from collections)
  realRefundedPaise: number;
  // Refunds on PAID payments awaiting Razorpay (reserved, not deducted)
  realRefundPendingPaise: number;
  // Refunds on PAID payments awaiting a person (reserved, not deducted)
  realRefundUnderReviewPaise: number;
  // Refunds Razorpay refused (informational, not deducted)
  realRefundFailedPaise: number;
  // Refunds on payments that were never captured here (unreconciled;
  // never deducted): see GET /api/finance/refund-exceptions
  realRefundExceptionCount: number;
  realRefundExceptionPaise: number;
  // Captured less processed refunds
  realNetCollectedPaise: number;
  realNetCollectedRupees: string;
  // Orders never captured (created, authorised, failed or expired)
  realNotCollectedCount: number;
  realNotCollectedPaise: number;
  testPaymentsCount: number;
};

export type RefundException = {
  refundId: string;
  paymentId: string;
  kind: 'REQUIRES_REVIEW' | 'REFUND_ON_UNCAPTURED_PAYMENT';
  status: 'PENDING' | 'REQUIRES_REVIEW' | 'PROCESSED' | 'FAILED';
  paymentStatus: string;
  amountPaise: number;
  providerRefundId: string | null;
  providerPaymentId: string | null;
  receipt: string | null;
  reviewReason: string | null;
  createdAt: string;
};

// A Razorpay refund report that did not match the refund on record; it
// changed nothing (the details hold what was recorded and reported)
export type RefundMismatchReport = {
  auditId: string;
  occurredAt: string;
  refundId: string | null;
  details: Record<string, unknown>;
};

export type RefundExceptionsResponse = {
  open: RefundException[];
  mismatches: RefundMismatchReport[];
};

export type RefundDeskItem = Refund & {
  paymentStatus: string;
  paymentAmountPaise: number;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  customerEmail: string | null;
  customerName: string | null;
};

export type RefundsListResponse = {
  refunds: RefundDeskItem[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    totalCount: number;
    pendingCount: number;
    requiresReviewCount: number;
    processedCount: number;
    failedCount: number;
    requiresReviewPaise: number;
    processedPaise: number;
  };
};

export type RefundDetailResponse = {
  refund: Refund;
  payment: {
    id: string;
    status: string;
    amountPaise: number;
    currency: string;
    provider: string;
    providerPaymentId: string | null;
    providerOrderId: string | null;
    paidAt: string | null;
    createdAt: string;
    customerEmail: string | null;
    customerName: string | null;
  } | null;
  auditEntries: AuditEntry[];
  mismatches: RefundMismatchReport[];
};

export type ResolveRefundExceptionRequestBody = {
  action: 'CONFIRM_PROCESSED' | 'MARK_FAILED';
  evidenceReference: string;
  notes: string;
  providerRefundId?: string;
};

export type ResolveRefundExceptionResponse = {
  resolved: boolean;
  refund: Refund;
};

export type HistoricalPaymentsReportResponse = {
  scope: {
    since: string;
    generatedAt: string;
    timezone: string;
    // Which date selects payments into the report. A CA decision is
    // pending on whether accounting periods should use the payment date
    dateBasis: 'PAYMENT_CREATED_AT_IST';
    disclaimer: string;
  };
  summary: HistoricalPaymentsReportSummary;
  payments: HistoricalPaymentItem[];
  testPayments: HistoricalPaymentItem[];
};

// GST Calculation Engine contracts (Milestone 5)
export type GstCustomerType = 'INDIVIDUAL' | 'BUSINESS' | 'B2C' | 'B2B';
export type GstPricingMode = 'EXCLUSIVE' | 'INCLUSIVE';
export type GstSupplyType = 'INTRA_STATE' | 'INTER_STATE';

export type GstCalculationInput = {
  taxableAmountPaise: number;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  customerType: GstCustomerType;
  sacCode: string;
  gstRateBasisPoints: number;
  pricingMode: GstPricingMode;
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
  supplyType: GstSupplyType;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  sacCode: string;
  pricingMode: 'EXCLUSIVE';
  calculationVersion: string;
  roundingPolicy: string;
};

// Milestone 6: Tax Quotes, Snapshots, and Invoices
export type TaxQuoteRequestBody = {
  itemType: 'TOPIC' | 'BATCH';
  itemId: string;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  customerEmail: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pinCode: string;
  businessLegalName?: string;
  gstin?: string;
};

export type TaxQuote = {
  id: string;
  quoteKey: string;
  itemType: 'TOPIC' | 'BATCH';
  itemId: string;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalGstPaise: number;
  totalAmountPaise: number;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  supplyType: GstSupplyType;
  sacCode: string;
  pricingMode: 'EXCLUSIVE';
  calculationVersion: string;
  roundingPolicy: string;
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
};

export type TaxQuoteResponse = { quote: TaxQuote };

// A recorded CA approval (or revocation) of the tax configuration the
// system calculates with. Append-only: the newest record decides.
export type TaxApproval = {
  id: string;
  status: 'APPROVED' | 'REVOKED';
  supplierGstin: string;
  sacCode: string;
  gstRateBasisPoints: number;
  pricingMode: string;
  calculationVersion: string;
  roundingPolicy: string;
  effectiveFrom: string;
  approvedBy: string;
  approvalReference: string;
  recordedBy: string;
  recordedAt: string;
};

// The configuration is always the one in code; staff cannot choose rates
export type TaxApprovalRequestBody = {
  status: 'APPROVED' | 'REVOKED';
  // Required for APPROVED (not in the past); a revocation is immediate
  effectiveFrom?: string;
  approvedBy: string;
  approvalReference: string;
};

export type InvoicingActivationState = {
  active: boolean;
  inactiveReason: string | null;
  approvalId: string | null;
  invoicingEnabled: boolean;
};

export type TaxApprovalsResponse = {
  activation: InvoicingActivationState;
  approvals: TaxApproval[];
};

export type TaxApprovalResponse = {
  approval: TaxApproval;
  activation: InvoicingActivationState;
};

export type TaxSnapshot = {
  id: string;
  paymentId: string;
  invoiceId: string | null;
  quoteId: string | null;
  supplierLegalName: string;
  supplierGstin: string;
  supplierStateCode: string;
  supplierAddress: string;
  recipientName: string;
  recipientEmail: string;
  recipientMobile: string;
  recipientCustomerType: 'INDIVIDUAL' | 'BUSINESS';
  recipientAddressLine1: string;
  recipientAddressLine2: string | null;
  recipientCity: string;
  recipientState: string;
  recipientStateCode: string;
  recipientPinCode: string;
  recipientBusinessName: string | null;
  recipientGstin: string | null;
  recipientGstinStateCode: string | null;
  placeOfSupplyStateCode: string;
  supplyType: GstSupplyType;
  sacCode: string;
  pricingMode: 'EXCLUSIVE';
  taxableAmountPaise: number;
  gstRateBasisPoints: number;
  cgstRateBasisPoints: number;
  cgstPaise: number;
  sgstRateBasisPoints: number;
  sgstPaise: number;
  igstRateBasisPoints: number;
  igstPaise: number;
  totalGstPaise: number;
  totalAmountPaise: number;
  calculationVersion: string;
  roundingPolicy: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  paymentId: string;
  fiscalYear: string;
  sequenceNumber: number;
  timeOfSupply: string;
  issuedAt: string;
  status: 'PENDING' | 'ISSUED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
};

export type InvoiceResponse = {
  invoice: Invoice;
  snapshot: TaxSnapshot;
};
