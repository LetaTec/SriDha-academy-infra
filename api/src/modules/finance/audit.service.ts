import type { AuditEntry } from '../../contracts/finance.js';
import type { DatabaseClient } from '../../db/client.js';
import { currentRequestId } from '../../logging/logger.js';
import { insertAuditEntry, listAuditEntryRows } from './audit.repository.js';

// What the finance audit log records. Details carry identifiers and
// amounts, never secrets, card data or full personal details.
export const AUDIT_ACTION = {
  roleGranted: 'ROLE_GRANTED',
  roleRevoked: 'ROLE_REVOKED',
  refundRequested: 'REFUND_REQUESTED',
  refundRecorded: 'REFUND_RECORDED',
  disputeRecorded: 'DISPUTE_RECORDED',
  paymentExpired: 'PAYMENT_EXPIRED',
  reportExported: 'REPORT_EXPORTED',
  taxApprovalRecorded: 'TAX_APPROVAL_RECORDED',
  // A provider refund report that does not match the refund on record
  refundException: 'REFUND_EXCEPTION_RECORDED',
  // Resolution of a refund requiring review or an uncaptured refund exception
  refundExceptionResolved: 'REFUND_EXCEPTION_RESOLVED',
  // A captured payment that could not confirm its seat, resolved by staff
  paymentExceptionResolved: 'PAYMENT_EXCEPTION_RESOLVED',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export type AuditActor = { userId: string; role: string } | null;

export const recordAudit = (
  db: DatabaseClient,
  entry: {
    actor: AuditActor;
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    details?: Record<string, unknown>;
    at: Date;
  },
) =>
  insertAuditEntry(db, {
    occurredAt: entry.at.toISOString(),
    actorUserId: entry.actor?.userId ?? null,
    actorRole: entry.actor?.role ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    details: entry.details ?? {},
    requestId: currentRequestId() ?? null,
  });

export const listAuditEntries = async (
  db: DatabaseClient,
  page: { limit: number; offset: number },
): Promise<AuditEntry[]> =>
  (await listAuditEntryRows(db, page)).map(row => ({
    id: String(row.id),
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
    actorUserId: row.actor_user_id === null ? null : String(row.actor_user_id),
    actorRole: row.actor_role === null ? null : String(row.actor_role),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: row.entity_id === null ? null : String(row.entity_id),
    details: (row.details ?? {}) as Record<string, unknown>,
    requestId: row.request_id === null ? null : String(row.request_id),
  }));
