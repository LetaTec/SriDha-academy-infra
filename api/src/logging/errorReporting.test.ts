import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { initErrorReporting } from './errorReporting.js';
import { logger, runWithRequestId, setErrorSink } from './logger.js';

describe('error reporting', () => {
  afterEach(() => setErrorSink(null));

  it('stays off without a DSN', async () => {
    assert.equal(
      await initErrorReporting({ dsn: null, environment: 'test' }),
      null,
    );
  });

  it('hands every logged error to the reporter with its request id', () => {
    const reported: Array<{ event: string; fields: Record<string, unknown> }> =
      [];
    setErrorSink((event, fields) => reported.push({ event, fields }));

    const error = new Error('Razorpay is down');
    runWithRequestId('request-12345678', () => {
      logger.error('payments.provider_order_failed', { error, status: 502 });
      logger.warn('mail.not_configured');
    });

    assert.deepEqual(reported, [
      {
        event: 'payments.provider_order_failed',
        fields: { requestId: 'request-12345678', error, status: 502 },
      },
    ]);
  });
});
