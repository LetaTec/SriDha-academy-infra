import { randomUUID } from 'node:crypto';

import type { AppContext } from '../../app/context.js';
import type {
  AuthUser,
  StudentStandard,
  StudentStream,
} from '../../contracts/auth.js';
import { transaction, type DatabaseClient } from '../../db/client.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { logger } from '../../logging/logger.js';
import {
  claimPasswordlessStudent,
  claimSignInLink,
  countResetCodeAttempt,
  findAccountByEmail,
  findAuthUserRow,
  findCredentialsByEmail,
  findLatestResetCode,
  findSignInLink,
  findUserIdByEmail,
  findUserRole,
  insertResetCode,
  insertSignedUpStudent,
  insertStudent,
  insertToken,
  markPasswordResetTokenUsed,
  revokeUnusedTokens,
  TOKEN_TABLE,
  updatePasswordHash,
} from './auth.repository.js';
import type {
  LoginInput,
  PasswordResetConfirmInput,
  RegisterInput,
  SignUpInput,
} from './auth.schema.js';
import {
  hashPassword,
  verifyAgainstDummyHash,
  verifyPassword,
} from './password.js';
import { isStaffRole, toUserRole, USER_ROLE } from './roles.js';
import { deleteUserSessions } from './session.js';
import {
  generateCode,
  generateToken,
  hashCode,
  hashToken,
  isSameHash,
} from './tokens.js';

// A reset code works for 15 minutes and allows 5 tries
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const SIGN_IN_LINK_TTL_MS = 15 * 60 * 1000;

// The authenticated account (users.id) is the canonical identity. Every
// student account owns exactly one student profile, created in the same
// transaction; a super admin account may have none.
export type { AuthUser };

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

  // A student needs a profile (older accounts) or a password from
  // sign-up; a checkout buyer's password-less record cannot sign in. Staff
  // need neither.
  if (row.student_id === null && !row.has_password && !isStaffRole(role)) {
    return null;
  }

  const name = row.full_name ?? row.account_name;

  return {
    id: String(row.id),
    email: String(row.email),
    role,
    name: name === null ? null : String(name),
    student:
      row.student_id === null
        ? null
        : {
            id: String(row.student_id),
            fullName: String(row.full_name),
            standard: String(row.standard) as StudentStandard,
            stream:
              row.stream === null
                ? null
                : (String(row.stream) as StudentStream),
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

// Students sign up with a name, email and password; nothing is emailed to
// check the address yet. A billing email that checkout already recorded
// (with no password) becomes this account. An email that already has a
// password, or belongs to staff, must sign in instead.
export const signUpStudent = async (
  context: AppContext,
  input: SignUpInput,
): Promise<AuthUser> => {
  const { db } = context;
  const passwordHash = await hashPassword(input.password);
  const timestamp = context.now().toISOString();
  const existing = await findAccountByEmail(db, input.email);
  let userId: string;

  if (!existing) {
    userId = randomUUID();
    try {
      await insertSignedUpStudent(db, {
        id: userId,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        role: USER_ROLE.student,
        timestamp,
      });
    } catch (error) {
      // Two sign-ups for one email at once: the second gets the same answer
      if (isUniqueViolation(error)) throw emailAlreadyRegistered();
      throw error;
    }
  } else {
    userId = String(existing.id);
    const isClaimed = await claimPasswordlessStudent(db, {
      userId,
      fullName: input.fullName,
      passwordHash,
      role: USER_ROLE.student,
      timestamp,
    });
    if (!isClaimed) throw emailAlreadyRegistered();
  }

  const user = await getAuthUser(context, userId);
  if (!user) {
    throw new Error(`Signed-up account ${userId} could not be loaded`);
  }

  logger.info('auth.student_signed_up', {
    userId,
    fromCheckout: Boolean(existing),
  });
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

// "Forgot password": emails a 6-digit code to a student account. Staff sign
// in with emailed links and never get a password. A checkout buyer with no
// password yet can use it to set one, since the code proves the email is
// theirs.
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

  const account = await findAccountByEmail(context.db, email);

  // Always respond the same way so the endpoint cannot be used to discover
  // which emails are registered.
  if (!account || account.role !== USER_ROLE.student) {
    return;
  }

  const userId = String(account.id);
  const code = generateCode();
  const codeId = randomUUID();
  const now = context.now();

  await transaction(context.db, async tx => {
    // Only the newest code works
    await revokeUnusedTokens(
      tx,
      TOKEN_TABLE.passwordReset,
      userId,
      now.toISOString(),
    );
    await insertResetCode(tx, {
      id: codeId,
      userId,
      codeHash: hashCode(codeId, code),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + RESET_CODE_TTL_MS).toISOString(),
    });
  });

  await context.mailer.sendPasswordResetCode(email, code);
  logger.info('auth.password_reset_code_sent', { userId });
};

const invalidResetCode = () =>
  new ApiError(
    400,
    ERROR_CODE.invalidResetToken,
    'That code is wrong or has expired. Check the email, or ask for a new code.',
  );

// Sets the new password if the code matches, signs the account out
// everywhere else, and returns it so the student can be signed in here.
export const confirmPasswordReset = async (
  context: AppContext,
  input: PasswordResetConfirmInput,
): Promise<AuthUser> => {
  const now = context.now();
  const account = await findAccountByEmail(context.db, input.email);
  if (!account || account.role !== USER_ROLE.student) {
    throw invalidResetCode();
  }

  const userId = String(account.id);
  const row = await findLatestResetCode(context.db, userId);
  if (!row || new Date(String(row.expires_at)) <= now) {
    throw invalidResetCode();
  }

  const attempts = await countResetCodeAttempt(context.db, String(row.id));
  const isMatch =
    attempts <= RESET_CODE_MAX_ATTEMPTS &&
    isSameHash(hashCode(String(row.id), input.code), String(row.code_hash));

  if (!isMatch) {
    logger.warn('auth.password_reset_code_rejected', { userId, attempts });
    throw invalidResetCode();
  }

  const passwordHash = await hashPassword(input.password);
  await transaction(context.db, async tx => {
    await updatePasswordHash(tx, userId, passwordHash, now.toISOString());
    await markPasswordResetTokenUsed(tx, String(row.id), now.toISOString());
    // A password change signs the account out everywhere.
    await deleteUserSessions(context, userId, tx);
  });

  const user = await getAuthUser(context, userId);
  if (!user) {
    throw new Error(`Account ${userId} could not be loaded after a reset`);
  }

  logger.info('auth.password_reset', { userId });
  return user;
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

// Emails a one-time sign-in link to a staff member (any staff role). Any
// other email gets the same response and no email, so the endpoint cannot
// reveal who is staff.
export const requestAdminSignIn = async (
  context: AppContext,
  email: string,
) => {
  if (!context.mailer) {
    throw signInLinkUnavailable();
  }

  const userId = await findUserIdByEmail(context.db, email);

  if (!userId || !isStaffRole(await findUserRole(context.db, userId))) {
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
// once, expires after 15 minutes and only while the account is staff.
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
    !isStaffRole(row.role)
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
