import type { AddressInfo } from 'node:net';

import { createApp } from '../app/app.js';
import { loadConfig } from '../config/env.js';
import { seedCatalogue } from '../db/catalogueSeed.js';
import { openDatabase, runMigrations } from '../db/client.js';
import type { Mailer } from '../mail/mailer.js';
import { syncSuperAdmins } from '../modules/auth/roles.js';
import type { PaymentGateway } from '../modules/payments/gateway.js';

export const TEST_WEB_ORIGIN = 'http://localhost:5173';

export type SentResetEmail = { email: string; resetUrl: string };
export type SentSignInLink = { email: string; signInUrl: string };

export const TEST_SUPER_ADMIN_EMAIL = 'admin@sridha.test';

export type TestClient = {
  request: (
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<{ status: number; body: any; setCookie: string | null }>;
  clearCookies: () => void;
};

export const startTestServer = async ({
  withMailer = true,
  enableRateLimiting = false,
  now = () => new Date('2026-10-10T09:00:00Z'),
  superAdminEmails = [TEST_SUPER_ADMIN_EMAIL],
  paymentGateway,
  razorpayWebhookSecret,
}: {
  withMailer?: boolean;
  enableRateLimiting?: boolean;
  now?: () => Date;
  superAdminEmails?: string[];
  paymentGateway?: PaymentGateway;
  razorpayWebhookSecret?: string;
} = {}) => {
  const db = await openDatabase(':memory:');
  await runMigrations(db);
  await seedCatalogue(db);

  const sentEmails: SentResetEmail[] = [];
  const sentSignInLinks: SentSignInLink[] = [];
  const sentPaymentConfirmations: Array<{
    email: string;
    topic: string;
    batch: string | null;
  }> = [];
  const mailer: Mailer | null = withMailer
    ? {
        sendPasswordReset: async (email, resetUrl) => {
          sentEmails.push({ email, resetUrl });
        },
        sendAdminSignInLink: async (email, signInUrl) => {
          sentSignInLinks.push({ email, signInUrl });
        },
        sendPaymentConfirmation: async (email, confirmation) => {
          sentPaymentConfirmations.push({ email, ...confirmation });
        },
      }
    : null;

  const clock = { now };
  const config = loadConfig({
    NODE_ENV: 'test',
    WEB_ORIGIN: TEST_WEB_ORIGIN,
    ENABLE_RATE_LIMIT: enableRateLimiting ? 'true' : 'false',
    SUPER_ADMIN_EMAILS: superAdminEmails.join(','),
    ...(razorpayWebhookSecret
      ? { RAZORPAY_WEBHOOK_SECRET: razorpayWebhookSecret }
      : {}),
  });
  await syncSuperAdmins(db, config.superAdminEmails, clock.now());
  const app = createApp({
    db,
    config,
    mailer,
    now: () => clock.now(),
    paymentGateway,
  });
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const createClient = (): TestClient => {
    let cookie: string | null = null;

    return {
      request: async (method, path, body, headers = {}) => {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });

        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
          const [pair] = setCookie.split(';');
          cookie = pair.endsWith('=') ? null : pair;
        }

        const text = await response.text();
        return {
          status: response.status,
          body: text ? JSON.parse(text) : null,
          setCookie,
        };
      },
      clearCookies: () => {
        cookie = null;
      },
    };
  };

  return {
    db,
    clock,
    sentEmails,
    sentSignInLinks,
    sentPaymentConfirmations,
    port,
    baseUrl,
    createClient,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(async err => {
          if (err) {
            reject(err);
            return;
          }
          await db.close();
          resolve();
        });
      }),
  };
};

export const validRegistration = (overrides: Record<string, unknown> = {}) => ({
  fullName: 'Asha Verma',
  email: 'asha@example.com',
  password: 'correct-horse-1',
  dateOfBirth: '2009-04-12',
  mobile: '+91 98765 43210',
  standard: 'CLASS_11',
  stream: 'COMMERCE',
  address: 'Jaipur',
  ...overrides,
});
