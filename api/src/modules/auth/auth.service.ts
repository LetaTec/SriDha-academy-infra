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
  consumeSignUpVerification,
  countResetCodeAttempt,
  countSignUpCodeAttempt,
  deleteOtherSessions,
  findAccountByEmail,
  findOpenSignUpVerification,
  findSignUpRequestStats,
  lockSignUpEmail,
  findAuthUserRow,
  findCredentialsByEmail,
  findLatestResetCode,
  findPasswordHash,
  findSignInLink,
  findUserIdByEmail,
  findUserRole,
  insertResetCode,
  insertSignedUpStudent,
  insertSignUpVerification,
  insertToken,
  markPasswordResetTokenUsed,
  revokeOpenSignUpVerifications,
  revokeUnusedTokens,
  TOKEN_TABLE,
  updatePasswordHash,
} from './auth.repository.js';
import type {
  ChangePasswordInput,
  LoginInput,
  PasswordResetConfirmInput,
  SignUpConfirmInput,
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
// A sign-up code works for 15 minutes and allows 5 tries. A new one can be
// asked for once a minute and 5 times an hour per email, so guessing is
// capped at 25 tries an hour, each new code also landing in the real inbox.
const SIGN_UP_CODE_TTL_MS = 15 * 60 * 1000;
const SIGN_UP_CODE_MAX_ATTEMPTS = 5;
const SIGN_UP_RESEND_COOLDOWN_MS = 60 * 1000;
const SIGN_UP_REQUESTS_PER_HOUR = 5;
// After 15 wrong tries in a day no new code is sent to that email, so a
// guesser gets at most about 20 tries a day (15 plus one code's 5)
const SIGN_UP_FAILED_TRIES_PER_DAY = 15;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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

// Emails that must not change the response: whether the address has an
// account (or is staff) must not show in the status or body, in whether
// the provider accepted the email, or in a wait for the provider. So the
// request never waits for it, and a failure is logged (without the code or
// link, which the mailer's errors never carry), not returned. The person
// asking sees no email and asks again. (A registered address still costs
// one small database write that an unknown one does not.)
const sendWithoutWaiting = (
  event: string,
  fields: { userId: string },
  send: () => Promise<void>,
) => {
  // Started inside a promise chain, so a mailer that throws synchronously
  // is caught too, and a failing log call cannot escape either
  void Promise.resolve()
    .then(send)
    .then(
      () => logger.info(`${event}_sent`, fields),
      (error: unknown) => logger.error(`${event}_failed`, { ...fields, error }),
    )
    .catch(() => {});
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

const signUpUnavailable = () =>
  new ApiError(
    503,
    ERROR_CODE.signUpUnavailable,
    'Creating an account is not available right now. Please try again later.',
  );

const invalidSignUpCode = () =>
  new ApiError(
    400,
    ERROR_CODE.invalidSignUpCode,
    'That code is wrong or has expired. Check the email, or ask for a new code.',
  );

// Step 1 of sign-up: a name, email and password. Nothing is created yet and
// nobody is signed in. The answer never depends on the email, so it cannot
// reveal who has an account or who has bought something at checkout:
// - a new email, or a checkout buyer's email with no password yet, is
//   emailed a 6-digit code (the name and password wait, hashed, for it);
// - an email that already has an account (a password, or staff) is
//   emailed a note saying so instead;
// - a request within a minute of the last one, or past 5 in an hour, is
//   answered the same way and emails nothing.
export const requestSignUp = async (
  context: AppContext,
  input: SignUpInput,
) => {
  if (!context.mailer) throw signUpUnavailable();
  const { db, mailer } = context;

  // Hashed whatever happens next, so every answer takes about as long
  const passwordHash = await hashPassword(input.password);
  const now = context.now();
  const timestamp = now.toISOString();
  const { email } = input;

  const id = randomUUID();
  const expiresAt = new Date(now.getTime() + SIGN_UP_CODE_TTL_MS).toISOString();
  const code = generateCode();

  // One request per email at a time: the throttle check and the new row are
  // decided together, so simultaneous requests cannot all pass the check
  const outcome = await transaction(db, async tx => {
    await lockSignUpEmail(tx, email);
    const recent = await findSignUpRequestStats(
      tx,
      email,
      new Date(now.getTime() - HOUR_MS).toISOString(),
      new Date(now.getTime() - DAY_MS).toISOString(),
      SIGN_UP_CODE_MAX_ATTEMPTS,
    );
    if (
      recent.total >= SIGN_UP_REQUESTS_PER_HOUR ||
      recent.failedTries >= SIGN_UP_FAILED_TRIES_PER_DAY ||
      (recent.newest &&
        now.getTime() - recent.newest.getTime() < SIGN_UP_RESEND_COOLDOWN_MS)
    ) {
      logger.info('auth.sign_up_request_throttled', {
        requests: recent.total,
      });
      return { kind: 'throttled' as const };
    }

    const account = await findAccountByEmail(tx, email);
    const isClaimable =
      !account ||
      (account.role === USER_ROLE.student && account.password_hash === null);

    if (!isClaimable) {
      await insertSignUpVerification(tx, {
        id,
        email,
        fullName: null,
        passwordHash: null,
        codeHash: null,
        createdAt: timestamp,
        expiresAt,
      });
      return { kind: 'notice' as const, account };
    }

    // Only the newest code for an email works
    await revokeOpenSignUpVerifications(tx, email, timestamp);
    await insertSignUpVerification(tx, {
      id,
      email,
      fullName: input.fullName,
      passwordHash,
      codeHash: hashCode(id, code),
      createdAt: timestamp,
      expiresAt,
    });
    return { kind: 'code' as const, account };
  });

  // Emails go out after the rows are committed, without waiting
  if (outcome.kind === 'notice') {
    const signInUrl = new URL(
      isStaffRole(outcome.account.role) ? '/admin-sign-in' : '/',
      context.config.webOrigin,
    ).toString();
    sendWithoutWaiting(
      'auth.account_exists_notice',
      { userId: String(outcome.account.id) },
      () => mailer.sendAccountExistsNotice(email, signInUrl),
    );
  } else if (outcome.kind === 'code') {
    sendWithoutWaiting(
      'auth.sign_up_code',
      {
        userId: outcome.account ? String(outcome.account.id) : `pending:${id}`,
      },
      () => mailer.sendSignUpCode(email, code),
    );
  }
};

// Step 2: the emailed code. A right code creates the account (or gives the
// checkout buyer's record its name and password, keeping their purchases)
// and signs the student in. Each code works once, for 15 minutes, with 5
// tries; only the newest code for an email works.
export const confirmSignUp = async (
  context: AppContext,
  input: SignUpConfirmInput,
): Promise<AuthUser> => {
  const { db } = context;
  const now = context.now();
  const timestamp = now.toISOString();

  const row = await findOpenSignUpVerification(db, input.email);
  if (!row || new Date(String(row.expires_at)) <= now) {
    // Hash anyway: answering at once would show that this email has no
    // pending sign-up, i.e. that it already has an account
    await verifyAgainstDummyHash(input.password);
    throw invalidSignUpCode();
  }

  const attempts = await countSignUpCodeAttempt(db, String(row.id));
  // The code proves the inbox; the password proves this is the person who
  // asked for that code. Without it, someone who asked first with their own
  // password could have it put on the owner's account when the owner types
  // the only code they received. Both are checked on every try (one try
  // each), and a wrong password looks exactly like a wrong code.
  const isCodeRight = isSameHash(
    hashCode(String(row.id), input.code),
    String(row.code_hash),
  );
  const isPasswordRight = await verifyPassword(
    input.password,
    String(row.password_hash),
  );
  const isMatch =
    attempts <= SIGN_UP_CODE_MAX_ATTEMPTS && isCodeRight && isPasswordRight;
  if (!isMatch) {
    logger.warn('auth.sign_up_code_rejected', { attempts });
    throw invalidSignUpCode();
  }

  let fromCheckout = false;
  const userId = await transaction(db, async tx => {
    // Two requests racing with the same code: only one gets past here
    if (!(await consumeSignUpVerification(tx, String(row.id), timestamp))) {
      throw invalidSignUpCode();
    }

    const existing = await findAccountByEmail(tx, input.email);
    if (!existing) {
      const newId = randomUUID();
      try {
        await insertSignedUpStudent(tx, {
          id: newId,
          email: input.email,
          fullName: String(row.full_name),
          passwordHash: String(row.password_hash),
          role: USER_ROLE.student,
          timestamp,
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw emailAlreadyRegistered();
        throw error;
      }
      return newId;
    }

    // The code proved the email is theirs, so saying it already has an
    // account reveals nothing to anyone else
    const isClaimed = await claimPasswordlessStudent(tx, {
      userId: String(existing.id),
      fullName: String(row.full_name),
      passwordHash: String(row.password_hash),
      role: USER_ROLE.student,
      timestamp,
    });
    if (!isClaimed) throw emailAlreadyRegistered();
    fromCheckout = true;
    return String(existing.id);
  });

  const user = await getAuthUser(context, userId);
  if (!user) {
    throw new Error(`Signed-up account ${userId} could not be loaded`);
  }

  logger.info('auth.student_signed_up', { userId, fromCheckout });
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

  const { mailer } = context;
  sendWithoutWaiting('auth.password_reset_code', { userId }, () =>
    mailer.sendPasswordResetCode(email, code),
  );
};

// A signed-in student changes their password with the current one. Other
// devices are signed out; this one stays signed in. Staff have no password.
export const changePassword = async (
  context: AppContext,
  auth: { userId: string; sessionId: string },
  input: ChangePasswordInput,
) => {
  const storedHash = await findPasswordHash(context.db, auth.userId);
  const isValid =
    storedHash === null
      ? await verifyAgainstDummyHash(input.currentPassword)
      : await verifyPassword(input.currentPassword, storedHash);

  if (!isValid || storedHash === null) {
    throw new ApiError(
      400,
      ERROR_CODE.currentPasswordIncorrect,
      'Your current password is not right',
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  const timestamp = context.now().toISOString();
  await transaction(context.db, async tx => {
    await updatePasswordHash(tx, auth.userId, passwordHash, timestamp);
    await deleteOtherSessions(tx, auth.userId, auth.sessionId);
  });

  logger.info('auth.password_changed', { userId: auth.userId });
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
  const { mailer } = context;
  sendWithoutWaiting('auth.admin_sign_in_link', { userId }, () =>
    mailer.sendAdminSignInLink(email, signInUrl.toString()),
  );
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
