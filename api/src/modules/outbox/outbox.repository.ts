import type { DatabaseClient, Row } from '../../db/client.js';

// UNCONFIRMED: the last attempt may have reached the provider, but its
// result was never recorded. It is never resent automatically; within the
// provider's 24-hour idempotency window a manual resend with the same key
// delivers nothing new.
export type OutboxStatus =
  'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'UNCONFIRMED';

export type OutboxRow = Row & {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string;
  sent_at: string | null;
  last_error: string | null;
  idempotency_key: string | null;
  claim_token: string | null;
  created_at: string;
  updated_at: string;
};

export type NewOutboxEmail = {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  nextAttemptAt?: Date;
  createdAt?: Date;
};

// Inserts an email into the outbox. An idempotency key collision is safely
// ignored without failing the caller's transaction.
export const insertOutboxEmail = async (
  db: DatabaseClient,
  email: NewOutboxEmail,
): Promise<string | null> => {
  const at = (email.createdAt ?? new Date()).toISOString();
  const nextAt = (
    email.nextAttemptAt ??
    email.createdAt ??
    new Date()
  ).toISOString();
  const row = await db.get<{ id: string }>(
    `INSERT INTO email_outbox (
       id, recipient, subject, template, payload, status, attempts,
       next_attempt_at, idempotency_key, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, 'PENDING', 0,
       $6, $7, $8, $8
     )
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [
      email.id,
      email.recipient,
      email.subject,
      email.template,
      JSON.stringify(email.payload),
      nextAt,
      email.idempotencyKey,
      at,
    ],
  );
  return row ? String(row.id) : null;
};

// Atomically claims up to `limit` pending emails or stale processing emails
// (a worker that stopped mid-send). Concurrent workers skip locked rows
// (FOR UPDATE SKIP LOCKED), and each claim gets a new token: only the
// holder of the current token can record the result. A stale email that
// already used its last attempt is not claimed (see failAbandonedOutboxEmails).
export const claimOutboxEmails = (
  db: DatabaseClient,
  now: Date,
  limit: number,
  staleTimeoutMs: number,
  // attempts is an INTEGER column
  maxAttempts = 2_147_483_647,
): Promise<OutboxRow[]> => {
  const nowIso = now.toISOString();
  const staleThresholdIso = new Date(
    now.getTime() - staleTimeoutMs,
  ).toISOString();

  return db.all<OutboxRow>(
    `WITH claimable AS (
       SELECT id
       FROM email_outbox
       WHERE (
         status = 'PENDING'
         AND next_attempt_at <= $1
       ) OR (
         status = 'PROCESSING'
         AND last_attempt_at <= $2
         AND attempts < $4
       )
       ORDER BY next_attempt_at ASC, created_at ASC
       LIMIT $3
       FOR UPDATE SKIP LOCKED
     )
     UPDATE email_outbox
     SET status = 'PROCESSING',
         attempts = email_outbox.attempts + 1,
         last_attempt_at = $1,
         claim_token = gen_random_uuid()::text,
         updated_at = $1
     FROM claimable
     WHERE email_outbox.id = claimable.id
     RETURNING email_outbox.*`,
    [nowIso, staleThresholdIso, limit, maxAttempts],
  );
};

// Emails a worker abandoned on their last attempt: the provider may or may
// not have accepted them, so they are UNCONFIRMED, never resent
export const failAbandonedOutboxEmails = async (
  db: DatabaseClient,
  now: Date,
  staleTimeoutMs: number,
  maxAttempts: number,
): Promise<number> => {
  const staleThresholdIso = new Date(
    now.getTime() - staleTimeoutMs,
  ).toISOString();
  const result = await db.run(
    `UPDATE email_outbox
     SET status = 'UNCONFIRMED',
         last_error = 'Abandoned by a worker on its last attempt; the provider may have accepted it. Not resent automatically',
         claim_token = NULL,
         updated_at = $1
     WHERE status = 'PROCESSING'
       AND last_attempt_at <= $2
       AND attempts >= $3`,
    [now.toISOString(), staleThresholdIso, maxAttempts],
  );
  return result.rowCount;
};

// Each returns false when this worker no longer holds the claim (another
// worker reclaimed the email); nothing is changed then.
export const markOutboxSent = async (
  db: DatabaseClient,
  id: string,
  claimToken: string,
  sentAt: Date,
): Promise<boolean> => {
  const timestamp = sentAt.toISOString();
  const result = await db.run(
    `UPDATE email_outbox
     SET status = 'SENT',
         sent_at = $3,
         last_error = NULL,
         claim_token = NULL,
         updated_at = $3
     WHERE id = $1 AND status = 'PROCESSING' AND claim_token = $2`,
    [id, claimToken, timestamp],
  );
  return result.rowCount > 0;
};

export const markOutboxRetry = async (
  db: DatabaseClient,
  id: string,
  claimToken: string,
  nextAttemptAt: Date,
  error: string,
  updatedAt: Date,
): Promise<boolean> => {
  const result = await db.run(
    `UPDATE email_outbox
     SET status = 'PENDING',
         next_attempt_at = $3,
         last_error = $4,
         claim_token = NULL,
         updated_at = $5
     WHERE id = $1 AND status = 'PROCESSING' AND claim_token = $2`,
    [
      id,
      claimToken,
      nextAttemptAt.toISOString(),
      error,
      updatedAt.toISOString(),
    ],
  );
  return result.rowCount > 0;
};

export const markOutboxFailed = async (
  db: DatabaseClient,
  id: string,
  claimToken: string,
  error: string,
  updatedAt: Date,
): Promise<boolean> => {
  const result = await db.run(
    `UPDATE email_outbox
     SET status = 'FAILED',
         last_error = $3,
         claim_token = NULL,
         updated_at = $4
     WHERE id = $1 AND status = 'PROCESSING' AND claim_token = $2`,
    [id, claimToken, error, updatedAt.toISOString()],
  );
  return result.rowCount > 0;
};

export const findOutboxById = (
  db: DatabaseClient,
  id: string,
): Promise<OutboxRow | null> =>
  db.get<OutboxRow>(`SELECT * FROM email_outbox WHERE id = $1`, [id]);

export const listOutboxRows = (
  db: DatabaseClient,
  options: { status?: OutboxStatus; limit?: number } = {},
): Promise<OutboxRow[]> => {
  const { status, limit = 100 } = options;
  if (status) {
    return db.all<OutboxRow>(
      `SELECT * FROM email_outbox WHERE status = $1 ORDER BY created_at ASC LIMIT $2`,
      [status, limit],
    );
  }
  return db.all<OutboxRow>(
    `SELECT * FROM email_outbox ORDER BY created_at ASC LIMIT $1`,
    [limit],
  );
};
