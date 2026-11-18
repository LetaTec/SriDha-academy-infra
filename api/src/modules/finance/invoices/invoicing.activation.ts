import type { AppConfig } from '../../../config/env.js';
import type { DatabaseClient } from '../../../db/client.js';
import { DEFAULT_TAX_CONFIG, SUPPLIER_CONFIG } from '../gst/gst.config.js';
import {
  findLatestApprovalForConfiguration,
  type TaxConfigurationApproval,
  type TaxConfigurationFingerprint,
} from './invoices.repository.js';

// The tax configuration this build calculates with. Invoicing is active only
// when an approval for exactly this configuration is recorded, so changing a
// rate, SAC code or rounding policy in code switches invoicing off until the
// change itself is approved.
export const CURRENT_TAX_CONFIGURATION: TaxConfigurationFingerprint = {
  supplierGstin: SUPPLIER_CONFIG.gstin,
  sacCode: DEFAULT_TAX_CONFIG.sacCode,
  gstRateBasisPoints: DEFAULT_TAX_CONFIG.gstRateBasisPoints,
  pricingMode: DEFAULT_TAX_CONFIG.pricingMode,
  calculationVersion: DEFAULT_TAX_CONFIG.calculationVersion,
  roundingPolicy: DEFAULT_TAX_CONFIG.roundingPolicy,
};

// Recording an approval takes this lock exclusively and issuing an invoice
// takes it shared, so a revocation waits for invoices already being issued
// and every invoice after it sees the revocation (transaction-scoped
// PostgreSQL advisory lock)
const APPROVAL_LOCK_KEY = 7240021;

export const lockApprovalsForIssuance = (tx: DatabaseClient) =>
  tx.query('SELECT pg_advisory_xact_lock_shared($1)', [APPROVAL_LOCK_KEY]);

export const lockApprovalsForChange = (tx: DatabaseClient) =>
  tx.query('SELECT pg_advisory_xact_lock($1)', [APPROVAL_LOCK_KEY]);

// GST registration takes effect on this date in India
export const REGISTRATION_EFFECTIVE_FROM = new Date(
  `${SUPPLIER_CONFIG.effectiveDate}T00:00:00+05:30`,
);

export const INVOICING_INACTIVE_REASON = {
  disabled: 'DISABLED_BY_CONFIGURATION',
  noApproval: 'NO_APPROVED_TAX_CONFIGURATION',
  revoked: 'APPROVAL_REVOKED',
  notYetEffective: 'APPROVAL_NOT_YET_EFFECTIVE',
  beforeRegistration: 'APPROVAL_BEFORE_GST_REGISTRATION',
} as const;

export type InvoicingInactiveReason =
  (typeof INVOICING_INACTIVE_REASON)[keyof typeof INVOICING_INACTIVE_REASON];

export type InvoicingActivation =
  | { active: true; approval: TaxConfigurationApproval }
  | { active: false; reason: InvoicingInactiveReason };

// Both switches must be on: INVOICING_ENABLED in the environment, and a
// recorded, effective approval of the current tax configuration. Either
// one alone issues nothing.
export const getInvoicingActivation = async (
  db: DatabaseClient,
  config: Pick<AppConfig, 'invoicingEnabled'>,
  at: Date,
): Promise<InvoicingActivation> => {
  if (!config.invoicingEnabled) {
    return { active: false, reason: INVOICING_INACTIVE_REASON.disabled };
  }

  const approval = await findLatestApprovalForConfiguration(
    db,
    CURRENT_TAX_CONFIGURATION,
  );
  if (!approval) {
    return { active: false, reason: INVOICING_INACTIVE_REASON.noApproval };
  }
  if (approval.status !== 'APPROVED') {
    return { active: false, reason: INVOICING_INACTIVE_REASON.revoked };
  }

  const effectiveFrom = new Date(approval.effectiveFrom);
  if (effectiveFrom < REGISTRATION_EFFECTIVE_FROM) {
    return {
      active: false,
      reason: INVOICING_INACTIVE_REASON.beforeRegistration,
    };
  }
  if (effectiveFrom > at) {
    return {
      active: false,
      reason: INVOICING_INACTIVE_REASON.notYetEffective,
    };
  }

  return { active: true, approval };
};
