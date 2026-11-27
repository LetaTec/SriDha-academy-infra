import { API_CLIENT } from '@services/http/api';

import type {
  AdminSignInConfirmRequest,
  AdminSignInRequest,
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  SignUpConfirmRequest,
  SignUpRequest,
} from './types';

type AuthUserResponse = { user: AuthUser };

// Sign-up: the name, email and password first, which emails a 6-digit
// code; the code then creates the account and signs the student in (and
// they stay signed in)
export const requestSignUp = async (body: SignUpRequest) => {
  await API_CLIENT.post('/auth/sign-up', body);
};

export const confirmSignUp = async (body: SignUpConfirmRequest) =>
  (await API_CLIENT.post<AuthUserResponse>('/auth/sign-up/confirm', body)).data
    .user;

export const signInStudent = async (body: LoginRequest) =>
  (await API_CLIENT.post<AuthUserResponse>('/auth/login', body)).data.user;

// "Forgot password": a 6-digit code is emailed, then the code and a new
// password sign the student in
export const requestPasswordReset = async (body: PasswordResetRequest) => {
  await API_CLIENT.post('/auth/password-reset', body);
};

export const confirmPasswordReset = async (body: PasswordResetConfirmRequest) =>
  (
    await API_CLIENT.post<AuthUserResponse>(
      '/auth/password-reset/confirm',
      body,
    )
  ).data.user;

export const changePassword = async (body: ChangePasswordRequest) => {
  await API_CLIENT.post('/auth/change-password', body);
};

export const logoutStudent = async () => {
  await API_CLIENT.post('/auth/logout');
};

export const getCurrentSession = async () =>
  (await API_CLIENT.get<AuthUserResponse>('/auth/session')).data.user;

// Super admins sign in with a one-time link emailed to them.
export const requestAdminSignIn = async (body: AdminSignInRequest) => {
  await API_CLIENT.post('/auth/admin-sign-in', body);
};

export const confirmAdminSignIn = async (body: AdminSignInConfirmRequest) =>
  (await API_CLIENT.post<AuthUserResponse>('/auth/admin-sign-in/confirm', body))
    .data.user;
