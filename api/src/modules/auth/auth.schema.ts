import { z } from 'zod';

import type {
  AdminSignInConfirmRequest,
  ChangePasswordRequest,
  AdminSignInRequest,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  SignUpConfirmRequest,
  SignUpRequest,
  StudentStandard,
  StudentStream,
} from '../../contracts/auth.js';

export const STUDENT_STANDARDS = [
  'CLASS_10',
  'CLASS_11',
  'CLASS_12',
  'CA',
  'CS',
  'NEET',
  'JEE',
  'BANK_PO',
] as const satisfies readonly StudentStandard[];

export const STUDENT_STREAMS = [
  'COMMERCE',
  'SCIENCE',
  'ARTS',
  'OTHER',
] as const satisfies readonly StudentStream[];

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address'));

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{8,16}[0-9]$/, 'Enter a valid mobile number');

const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  )
  .max(PASSWORD_MAX_LENGTH, 'Password is too long');

export const signUpSchema = z.strictObject({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: emailSchema,
  password: passwordSchema,
}) satisfies z.ZodType<SignUpRequest>;

export const signUpConfirmSchema = z.strictObject({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
  // The password chosen in step 1, which ties the code to whoever asked
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
}) satisfies z.ZodType<SignUpConfirmRequest>;

export const changePasswordSchema = z.strictObject({
  currentPassword: z
    .string()
    .min(1, 'Enter your current password')
    .max(PASSWORD_MAX_LENGTH),
  newPassword: passwordSchema,
}) satisfies z.ZodType<ChangePasswordRequest>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX_LENGTH),
  rememberMe: z.boolean().default(false),
}) satisfies z.ZodType<LoginRequest>;

export const passwordResetRequestSchema = z.strictObject({
  email: emailSchema,
}) satisfies z.ZodType<PasswordResetRequest>;

export const passwordResetConfirmSchema = z.strictObject({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
  password: passwordSchema,
}) satisfies z.ZodType<PasswordResetConfirmRequest>;

export const adminSignInRequestSchema = z.strictObject({
  email: emailSchema,
}) satisfies z.ZodType<AdminSignInRequest>;

export const adminSignInConfirmSchema = z.strictObject({
  token: z.string().min(1).max(256),
}) satisfies z.ZodType<AdminSignInConfirmRequest>;

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignUpConfirmInput = z.infer<typeof signUpConfirmSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type PasswordResetConfirmInput = z.infer<
  typeof passwordResetConfirmSchema
>;
