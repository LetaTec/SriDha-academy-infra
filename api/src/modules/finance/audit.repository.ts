import type { DatabaseClient, Row } from '../../db/client.js';

// Every SQL statement for the finance audit log. The table is append-only
// (a trigger refuses UPDATE and DELETE), so there is only insert and read.

export type NewAuditEntry = {
  occurredAt: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  requestId: string | null;
};

export const insertAuditEntry = (db: DatabaseClient, entry: NewAuditEntry) =>
  db.query(
    `INSERT INTO finance_audit_log (occurred_at, actor_user_id, actor_role,
       action, entity_type, entity_id, details, request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.occurredAt,
      entry.actorUserId,
      entry.actorRole,
      entry.action,
      entry.entityType,
      entry.entityId,
      JSON.stringify(entry.details),
      entry.requestId,
    ],
  );

// Newest first, a page at a time
export const listAuditEntryRows = (
  db: DatabaseClient,
  { limit, offset }: { limit: number; offset: number },
) =>
  db.all<Row>(
    `SELECT id, occurred_at, actor_user_id, actor_role, action, entity_type,
            entity_id, details, request_id
     FROM finance_audit_log
     ORDER BY occurred_at DESC, id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
