import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AppContext } from '../../../app/context.js';
import type {
  InvoicingActivationState,
  TaxApprovalRequestBody,
} from '../../../contracts/finance.js';
import { transaction, type DatabaseClient } from '../../../db/client.js';
import { ApiError, ERROR_CODE } from '../../../http/errors.js';
import type { StaffActor } from '../../auth/permissions.js';
import { AUDIT_ACTION, recordAudit } from '../audit.service.js';
import {
  findLatestApprovalForConfiguration,
  insertTaxConfigurationApproval,
  listTaxConfigurationApprovals,
  type TaxConfigurationApproval,
} from './invoices.repository.js';
import {
  CURRENT_TAX_CONFIGURATION,
  getInvoicingActivation,
  lockApprovalsForChange,
  REGISTRATION_EFFECTIVE_FROM,
} from './invoicing.activation.js';

// An approval may start a few minutes before it is recorded (clock skew),
// never earlier: no approval can reach back over past payments
const BACKDATING_TOLERANCE_MS = 5 * 60 * 1000;

export const taxApprovalRequestSchema = z
  .strictObject({
    status: z.enum(['APPROVED', 'REVOKED']),
    effectiveFrom: z.iso.datetime({ offset: true }).optional(),
    approvedBy: z.string().trim().min(2).max(200),
    approvalReference: z.string().trim().min(2).max(500),
  })
  .superRefine((input, ctx) => {
    if (input.status === 'APPROVED' && !input.effectiveFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveFrom'],
        message: 'Give the date the approval takes effect',
      });
    }
    if (input.status === 'REVOKED' && input.effectiveFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveFrom'],
        message: 'A revocation takes effect immediately',
      });
    }
  }) satisfies z.ZodType<TaxApprovalRequestBody>;

export const activationState = async (
  db: DatabaseClient,
  config: Pick<AppContext['config'], 'invoicingEnabled'>,
  at: Date,
): Promise<InvoicingActivationState> => {
  // Report the approval state even while the environment switch is off
  const activation = await getInvoicingActivation(
    db,
    { invoicingEnabled: true },
    at,
  );
  const active = config.invoicingEnabled && activation.active;
  return {
    active,
    inactiveReason: active
      ? null
      : !config.invoicingEnabled
        ? 'DISABLED_BY_CONFIGURATION'
        : activation.active
          ? null
          : activation.reason,
    approvalId: activation.active ? activation.approval.id : null,
    invoicingEnabled: config.invoicingEnabled,
  };
};

export const listTaxApprovals = async (
  context: Pick<AppContext, 'db' | 'now' | 'config'>,
) => ({
  activation: await activationState(context.db, context.config, context.now()),
  approvals: await listTaxConfigurationApprovals(context.db),
});

/**
 * Records the CA's approval (or a revocation) of the tax configuration in
 * code, with the staff member and an audit entry, in one transaction. The
 * configuration recorded is always the one this build calculates with, so
 * nobody can approve rates of their choosing.
 */
export const recordTaxApproval = (
  context: Pick<AppContext, 'db' | 'now' | 'config'>,
  actor: StaffActor,
  input: z.infer<typeof taxApprovalRequestSchema>,
): Promise<{
  approval: TaxConfigurationApproval;
  activation: InvoicingActivationState;
}> =>
  transaction(context.db, async tx => {
    await lockApprovalsForChange(tx);
    const now = context.now();

    const effectiveFrom =
      input.status === 'APPROVED' ? new Date(input.effectiveFrom!) : now;
    if (input.status === 'APPROVED') {
      if (effectiveFrom.getTime() < now.getTime() - BACKDATING_TOLERANCE_MS) {
        throw new ApiError(
          409,
          ERROR_CODE.taxApprovalInvalid,
          'An approval cannot take effect in the past',
        );
      }
      if (effectiveFrom < REGISTRATION_EFFECTIVE_FROM) {
        throw new ApiError(
          409,
          ERROR_CODE.taxApprovalInvalid,
          'An approval cannot take effect before the GST registration',
        );
      }
    } else {
      const latest = await findLatestApprovalForConfiguration(
        tx,
        CURRENT_TAX_CONFIGURATION,
      );
      if (!latest || latest.status !== 'APPROVED') {
        throw new ApiError(
          409,
          ERROR_CODE.taxApprovalInvalid,
          'There is no approval of the current tax configuration to revoke',
        );
      }
    }

    const approval: TaxConfigurationApproval = {
      id: randomUUID(),
      status: input.status,
      ...CURRENT_TAX_CONFIGURATION,
      effectiveFrom: effectiveFrom.toISOString(),
      approvedBy: input.approvedBy,
      approvalReference: input.approvalReference,
      recordedBy: actor.userId,
      recordedAt: now.toISOString(),
    };
    await insertTaxConfigurationApproval(tx, approval);
    await recordAudit(tx, {
      actor,
      action: AUDIT_ACTION.taxApprovalRecorded,
      entityType: 'TAX_CONFIGURATION_APPROVAL',
      entityId: approval.id,
      details: {
        status: approval.status,
        effectiveFrom: approval.effectiveFrom,
        approvedBy: approval.approvedBy,
        approvalReference: approval.approvalReference,
        configuration: CURRENT_TAX_CONFIGURATION,
      },
      at: now,
    });

    return {
      approval,
      activation: await activationState(tx, context.config, now),
    };
  });
