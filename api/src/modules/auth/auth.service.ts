import { randomUUID } from 'node:crypto';

import type { AppContext } from '../../app/context.js';
import { transaction, type DatabaseClient } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import {
  claimSignInLink,
  findAuthUserRow,
  findCredentialsByEmail,
  findPasswordResetToken,
  findSignInLink,
  findUserIdByEmail,
  findUserIdByEmailAndRole,
  insertStudent,
  insertToken,
  markPasswordResetTokenUsed,
  revokeUnusedTokens,
  TOKEN_TABLE,
  updatePasswordHash,
} from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';
import {
  hashPassword,
  verifyAgainstDummyHash,
  verifyPassword,
} from './password.js';
import { toUserRole, USER_ROLE, type UserRole } from './roles.js';
import { deleteUserSessions } from './session.js';
import { generateToken, hashToken } from './tokens.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const SIGN_IN_LINK_TTL_MS = 15 * 60 * 1000;

// The authenticated account (users.id) is the canonical identity. Every
// student account owns exactly one student profile, created in the same
// transaction; a super admin account may have none.
export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  student: {
    id: string;
    fullName: string;
    standard: string;
    stream: string | null;
    streamOther: string | null;
  } | null;
};

// A new one-time token for the account; only the newest one works
const issueToken = async (
  context: AppContext,
  table: (typeof TOKEN_TABLE)[keyof typeof TOKEN_TABLE],
  userId: string,
  ttlMs: number,
) => {
  const token = generateToken();
  const now = context.now();

  await transaction(context.db, async tx => {
    await revokeUnusedTokens(tx, table, userId, now.toISOString());
    await insertToken(tx, table, {
      id: hashToken(token),
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    });
  });

  return token;
};

const emailAlreadyRegistered = () =>
  new ApiError(
    409,
    ERROR_CODE.emailAlreadyRegistered,
    'An account with this email already exists. Sign in instead.',
  );

const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  (/duplicate key/i.test(error.message) ||
    /unique constraint/i.test(error.message) ||
    /UNIQUE constraint failed/.test(error.message) ||
    ('code' in error && error.code === '23505'));

export const getAuthUser = async (
  { db }: AppContext,
  userId: string,
  client?: DatabaseClient,
): Promise<AuthUser | null> => {
  const row = await findAuthUserRow(client ?? db, userId);

  if (!row) {
    return null;
  }

  const role = toUserRole(row.role);

  // A student account without its profile is incomplete; only super admins
  // may exist without one.
  if (row.student_id === null && role !== USER_ROLE.superAdmin) {
    return null;
  }

  return {
    id: String(row.id),
    email: String(row.email),
    role,
    student:
      row.student_id === null
        ? null
        : {
            id: String(row.student_id),
            fullName: String(row.full_name),
            standard: String(row.standard),
            stream: row.stream === null ? null : String(row.stream),
            streamOther:
              row.stream_other === null ? null : String(row.stream_other),
          },
  };
};

export const registerStudent = async (
  context: AppContext,
  input: RegisterInput,
): Promise<AuthUser> => {
  const { db } = context;
  if (await findUserIdByEmail(db, input.email)) {
    throw emailAlreadyRegistered();
  }

  const passwordHash = await hashPassword(input.password);
  const userId = randomUUID();
  const timestamp = context.now().toISOString();

  try {
    await transaction(db, tx =>
      insertStudent(tx, {
        userId,
        profileId: randomUUID(),
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth,
        mobile: input.mobile,
        standard: input.standard,
        stream: input.stream,
        streamOther: input.streamOther,
        address: input.address,
        timestamp,
      }),
    );
  } catch (error) {
    // Two concurrent registrations for the same email: the second one loses
    // the UNIQUE race and gets the same answer as the pre-check.
    if (isUniqueViolation(error)) {
      throw emailAlreadyRegistered();
    }

    throw error;
  }

  const user = await getAuthUser(context, userId);

  if (!user) {
    throw new Error(`Registered user ${userId} could not be loaded`);
  }

  return user;
};

export const authenticateStudent = async (
  context: AppContext,
  input: LoginInput,
): Promise<AuthUser> => {
  const row = await findCredentialsByEmail(context.db, input.email);

  // Accounts without a password (super admins) sign in with an emailed link.
  const isValid =
    row && row.password_hash !== null
      ? await verifyPassword(input.password, String(row.password_hash))
      : await verifyAgainstDummyHash(input.password);

  const user =
    isValid && row ? await getAuthUser(context, String(row.id)) : null;

  if (!user) {
    throw new ApiError(
      401,
      ERROR_CODE.invalidCredentials,
      'The email or password is incorrect',
    );
  }

  return user;
};

export const requestPasswordReset = async (
  context: AppContext,
  email: string,
) => {
  if (!context.mailer) {
    throw new ApiError(
      503,
      ERROR_CODE.passwordRecoveryUnavailable,
      'Password recovery is not available yet. Please contact SriDha Academy support.',
    );
  }

  const userId = await findUserIdByEmail(context.db, email);

  // Always respond the same way so the endpoint cannot be used to discover
  // which emails are registered.
  if (!userId) {
    return;
  }

  const token = await issueToken(
    context,
    TOKEN_TABLE.passwordReset,
    userId,
    RESET_TOKEN_TTL_MS,
  );

  const resetUrl = new URL('/reset-password', context.config.webOrigin);
  resetUrl.searchParams.set('token', token);
  await context.mailer.sendPasswordReset(email, resetUrl.toString());
};

export const confirmPasswordReset = async (
  context: AppContext,
  token: string,
  password: string,
) => {
  const tokenId = hashToken(token);
  const now = context.now();
  const row = await findPasswordResetToken(context.db, tokenId);

  if (!row || row.used_at !== null || new Date(String(row.expires_at)) <= now) {
    throw new ApiError(
      400,
      ERROR_CODE.invalidResetToken,
      'This reset link is invalid or has expired. Request a new one.',
    );
  }

  const userId = String(row.user_id);
  const passwordHash = await hashPassword(password);

  await transaction(context.db, async tx => {
    await updatePasswordHash(tx, userId, passwordHash, now.toISOString());
    await markPasswordResetTokenUsed(tx, tokenId, now.toISOString());
    // A password change signs the account out everywhere.
    await deleteUserSessions(context, userId, tx);
  });
};

const signInLinkUnavailable = () =>
  new ApiError(
    503,
    ERROR_CODE.signInLinkUnavailable,
    'Email sign-in is not available yet. Please try again later.',
  );

const invalidSignInLink = () =>
  new ApiError(
    400,
    ERROR_CODE.invalidSignInLink,
    'This sign-in link is invalid or has expired. Request a new one.',
  );

// Emails a one-time sign-in link to a super admin. Any other email gets the
// same response and no email, so the endpoint cannot reveal who is an admin.
export const requestAdminSignIn = async (
  context: AppContext,
  email: string,
) => {
  if (!context.mailer) {
    throw signInLinkUnavailable();
  }

  const userId = await findUserIdByEmailAndRole(
    context.db,
    email,
    USER_ROLE.superAdmin,
  );

  if (!userId) {
    return;
  }

  const token = await issueToken(
    context,
    TOKEN_TABLE.signInLink,
    userId,
    SIGN_IN_LINK_TTL_MS,
  );

  const signInUrl = new URL('/admin-sign-in', context.config.webOrigin);
  signInUrl.searchParams.set('token', token);
  await context.mailer.sendAdminSignInLink(email, signInUrl.toString());
};

// Exchanges a sign-in link for the account it was issued to. Each link works
// once, expires after 15 minutes and only while the account is a super admin.
export const confirmAdminSignIn = async (
  context: AppContext,
  token: string,
): Promise<AuthUser> => {
  const tokenId = hashToken(token);
  const now = context.now();
  const row = await findSignInLink(context.db, tokenId);

  if (
    !row ||
    row.used_at !== null ||
    new Date(String(row.expires_at)) <= now ||
    toUserRole(row.role) !== USER_ROLE.superAdmin
  ) {
    throw invalidSignInLink();
  }

  // Claim the link atomically, so two clicks cannot both sign in.
  if (!(await claimSignInLink(context.db, tokenId, now.toISOString()))) {
    throw invalidSignInLink();
  }

  const user = await getAuthUser(context, String(row.user_id));

  if (!user) {
    throw invalidSignInLink();
  }

  return user;
};
