// Accounts, sign-in and registration. See catalogue.ts for what this folder
// is.

import type { IndianState } from './payments.js';

// Staff roles sign in with an emailed one-time link and have no student
// profile. FINANCE_ADMIN works with payments, refunds, invoices and
// reports; OPERATIONS_ADMIN with operational views only.
export type UserRole =
  'STUDENT' | 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATIONS_ADMIN';

export type StudentStandard =
  | 'CLASS_10'
  | 'CLASS_11'
  | 'CLASS_12'
  | 'CA'
  | 'CS'
  | 'NEET'
  | 'JEE'
  | 'BANK_PO';

export type StudentStream = 'COMMERCE' | 'SCIENCE' | 'ARTS' | 'OTHER';

// The signed-in account. A super admin account may have no student
// profile.
export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  // The name to greet them by: from sign-up, or an older student profile
  name: string | null;
  // From sign-up; null for older accounts and the team
  contact: AccountContact | null;
  student: {
    id: string;
    fullName: string;
    standard: StudentStandard;
    stream: StudentStream | null;
    streamOther: string | null;
  } | null;
};

export type AuthUserResponse = { user: AuthUser };

export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  mobile: string;
  standard: StudentStandard;
  stream: StudentStream | null;
  // Required when stream is OTHER
  streamOther: string | null;
  address: string | null;
};

// Students sign up with just these; no email check for now
export type SignUpRequest = {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  state: IndianState;
  city: string;
  // A 6-digit Indian PIN code
  pinCode: string;
};

// The contact details a student gave at sign-up, which checkout fills in
export type AccountContact = {
  mobile: string;
  state: IndianState;
  city: string;
  pinCode: string;
};

// A signed-in student changes their password; other devices sign out
export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type LoginRequest = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type PasswordResetRequest = { email: string };

// The 6-digit code emailed by "Forgot password", and the new password
export type PasswordResetConfirmRequest = {
  email: string;
  code: string;
  password: string;
};

export type AdminSignInRequest = { email: string };

export type AdminSignInConfirmRequest = { token: string };
