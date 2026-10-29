import { MAIL_TRANSPORT, type AppConfig } from '../config/env.js';

// What a paid student is told: the topic, their batch (none for a
// pre-registration), the amount and where to see it
export type PaymentConfirmation = {
  fullName: string;
  topic: string;
  batch: string | null;
  amount: string;
  paymentReference: string;
  learningUrl: string;
};

export type Mailer = {
  sendPasswordReset: (email: string, resetUrl: string) => Promise<void>;
  sendAdminSignInLink: (email: string, signInUrl: string) => Promise<void>;
  sendPaymentConfirmation: (
    email: string,
    confirmation: PaymentConfirmation,
  ) => Promise<void>;
};

const describePayment = ({ topic, batch, amount }: PaymentConfirmation) =>
  batch
    ? `We have received your payment of ${amount} for ${topic}. Your seat in the ${batch} is confirmed.`
    : `We have received your payment of ${amount} to pre-register for ${topic}. We will email you as soon as its first batch opens.`;

const consoleMailer: Mailer = {
  sendPasswordReset: async (email, resetUrl) => {
    console.info('[mail] password reset for %s - %s', email, resetUrl);
  },
  sendAdminSignInLink: async (email, signInUrl) => {
    console.info('[mail] admin sign-in link for %s - %s', email, signInUrl);
  },
  sendPaymentConfirmation: async (email, confirmation) => {
    console.info(
      '[mail] payment confirmation for %s - %s (%s)',
      email,
      describePayment(confirmation),
      confirmation.paymentReference,
    );
  },
};

type EmailContent = {
  subject: string;
  intro: string;
  action: string;
  url: string;
  note: string;
};

const renderEmail = ({ intro, action, url, note }: EmailContent) => `
  <div style="font-family: sans-serif; line-height: 1.5; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111;">SriDha Academy</h2>
    <p>Hello,</p>
    <p>${intro}</p>
    <p style="margin: 24px 0;">
      <a href="${url}" style="background-color: #0b57d0; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">${action}</a>
    </p>
    <p style="font-size: 14px; color: #666;">${note}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
    <p style="font-size: 12px; color: #999;">SriDha Academy</p>
  </div>
`;

const createResendMailer = (apiKey: string, fromAddress: string): Mailer => {
  const send = async (email: string, content: EmailContent) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: content.subject,
        html: renderEmail(content),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        '[mail] Resend delivery failed status %d: %s',
        response.status,
        errorText,
      );
      throw new Error(
        `Failed to send "${content.subject}" via Resend (status ${response.status})`,
      );
    }
  };

  return {
    sendPasswordReset: (email, resetUrl) =>
      send(email, {
        subject: 'Reset your SriDha Academy password',
        intro:
          'We received a request to reset the password for your SriDha Academy account.',
        action: 'Reset Password',
        url: resetUrl,
        note: 'This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.',
      }),
    sendAdminSignInLink: (email, signInUrl) =>
      send(email, {
        subject: 'Your SriDha Academy sign-in link',
        intro:
          'Use the button below to sign in to your SriDha Academy team account.',
        action: 'Sign in',
        url: signInUrl,
        note: 'This link works once and expires in 15 minutes. If you did not ask to sign in, you can safely ignore this email.',
      }),
    sendPaymentConfirmation: (email, confirmation) =>
      send(email, {
        subject: `Payment received: ${confirmation.topic}`,
        intro: describePayment(confirmation),
        action: 'Go to My learning',
        url: confirmation.learningUrl,
        note: `Payment reference: ${confirmation.paymentReference}. Keep it for any questions about this payment. Razorpay also emails a receipt.`,
      }),
  };
};

// Returns null when no transport is configured so callers can report that
// password recovery is unavailable instead of silently dropping the email.
export const createMailer = (config: AppConfig): Mailer | null => {
  if (config.mailTransport === MAIL_TRANSPORT.console) {
    return consoleMailer;
  }

  if (config.mailTransport === MAIL_TRANSPORT.resend && config.resendApiKey) {
    return createResendMailer(config.resendApiKey, config.emailFrom);
  }

  return null;
};
