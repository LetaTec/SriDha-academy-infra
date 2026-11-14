import type { UserRole } from '@contracts/auth';

export const AUTH_QUERY_PARAM = {
  signInToken: 'token',
} as const;

// Account roles, mirrored from the API. The API decides who holds each role.
// Students have no accounts to sign in to; only the team signs in.
export const USER_ROLE = {
  student: 'STUDENT',
  superAdmin: 'SUPER_ADMIN',
} as const satisfies Record<string, UserRole>;

export type { UserRole };

export const AUTH_ERROR_CODE = {
  unauthenticated: 'UNAUTHENTICATED',
  sessionExpired: 'SESSION_EXPIRED',
} as const;

export const AUTH_TEXT = {
  emailLabel: 'Email ID',
  emailPlaceholder: 'you@example.com',
  emailInvalid: 'Enter a valid email address',
  loggedOutToast: 'Signed out',
  logoutErrorToast: 'We could not sign you out. Please try again',
  sessionExpiredToast: 'Your session has expired. Please sign in again',
} as const;

// Password-free sign-in for the SriDha Academy team (super admins)
export const ADMIN_SIGN_IN_TEXT = {
  eyebrow: 'Team / Sign in',
  title: 'Team',
  titleEmphasis: 'sign-in.',
  description:
    'Enter your team email and we will send you a one-time sign-in link. No password needed',
  submit: 'Email me a sign-in link',
  sentMessage:
    'If this email belongs to a team account, a sign-in link is on its way. It works once and expires in 15 minutes',
  confirming: 'Signing you in',
  linkError: 'This sign-in link could not be used. Request a new one below',
  signedInToast: 'Signed in to your team account',
  footerLink: 'Team sign-in',
} as const;
