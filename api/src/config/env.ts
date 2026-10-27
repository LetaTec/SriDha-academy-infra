import { existsSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

export const MAIL_TRANSPORT = {
  console: 'console',
  resend: 'resend',
} as const;

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_PATH: z.string().min(1).default('./data/leta-ed.sqlite'),
  WEB_ORIGIN: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  SESSION_TTL_DAYS: z.coerce.number().positive().default(1),
  SESSION_REMEMBER_TTL_DAYS: z.coerce.number().positive().default(30),
  MAIL_TRANSPORT: z
    .enum([MAIL_TRANSPORT.console, MAIL_TRANSPORT.resend])
    .optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z
    .string()
    .min(1)
    .default('SriDha Academy <noreply@sridhaacademy.com>'),
  PG_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
  ENABLE_RATE_LIMIT: z
    .enum(['true', 'false'])
    .optional()
    .transform(value => (value === undefined ? undefined : value === 'true')),
  SERVE_WEB_DIST: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'none', 'strict']).optional(),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  // Comma-separated emails that are super admins (password-free sign-in)
  SUPER_ADMIN_EMAILS: z.string().optional(),
  // Razorpay API keys. Without them checkout runs in test mode: orders are
  // saved as payment pending and nothing is charged.
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  // Set in Razorpay's dashboard (Settings → Webhooks). Lets Razorpay confirm
  // payments even when the student closes the page before we can.
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type AppConfig = {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string | null;
  databasePath: string;
  webOrigin: string;
  allowedOrigins: string[];
  sessionTtlMs: number;
  sessionRememberTtlMs: number;
  mailTransport: (typeof MAIL_TRANSPORT)[keyof typeof MAIL_TRANSPORT] | null;
  resendApiKey: string | null;
  emailFrom: string;
  pgMaxConnections: number;
  enableRateLimiting: boolean;
  serveWebDist: boolean;
  secureCookies: boolean;
  cookieSameSite: 'lax' | 'none' | 'strict';
  cookieDomain?: string;
  superAdminEmails: string[];
  razorpay: { keyId: string; keySecret: string } | null;
  razorpayWebhookSecret: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEVELOPMENT_WEB_ORIGIN = 'http://localhost:5173';

const loadEnvFile = () => {
  const envPath = path.resolve(process.cwd(), '.env');

  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
};

export const loadConfig = (
  source: NodeJS.ProcessEnv = process.env,
): AppConfig => {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API configuration — ${issues}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction && !env.WEB_ORIGIN) {
    throw new Error(
      'Invalid API configuration — WEB_ORIGIN is required in production',
    );
  }

  if (isProduction && !env.DATABASE_URL) {
    throw new Error(
      'Invalid API configuration — DATABASE_URL is required in production',
    );
  }

  if (isProduction && env.MAIL_TRANSPORT === MAIL_TRANSPORT.console) {
    throw new Error(
      'Invalid API configuration — MAIL_TRANSPORT=console exposes reset links in logs and is not allowed in production',
    );
  }

  if (Boolean(env.RAZORPAY_KEY_ID) !== Boolean(env.RAZORPAY_KEY_SECRET)) {
    throw new Error(
      'Invalid API configuration — set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or neither',
    );
  }

  if (env.MAIL_TRANSPORT === MAIL_TRANSPORT.resend && !env.RESEND_API_KEY) {
    throw new Error(
      'Invalid API configuration — RESEND_API_KEY is required when MAIL_TRANSPORT=resend',
    );
  }

  const normalizeOrigin = (origin: string): string =>
    origin.trim().replace(/\/+$/, '');

  const primaryOrigin = normalizeOrigin(
    env.WEB_ORIGIN ?? DEVELOPMENT_WEB_ORIGIN,
  );
  const additionalOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
    : [];

  const originList = [primaryOrigin, ...additionalOrigins];
  for (const origin of [...originList]) {
    if (
      origin === 'https://sridhaacademy.com' &&
      !originList.includes('https://www.sridhaacademy.com')
    ) {
      originList.push('https://www.sridhaacademy.com');
    }
    if (
      origin === 'https://www.sridhaacademy.com' &&
      !originList.includes('https://sridhaacademy.com')
    ) {
      originList.push('https://sridhaacademy.com');
    }
  }

  const allowedOrigins = Array.from(new Set(originList));
  const cookieSameSite = env.COOKIE_SAMESITE ?? (isProduction ? 'none' : 'lax');

  return {
    env: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL ?? null,
    databasePath: env.DATABASE_PATH,
    webOrigin: primaryOrigin,
    allowedOrigins,
    sessionTtlMs: env.SESSION_TTL_DAYS * DAY_MS,
    sessionRememberTtlMs: env.SESSION_REMEMBER_TTL_DAYS * DAY_MS,
    mailTransport: env.MAIL_TRANSPORT ?? null,
    resendApiKey: env.RESEND_API_KEY ?? null,
    emailFrom: env.EMAIL_FROM,
    pgMaxConnections: env.PG_MAX_CONNECTIONS,
    enableRateLimiting: env.ENABLE_RATE_LIMIT ?? env.NODE_ENV !== 'test',
    serveWebDist: env.SERVE_WEB_DIST,
    secureCookies: isProduction,
    cookieSameSite,
    cookieDomain: env.COOKIE_DOMAIN,
    superAdminEmails: (env.SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
    razorpay:
      env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
        ? { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET }
        : null,
    razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? null,
  };
};

export const loadConfigFromEnvironment = () => {
  loadEnvFile();
  return loadConfig();
};
