import type { AddressInfo } from 'node:net';

import { createApp } from '../app/app.js';
import { loadConfig } from '../config/env.js';
import { seedCatalogue } from '../db/catalogueSeed.js';
import { openDatabase, runMigrations } from '../db/client.js';
import type { Mailer } from '../mail/mailer.js';
import { configureLogger } from '../logging/logger.js';
import { syncStaffRoles, type StaffEmails } from '../modules/auth/roles.js';
import type { PaymentGateway } from '../modules/payments/gateway.js';

export const TEST_WEB_ORIGIN = 'http://localhost:5173';

export type SentResetEmail = { email: string; code: string };
export type SentSignInLink = { email: string; signInUrl: string };

export const TEST_SUPER_ADMIN_EMAIL = 'admin@sridha.test';

export type TestClient = {
  request: <T = any>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<{
    status: number;
    body: T;
    setCookie: string | null;
    headers: Record<string, string>;
  }>;
  clearCookies: () => void;
};

export const startTestServer = async ({
  withMailer = true,
  enableRateLimiting = false,
  now = () => new Date('2026-10-10T09:00:00Z'),
  superAdminEmails = [TEST_SUPER_ADMIN_EMAIL],
  financeAdminEmails = [],
  operationsAdminEmails = [],
  financeNotificationEmails = [],
  paymentGateway,
  razorpayWebhookSecret,
  invoicingEnabled = false,
  mailer: mailerOverride,
}: {
  withMailer?: boolean;
  enableRateLimiting?: boolean;
  now?: () => Date;
  superAdminEmails?: string[];
  financeAdminEmails?: string[];
  operationsAdminEmails?: string[];
  financeNotificationEmails?: string[];
  paymentGateway?: PaymentGateway;
  razorpayWebhookSecret?: string;
  invoicingEnabled?: boolean;
  // Replaces the recording mailer, e.g. with one that fails or never answers
  mailer?: Mailer;
} = {}) => {
  const db = await openDatabase(':memory:');
  await runMigrations(db);
  await seedCatalogue(db);

  const sentEmails: SentResetEmail[] = [];
  const sentSignUpCodes: SentResetEmail[] = [];
  const sentAccountNotices: SentSignInLink[] = [];
  const sentSignInLinks: SentSignInLink[] = [];
  const sentPaymentConfirmations: Array<{
    email: string;
    topic: string;
    batch: string | null;
  }> = [];
  const mailer: Mailer | null = mailerOverride
    ? mailerOverride
    : withMailer
      ? {
          sendPasswordResetCode: async (email, code) => {
            sentEmails.push({ email, code });
          },
          sendSignUpCode: async (email, code) => {
            sentSignUpCodes.push({ email, code });
          },
          sendAccountExistsNotice: async (email, signInUrl) => {
            sentAccountNotices.push({ email, signInUrl });
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
    FINANCE_ADMIN_EMAILS: financeAdminEmails.join(','),
    OPERATIONS_ADMIN_EMAILS: operationsAdminEmails.join(','),
    FINANCE_NOTIFICATION_EMAILS: financeNotificationEmails.join(','),
    INVOICING_ENABLED: invoicingEnabled ? 'true' : 'false',
    ...(razorpayWebhookSecret
      ? { RAZORPAY_WEBHOOK_SECRET: razorpayWebhookSecret }
      : {}),
  });
  configureLogger({ level: config.logLevel, pretty: true });
  await syncStaffRoles(db, config, clock.now());
  const app = createApp({
    db,
    config,
    mailer,
    now: () => clock.now(),
    paymentGateway,
  });
  // Listen on exactly the address the client dials. Without a host the
  // server listens on "::", and on macOS another program's listener on
  // 127.0.0.1 with the same port number takes precedence for 127.0.0.1
  // connections, so requests could silently reach the wrong server. Bound
  // here, such a clash is a bind error instead.
  const server = app.listen(0, '127.0.0.1');
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
            Connection: 'close',
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
        let parsedBody: any = null;
        if (text) {
          try {
            parsedBody = JSON.parse(text);
          } catch {
            parsedBody = text;
          }
        }
        return {
          status: response.status,
          body: parsedBody,
          setCookie,
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
      clearCookies: () => {
        cookie = null;
      },
    };
  };

  // Signs a staff member in the way they do it: an emailed one-time link
  const signInStaff = async (email: string) => {
    const client = createClient();
    const requested = await client.request('POST', '/api/auth/admin-sign-in', {
      email,
    });
    const link = sentSignInLinks.filter(sent => sent.email === email).at(-1);
    const token = link
      ? new URL(link.signInUrl).searchParams.get('token')
      : null;
    const confirmed = await client.request(
      'POST',
      '/api/auth/admin-sign-in/confirm',
      { token },
    );
    if (confirmed.status !== 200) {
      throw new Error(
        `Staff sign-in failed for ${email}: request ${requested.status}, ` +
          `link ${link ? 'sent' : 'missing'}, confirm ${confirmed.status} ` +
          JSON.stringify(confirmed.body),
      );
    }
    return client;
  };

  // Signs a student up the way the website does: the sign-up request, then
  // the code it emailed. Signs in the given client (or a new one) and
  // returns it with the confirm response.
  const signUpStudent = async (
    student: { fullName: string; email: string; password: string },
    client: TestClient = createClient(),
  ) => {
    const requested = await client.request(
      'POST',
      '/api/auth/sign-up',
      student,
    );
    const email = student.email.trim().toLowerCase();
    const sent = sentSignUpCodes.filter(entry => entry.email === email).at(-1);
    const confirmed = await client.request(
      'POST',
      '/api/auth/sign-up/confirm',
      {
        email,
        code: sent?.code ?? '000000',
        password: student.password,
      },
    );
    if (confirmed.status !== 201) {
      throw new Error(
        `Student sign-up failed for ${email}: request ${requested.status}, ` +
          `code ${sent ? 'sent' : 'missing'}, confirm ${confirmed.status} ` +
          JSON.stringify(confirmed.body),
      );
    }
    return { client, response: confirmed };
  };

  // Runs the start-up role sync again with changed lists (unchanged lists
  // keep their configured emails)
  const syncStaff = (changes: Partial<StaffEmails>) =>
    syncStaffRoles(db, { ...config, ...changes }, clock.now());

  return {
    db,
    config,
    clock,
    sentEmails,
    sentSignUpCodes,
    sentAccountNotices,
    sentSignInLinks,
    sentPaymentConfirmations,
    port,
    baseUrl,
    createClient,
    signInStaff,
    signUpStudent,
    syncStaff,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections?.();
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

// A student's sign-up details (sign-up is the only way to create a student
// account; it proves the email with a code, see signUpStudent)
export const testStudent = (
  overrides: Partial<{
    fullName: string;
    email: string;
    password: string;
  }> = {},
) => ({
  fullName: 'Asha Verma',
  email: 'asha@example.com',
  password: 'correct-horse-1',
  ...overrides,
});
