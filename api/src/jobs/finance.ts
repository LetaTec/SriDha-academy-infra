import type { AppContext } from '../app/context.js';
import { logger } from '../logging/logger.js';
import type { PaymentGateway } from '../modules/payments/gateway.js';
import { expireStalePayments } from '../modules/payments/payments.expiry.js';
import { reconcilePendingRefunds } from '../modules/payments/payments.refunds.reconciliation.js';
import { reconcileMissingInvoices } from '../modules/finance/invoices/invoices.service.js';

const HOUR_MS = 60 * 60 * 1000;
// The first run waits a few minutes, so it never slows a cold start
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;

// Periodic finance maintenance jobs in the API process: payment expiry,
// refund reconciliation polling and invoice issuance (which does nothing
// until invoicing is activated). Safe to run on more than one instance:
// every change goes through locked row updates. Returns a function that stops
// them, for shutdown.
export const startFinanceJobs = (
  context: Pick<AppContext, 'db' | 'now' | 'config'>,
  gateway: PaymentGateway,
) => {
  const run = () => {
    expireStalePayments(context, gateway).catch(error => {
      logger.error('jobs.payment_expiry_failed', { error });
    });
    reconcilePendingRefunds(context, gateway).catch(error => {
      logger.error('jobs.refund_reconciliation_failed', { error });
    });
    reconcileMissingInvoices(context).catch(error => {
      logger.error('jobs.invoice_reconciliation_failed', { error });
    });
  };

  const firstRun = setTimeout(run, FIRST_RUN_DELAY_MS);
  const hourly = setInterval(run, HOUR_MS);
  firstRun.unref();
  hourly.unref();

  return () => {
    clearTimeout(firstRun);
    clearInterval(hourly);
  };
};
