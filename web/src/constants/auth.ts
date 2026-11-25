import type { UserRole } from '@contracts/auth';

export const AUTH_QUERY_PARAM = {
  signInToken: 'token',
} as const;

// Account roles, mirrored from the API. The API decides who holds each role.
// Students sign up with a name, email and password the first time they
// answer a question; the team signs in with an emailed link.
export const USER_ROLE = {
  student: 'STUDENT',
  superAdmin: 'SUPER_ADMIN',
  financeAdmin: 'FINANCE_ADMIN',
  operationsAdmin: 'OPERATIONS_ADMIN',
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

// The student account: asked for when they first answer a question or
// start a timed test, and reached from the profile button in the header
export const ACCOUNT_TEXT = {
  signUpEyebrow: 'SriDha Academy / Free account',
  signUpTitle: 'Create your',
  signUpTitleEmphasis: 'account.',
  signUpLead:
    'Make a free account to answer questions and take the tests. It takes a moment',
  signInEyebrow: 'SriDha Academy / Welcome back',
  signInTitle: 'Sign in to',
  signInTitleEmphasis: 'continue.',
  signInLead: 'Use the email and password you signed up with',
  nameLabel: 'Full name',
  namePlaceholder: 'Your name',
  nameInvalid: 'Enter your full name',
  passwordLabel: 'Password',
  newPasswordLabel: 'Create a password',
  passwordHint: 'At least 8 characters',
  passwordTooShort: 'Use at least 8 characters',
  passwordRequired: 'Enter your password',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  signUpSubmit: 'Create account',
  signInSubmit: 'Sign in',
  haveAccount: 'Already have an account?',
  switchToSignIn: 'Sign in',
  noAccount: 'New here?',
  switchToSignUp: 'Create an account',
  forgotPassword: 'Forgot password?',
  resetEyebrow: 'SriDha Academy / Forgot password',
  resetTitle: 'Choose a new',
  resetTitleEmphasis: 'password.',
  resetLead: 'We will email you a 6-digit code to set a new password',
  resetCodeLead: (email: string) =>
    `Enter the 6-digit code we sent to ${email}, then choose a new password`,
  sendCode: 'Email me a code',
  codeLabel: '6-digit code',
  codeInvalid: 'Enter the 6-digit code from the email',
  newPasswordLabel2: 'New password',
  resetSubmit: 'Set password and sign in',
  resendCode: 'Send a new code',
  backToSignIn: 'Back to sign in',
  resetToast: 'Password changed. You are signed in',
  signedUpToast: (name: string) => `Welcome, ${name}`,
  signedInToast: 'Signed in',
  profileLabel: 'Your account',
  signInLabel: 'Sign in or create an account',
  signOut: 'Sign out',
  // Over a paper until the visitor signs in
  lockTitle: 'Sign up or log in to start the test',
  lockLead:
    'A free account lets you answer, see your score and every right answer',
  lockSignUp: 'Sign up',
  lockLogIn: 'Log in',
  lockLabel: 'Sign in to start this paper',
  changePassword: 'Change password',
  myBatches: 'My batches',
  changeEyebrow: 'SriDha Academy / Your account',
  changeTitle: 'Change your',
  changeTitleEmphasis: 'password.',
  changeLead: 'Other devices signed in to your account will be signed out',
  currentPasswordLabel: 'Current password',
  changeSubmit: 'Save new password',
  changedToast: 'Password changed',
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
