import { appendFileSync } from 'node:fs';

import { MAIL_TRANSPORT, type AppConfig } from '../config/env.js';
import { logger } from '../logging/logger.js';

// What a paid student is told: the topic, their batch (none for a
// pre-registration), the amount and where to see it
export type PaymentConfirmation = {
  fullName: string;
  topic: string;
  batch: string | null;
  amount: string;
  paymentReference: string;
  topicsUrl: string;
};

// What finance staff are told about a payment: who paid how much for what,
// and the reference to look it up. Nothing addressed to the student.
export type PaymentFinanceCopy = {
  fullName: string;
  topic: string;
  batch: string | null;
  amount: string;
  paymentReference: string;
};

export type Mailer = {
  sendPasswordResetCode: (email: string, code: string) => Promise<void>;
  // The code that proves a new sign-up owns the address
  sendSignUpCode: (email: string, code: string) => Promise<void>;
  // Sent instead of a code when the address already has an account, so the
  // sign-up answer is the same either way
  sendAccountExistsNotice: (email: string, signInUrl: string) => Promise<void>;
  sendAdminSignInLink: (email: string, signInUrl: string) => Promise<void>;
  // idempotencyKey: the same key always means the same email, so the
  // provider delivers it once even if it is sent again (Resend keeps keys
  // for 24 hours)
  sendPaymentConfirmation: (
    email: string,
    confirmation: PaymentConfirmation,
    options?: { idempotencyKey?: string },
  ) => Promise<void>;
  // The finance team's copy of a payment, never sent to the student
  sendPaymentFinanceCopy: (
    email: string,
    copy: PaymentFinanceCopy,
    options?: { idempotencyKey?: string },
  ) => Promise<void>;
};

const describeFinanceCopy = ({
  fullName,
  topic,
  batch,
  amount,
}: PaymentFinanceCopy) =>
  `${fullName} paid ${amount} for ${topic}${batch ? ` (${batch})` : ' (pre-registration)'}.`;

const describePayment = ({ topic, batch, amount }: PaymentConfirmation) =>
  batch
    ? `We have received your payment of ${amount} for ${topic}. Your seat in the ${batch} is confirmed.`
    : `We have received your payment of ${amount} to pre-register for ${topic}. We will email you as soon as its first batch opens.`;

// Development and browser tests only: production refuses the console
// transport. With MAIL_CONSOLE_FILE set, each email is also appended to that
// file as one JSON line, so a browser test can read the code it was sent.
const createConsoleMailer = (file: string | null): Mailer => {
  const record = (entry: Record<string, string>) => {
    if (file) appendFileSync(file, `${JSON.stringify(entry)}\n`);
  };
  return {
    sendPasswordResetCode: async (email, code) => {
      logger.info('mail.console_password_reset_code', { email, code });
      record({ template: 'password_reset_code', email, code });
    },
    sendSignUpCode: async (email, code) => {
      logger.info('mail.console_sign_up_code', { email, code });
      record({ template: 'sign_up_code', email, code });
    },
    sendAccountExistsNotice: async (email, signInUrl) => {
      logger.info('mail.console_account_exists', { email, signInUrl });
      record({ template: 'account_exists', email });
    },
    sendAdminSignInLink: async (email, signInUrl) => {
      logger.info('mail.console_admin_sign_in', { email, signInUrl });
    },
    sendPaymentConfirmation: async (email, confirmation) => {
      logger.info('mail.console_payment_confirmation', {
        email,
        payment: describePayment(confirmation),
        reference: confirmation.paymentReference,
      });
    },
    sendPaymentFinanceCopy: async (email, copy) => {
      logger.info('mail.console_payment_finance_copy', {
        email,
        payment: describeFinanceCopy(copy),
        reference: copy.paymentReference,
      });
    },
  };
};

// An email leads to a button, or shows a one-time code
type EmailContent = {
  subject: string;
  intro: string;
  note: string;
} & ({ action: string; url: string } | { code: string } | { notice: true });

// Every value is escaped before it goes into the HTML: names come from the
// buyer's checkout form, and a name such as '<a href="…">Approve refund</a>'
// must arrive as text, not as a working link from SriDha's own sender
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderCall = (content: EmailContent) =>
  'notice' in content
    ? ''
    : 'code' in content
      ? `<p style="margin: 24px 0; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111;">${escapeHtml(content.code)}</p>`
      : `<p style="margin: 24px 0;">
      <a href="${escapeHtml(content.url)}" style="background-color: #0b57d0; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">${escapeHtml(content.action)}</a>
    </p>`;

const renderEmail = (content: EmailContent) => {
  const { intro, note } = content;
  return `
  <div style="font-family: sans-serif; line-height: 1.5; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111;">SriDha Academy</h2>
    <p>Hello,</p>
    <p>${escapeHtml(intro)}</p>
    ${renderCall(content)}
    <p style="font-size: 14px; color: #666;">${escapeHtml(note)}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
    <p style="font-size: 12px; color: #999;">SriDha Academy</p>
  </div>
`;
};

const MAIL_TEMPLATE = {
  passwordResetCode: 'password_reset_code',
  signUpCode: 'sign_up_code',
  accountExists: 'account_exists',
  adminSignInLink: 'admin_sign_in_link',
  paymentConfirmation: 'payment_confirmation',
  paymentFinanceCopy: 'payment_finance_copy',
} as const;

type MailTemplate = (typeof MAIL_TEMPLATE)[keyof typeof MAIL_TEMPLATE];

// Resend answers a refusal with JSON whose `name` is a short error type
// such as "validation_error". Only that is kept: its `message` can quote
// the recipient's address.
const readProviderErrorName = (text: string) => {
  try {
    const name: unknown = (JSON.parse(text) as { name?: unknown })?.name;
    return typeof name === 'string' && /^[a-z_]{1,64}$/.test(name)
      ? name
      : null;
  } catch {
    return null;
  }
};

const RESEND_TIMEOUT_MS = 10_000;

const createResendMailer = (apiKey: string, fromAddress: string): Mailer => {
  // A failure is described by the template, the HTTP status and Resend's
  // error type only. The subject can hold a reset code, and Resend's error
  // text can repeat the recipient's address; this error is logged and
  // reported to Sentry by whoever catches it.
  const send = async (
    template: MailTemplate,
    email: string,
    content: EmailContent,
    idempotencyKey?: string,
  ) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      // A provider that does not answer fails the send (the outbox retries
      // it with the same idempotency key) instead of holding it forever
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: content.subject,
        html: renderEmail(content),
      }),
    });

    if (!response.ok) {
      const providerError = readProviderErrorName(await response.text());
      logger.error('mail.delivery_failed', {
        provider: 'resend',
        template,
        status: response.status,
        providerError,
      });
      throw new Error(
        `Resend refused the ${template} email (status ${response.status}${providerError ? `, ${providerError}` : ''})`,
      );
    }
  };

  return {
    sendPasswordResetCode: (email, code) =>
      send(MAIL_TEMPLATE.passwordResetCode, email, {
        subject: `${code} is your SriDha Academy code`,
        intro:
          'Enter this code on SriDha Academy to choose a new password for your account.',
        code,
        note: 'The code works for 15 minutes. If you did not ask to reset your password, you can safely ignore this email.',
      }),
    sendSignUpCode: (email, code) =>
      send(MAIL_TEMPLATE.signUpCode, email, {
        subject: `${code} is your SriDha Academy code`,
        intro:
          'Enter this code on SriDha Academy to confirm your email and finish creating your account.',
        code,
        note: 'The code works for 15 minutes. If you did not ask to create an account, you can safely ignore this email; no account is created without the code.',
      }),
    sendAccountExistsNotice: (email, signInUrl) =>
      send(MAIL_TEMPLATE.accountExists, email, {
        subject: 'You already have a SriDha Academy account',
        intro:
          'Someone asked to create a SriDha Academy account with this email, but it already has one. Sign in instead; if you have forgotten your password, choose "Forgot password" on the sign-in screen.',
        action: 'Sign in',
        url: signInUrl,
        note: 'If this was not you, you can safely ignore this email. Nothing about your account has changed.',
      }),
    sendAdminSignInLink: (email, signInUrl) =>
      send(MAIL_TEMPLATE.adminSignInLink, email, {
        subject: 'Your SriDha Academy sign-in link',
        intro:
          'Use the button below to sign in to your SriDha Academy team account.',
        action: 'Sign in',
        url: signInUrl,
        note: 'This link works once and expires in 15 minutes. If you did not ask to sign in, you can safely ignore this email.',
      }),
    sendPaymentConfirmation: (email, confirmation, options) =>
      send(
        MAIL_TEMPLATE.paymentConfirmation,
        email,
        {
          subject: `Payment received: ${confirmation.topic}`,
          intro: describePayment(confirmation),
          action: 'See more topics',
          url: confirmation.topicsUrl,
          note: `Payment reference: ${confirmation.paymentReference}. Keep it for any questions about this payment. Razorpay also emails a receipt.`,
        },
        options?.idempotencyKey,
      ),
    sendPaymentFinanceCopy: (email, copy, options) =>
      send(
        MAIL_TEMPLATE.paymentFinanceCopy,
        email,
        {
          subject: `[Finance] Payment received: ${copy.topic} (${copy.amount})`,
          intro: `A payment was received. ${describeFinanceCopy(copy)}`,
          notice: true,
          note: `Payment reference: ${copy.paymentReference}. This copy is for the SriDha Academy finance team.`,
        },
        options?.idempotencyKey,
      ),
  };
};

// Returns null when no transport is configured so callers can report that
// password recovery is unavailable instead of silently dropping the email.
export const createMailer = (config: AppConfig): Mailer | null => {
  if (config.mailTransport === MAIL_TRANSPORT.console) {
    return createConsoleMailer(config.mailConsoleFile);
  }

  if (config.mailTransport === MAIL_TRANSPORT.resend && config.resendApiKey) {
    return createResendMailer(config.resendApiKey, config.emailFrom);
  }

  return null;
};
