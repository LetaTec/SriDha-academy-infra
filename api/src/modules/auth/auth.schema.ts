import { z } from 'zod';

import type {
  AdminSignInConfirmRequest,
  AdminSignInRequest,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  RegisterRequest,
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

const OTHER_STREAM = 'OTHER' satisfies (typeof STUDENT_STREAMS)[number];

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

const isPastDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
};

export const registerSchema = z
  .strictObject({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    email: emailSchema,
    password: passwordSchema,
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth')
      .refine(isPastDate, 'Date of birth must be in the past'),
    mobile: mobileSchema,
    standard: z.enum(STUDENT_STANDARDS, 'Select your standard or exam'),
    stream: z.enum(STUDENT_STREAMS).nullable().default(null),
    // Free-text stream, required only when the student picks "Other".
    streamOther: z
      .string()
      .trim()
      .max(80, 'Keep your stream under 80 characters')
      .nullable()
      .default(null)
      .transform(value => value || null),
    address: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .default(null)
      .transform(value => value || null),
  })
  .superRefine((input, ctx) => {
    if (input.stream === OTHER_STREAM && !input.streamOther) {
      ctx.addIssue({
        code: 'custom',
        path: ['streamOther'],
        message: 'Tell us your stream',
      });
    }
  })
  .transform(input => ({
    ...input,
    streamOther: input.stream === OTHER_STREAM ? input.streamOther : null,
  })) satisfies z.ZodType<RegisterRequest>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX_LENGTH),
  rememberMe: z.boolean().default(false),
}) satisfies z.ZodType<LoginRequest>;

export const passwordResetRequestSchema = z.strictObject({
  email: emailSchema,
}) satisfies z.ZodType<PasswordResetRequest>;

export const passwordResetConfirmSchema = z.strictObject({
  token: z.string().min(1).max(256),
  password: passwordSchema,
}) satisfies z.ZodType<PasswordResetConfirmRequest>;

export const adminSignInRequestSchema = z.strictObject({
  email: emailSchema,
}) satisfies z.ZodType<AdminSignInRequest>;

export const adminSignInConfirmSchema = z.strictObject({
  token: z.string().min(1).max(256),
}) satisfies z.ZodType<AdminSignInConfirmRequest>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
