import type { DatabaseClient, Row } from '../../db/client.js';

// Every SQL statement for accounts, profiles, sessions, password-reset
// tokens and admin sign-in links. Services decide what happens; this file
// only reads and writes rows.

// Accounts

export const findAuthUserRow = (db: DatabaseClient, userId: string) =>
  db.get<Row>(
    `SELECT u.id, u.email, u.role, u.full_name AS account_name, u.password_hash IS NOT NULL AS has_password,
       s.id AS student_id, s.full_name, s.standard, s.stream, s.stream_other
     FROM users u
     LEFT JOIN student_profiles s ON s.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );

export const findUserRole = async (db: DatabaseClient, userId: string) => {
  const row = await db.get<{ role: string }>(
    'SELECT role FROM users WHERE id = $1',
    [userId],
  );
  return row ? String(row.role) : null;
};

export const findUserIdByEmail = async (db: DatabaseClient, email: string) => {
  const row = await db.get<{ id: string }>(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
    [email],
  );
  return row ? String(row.id) : null;
};

export const findUserIdByEmailAndRole = async (
  db: DatabaseClient,
  email: string,
  role: string,
) => {
  const row = await db.get<{ id: string }>(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND role = $2',
    [email, role],
  );
  return row ? String(row.id) : null;
};

export const findCredentialsByEmail = (db: DatabaseClient, email: string) =>
  db.get<{ id: string; password_hash: string | null }>(
    'SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER($1)',
    [email],
  );

// What sign-up needs to know about an email already on file
export const findAccountByEmail = (db: DatabaseClient, email: string) =>
  db.get<{ id: string; role: string; password_hash: string | null }>(
    'SELECT id, role, password_hash FROM users WHERE LOWER(email) = LOWER($1)',
    [email],
  );

export const insertSignedUpStudent = (
  db: DatabaseClient,
  student: {
    id: string;
    email: string;
    fullName: string;
    passwordHash: string;
    role: string;
    timestamp: string;
  },
) =>
  db.query(
    `INSERT INTO users (id, email, password_hash, role, full_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [
      student.id,
      student.email,
      student.passwordHash,
      student.role,
      student.fullName,
      student.timestamp,
    ],
  );

// Gives a password and name to a student record checkout made for a
// billing email. Only password-less student records qualify, never staff;
// returns whether a row changed.
export const claimPasswordlessStudent = async (
  db: DatabaseClient,
  claim: {
    userId: string;
    fullName: string;
    passwordHash: string;
    role: string;
    timestamp: string;
  },
) => {
  const row = await db.get<{ id: string }>(
    `UPDATE users SET password_hash = $1, full_name = $2, updated_at = $3
     WHERE id = $4 AND role = $5 AND password_hash IS NULL
     RETURNING id`,
    [
      claim.passwordHash,
      claim.fullName,
      claim.timestamp,
      claim.userId,
      claim.role,
    ],
  );
  return row !== null && row !== undefined;
};

export type NewStudent = {
  userId: string;
  profileId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  dateOfBirth: string;
  mobile: string;
  standard: string;
  stream: string | null;
  streamOther: string | null;
  address: string | null;
  timestamp: string;
};

// Call inside a transaction: the account and its profile exist together
export const insertStudent = async (
  tx: DatabaseClient,
  student: NewStudent,
) => {
  await tx.query(
    'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [
      student.userId,
      student.email,
      student.passwordHash,
      student.timestamp,
      student.timestamp,
    ],
  );
  await tx.query(
    `INSERT INTO student_profiles
      (id, user_id, full_name, date_of_birth, mobile, standard, stream, stream_other, address, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      student.profileId,
      student.userId,
      student.fullName,
      student.dateOfBirth,
      student.mobile,
      student.standard,
      student.stream,
      student.streamOther,
      student.address,
      student.timestamp,
      student.timestamp,
    ],
  );
};

export const updatePasswordHash = (
  db: DatabaseClient,
  userId: string,
  passwordHash: string,
  timestamp: string,
) =>
  db.query(
    'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
    [passwordHash, timestamp, userId],
  );

// Roles

export const listUsersWithRole = (db: DatabaseClient, role: string) =>
  db.all<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE role = $1',
    [role],
  );

export const setUserRole = (
  db: DatabaseClient,
  userId: string,
  role: string,
  timestamp: string,
) =>
  db.query('UPDATE users SET role = $1, updated_at = $2 WHERE id = $3', [
    role,
    timestamp,
    userId,
  ]);

export const insertPasswordlessUser = (
  db: DatabaseClient,
  user: { id: string; email: string; role: string; timestamp: string },
) =>
  db.query(
    `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
     VALUES ($1, $2, NULL, $3, $4, $4)`,
    [user.id, user.email, user.role, user.timestamp],
  );

// Sessions

export const insertSession = (
  db: DatabaseClient,
  session: { id: string; userId: string; createdAt: string; expiresAt: string },
) =>
  db.query(
    'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [session.id, session.userId, session.createdAt, session.expiresAt],
  );

export const findSession = (db: DatabaseClient, sessionId: string) =>
  db.get<{ user_id: string; expires_at: string | Date }>(
    'SELECT user_id, expires_at FROM sessions WHERE id = $1',
    [sessionId],
  );

export const deleteSessionById = (db: DatabaseClient, sessionId: string) =>
  db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);

export const deleteSessionsForUser = (db: DatabaseClient, userId: string) =>
  db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

// One-time tokens: password-reset tokens and admin sign-in links share a
// shape (id is the token's hash)

export const TOKEN_TABLE = {
  passwordReset: 'password_reset_tokens',
  signInLink: 'sign_in_links',
} as const;

type TokenTable = (typeof TOKEN_TABLE)[keyof typeof TOKEN_TABLE];

export type OneTimeToken = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

// Only the newest token for an account works
export const revokeUnusedTokens = (
  db: DatabaseClient,
  table: TokenTable,
  userId: string,
  timestamp: string,
) =>
  db.query(
    `UPDATE ${table} SET used_at = $1 WHERE user_id = $2 AND used_at IS NULL`,
    [timestamp, userId],
  );

export const insertToken = (
  db: DatabaseClient,
  table: TokenTable,
  token: OneTimeToken,
) =>
  db.query(
    `INSERT INTO ${table} (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
    [token.id, token.userId, token.createdAt, token.expiresAt],
  );

// Password-reset codes ("Forgot password")

export const insertResetCode = (
  db: DatabaseClient,
  code: {
    id: string;
    userId: string;
    codeHash: string;
    createdAt: string;
    expiresAt: string;
  },
) =>
  db.query(
    `INSERT INTO password_reset_tokens (id, user_id, code_hash, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [code.id, code.userId, code.codeHash, code.createdAt, code.expiresAt],
  );

// The account's newest unused code (issuing one revokes the others)
export const findLatestResetCode = (db: DatabaseClient, userId: string) =>
  db.get<{
    id: string;
    code_hash: string;
    attempts: number;
    expires_at: string;
  }>(
    `SELECT id, code_hash, attempts, expires_at FROM password_reset_tokens
     WHERE user_id = $1 AND used_at IS NULL AND code_hash IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );

// Counts a try before checking it, so tries made at the same moment are
// all counted; returns the new total
export const countResetCodeAttempt = async (
  db: DatabaseClient,
  codeId: string,
) => {
  const row = await db.get<{ attempts: number }>(
    `UPDATE password_reset_tokens SET attempts = attempts + 1
     WHERE id = $1 RETURNING attempts`,
    [codeId],
  );
  return Number(row?.attempts ?? Number.POSITIVE_INFINITY);
};

export const markPasswordResetTokenUsed = (
  db: DatabaseClient,
  tokenId: string,
  timestamp: string,
) =>
  db.query('UPDATE password_reset_tokens SET used_at = $1 WHERE id = $2', [
    timestamp,
    tokenId,
  ]);

export const findSignInLink = (db: DatabaseClient, tokenId: string) =>
  db.get<Row>(
    `SELECT l.user_id, l.expires_at, l.used_at, u.role
     FROM sign_in_links l
     JOIN users u ON u.id = l.user_id
     WHERE l.id = $1`,
    [tokenId],
  );

// Atomic, so two clicks on one link cannot both sign in
export const claimSignInLink = async (
  db: DatabaseClient,
  tokenId: string,
  timestamp: string,
) => {
  const claimed = await db.query(
    'UPDATE sign_in_links SET used_at = $1 WHERE id = $2 AND used_at IS NULL RETURNING id',
    [timestamp, tokenId],
  );
  return claimed.rows.length === 1;
};

// Clean-up

export const deleteExpiredAuthRecords = async (
  db: DatabaseClient,
  now: Date,
) => {
  const cutoff = now.toISOString();
  const sessions = await db.run('DELETE FROM sessions WHERE expires_at <= $1', [
    cutoff,
  ]);
  const passwordResetTokens = await db.run(
    'DELETE FROM password_reset_tokens WHERE expires_at <= $1',
    [cutoff],
  );
  const signInLinks = await db.run(
    'DELETE FROM sign_in_links WHERE expires_at <= $1',
    [cutoff],
  );

  return {
    sessions: sessions.rowCount,
    passwordResetTokens: passwordResetTokens.rowCount,
    signInLinks: signInLinks.rowCount,
  };
};
