import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import type { Mailer } from '../mail/mailer.js';
import type { PaymentGateway } from '../modules/payments/gateway.js';

export type AppContext = {
  db: Database;
  config: AppConfig;
  mailer: Mailer | null;
  now: () => Date;
  // Defaults to Razorpay when keys are configured, otherwise test mode
  paymentGateway?: PaymentGateway;
};
