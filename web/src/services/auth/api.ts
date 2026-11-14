import { API_CLIENT } from '@services/http/api';

import type {
  AdminSignInConfirmRequest,
  AdminSignInRequest,
  AuthUser,
} from './types';

type AuthUserResponse = { user: AuthUser };

// Students never sign in; these serve the team's session
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
