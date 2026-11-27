import { Router } from 'express';

import type { AppContext } from '../../app/context.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import type {
  AuthUserResponse,
  SignUpPendingResponse,
} from '../../contracts/auth.js';
import { validate } from '../../http/validate.js';
import {
  adminSignInConfirmSchema,
  adminSignInRequestSchema,
  changePasswordSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  signUpConfirmSchema,
  signUpSchema,
} from './auth.schema.js';
import {
  authenticateStudent,
  changePassword,
  confirmAdminSignIn,
  confirmPasswordReset,
  confirmSignUp,
  getAuthUser,
  requestAdminSignIn,
  requestPasswordReset,
  requestSignUp,
} from './auth.service.js';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  getRequiredAuth,
  requireAuth,
  setSessionCookie,
} from './session.js';

export const createAuthRouter = (context: AppContext) => {
  const router = Router();

  // The website's sign-up, step 1: name, email and password. The answer is
  // the same for every email; the account is created only once the emailed
  // code is confirmed.
  router.post('/sign-up', async (req, res) => {
    const input = validate(signUpSchema, req.body);
    await requestSignUp(context, input);
    res.status(202).json({
      message:
        "Check your email. If this address can be used for a new account, you'll receive a 6-digit code shortly",
    } satisfies SignUpPendingResponse);
  });

  // Step 2: the right code creates the account and signs the student in,
  // staying signed in on this device
  router.post('/sign-up/confirm', async (req, res) => {
    const input = validate(signUpConfirmSchema, req.body);
    const user = await confirmSignUp(context, input);
    if (req.auth) {
      await deleteSession(context, req.auth.sessionId);
    }
    const session = await createSession(context, user.id, true);
    setSessionCookie(context, res, session);
    res.status(201).json({ user } satisfies AuthUserResponse);
  });

  router.post('/login', async (req, res) => {
    const input = validate(loginSchema, req.body);
    const user = await authenticateStudent(context, input);
    if (req.auth) {
      await deleteSession(context, req.auth.sessionId);
    }
    const session = await createSession(context, user.id, input.rememberMe);
    setSessionCookie(context, res, session);
    res.json({ user });
  });

  router.post('/logout', async (req, res) => {
    if (req.auth) {
      await deleteSession(context, req.auth.sessionId);
    }

    clearSessionCookie(context, res);
    res.status(204).end();
  });

  router.get('/session', requireAuth, async (req, res) => {
    const auth = getRequiredAuth(req.auth);
    const user = await getAuthUser(context, auth.userId);

    if (!user) {
      await deleteSession(context, auth.sessionId);
      clearSessionCookie(context, res);
      throw new ApiError(
        401,
        ERROR_CODE.sessionExpired,
        'Your session has expired. Please sign in again.',
      );
    }

    res.json({ user });
  });

  router.post('/change-password', requireAuth, async (req, res) => {
    const auth = getRequiredAuth(req.auth);
    const input = validate(changePasswordSchema, req.body);
    await changePassword(context, auth, input);
    res.status(204).end();
  });

  router.post('/password-reset', async (req, res) => {
    const { email } = validate(passwordResetRequestSchema, req.body);
    await requestPasswordReset(context, email);
    res.status(202).json({
      message:
        "If an account exists for that email, you'll receive a 6-digit code shortly",
    });
  });

  // A right code sets the new password and signs the student in here
  router.post('/password-reset/confirm', async (req, res) => {
    const input = validate(passwordResetConfirmSchema, req.body);
    const user = await confirmPasswordReset(context, input);
    const session = await createSession(context, user.id, true);
    setSessionCookie(context, res, session);
    res.json({ user } satisfies AuthUserResponse);
  });

  // Password-free sign-in for super admins: request an emailed link, then
  // exchange its token for a session.
  router.post('/admin-sign-in', async (req, res) => {
    const { email } = validate(adminSignInRequestSchema, req.body);
    await requestAdminSignIn(context, email);
    res.status(202).json({
      message:
        "If this email belongs to a SriDha Academy team account, you'll receive a sign-in link shortly",
    });
  });

  router.post('/admin-sign-in/confirm', async (req, res) => {
    const { token } = validate(adminSignInConfirmSchema, req.body);
    const user = await confirmAdminSignIn(context, token);
    const session = await createSession(context, user.id, false);
    setSessionCookie(context, res, session);
    res.json({ user });
  });

  return router;
};
