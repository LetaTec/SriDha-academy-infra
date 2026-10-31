// Accounts, sign-in and registration. See catalogue.ts for what this folder
// is.

export type UserRole = 'STUDENT' | 'SUPER_ADMIN';

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

export type LoginRequest = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type PasswordResetRequest = { email: string };

export type PasswordResetConfirmRequest = {
  token: string;
  password: string;
};

export type AdminSignInRequest = { email: string };

export type AdminSignInConfirmRequest = { token: string };
