import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadConfig } from './env.js';

const PRODUCTION = {
  NODE_ENV: 'production',
  WEB_ORIGIN: 'https://sridhaacademy.com',
  DATABASE_URL: 'postgres://localhost/test',
  RAZORPAY_KEY_ID: 'rzp_live_example',
  RAZORPAY_KEY_SECRET: 'secret',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
};

const without = (key: keyof typeof PRODUCTION) => {
  const env: Record<string, string> = { ...PRODUCTION };
  delete env[key];
  return env;
};

describe('config', () => {
  it('starts with a complete production configuration', () => {
    const config = loadConfig(PRODUCTION);

    assert.equal(config.env, 'production');
    assert.deepEqual(config.razorpay, {
      keyId: 'rzp_live_example',
      keySecret: 'secret',
    });
  });

  it('refuses production without Razorpay keys or the webhook secret', () => {
    assert.throws(
      () => loadConfig(without('RAZORPAY_KEY_ID')),
      /RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET/,
    );
    assert.throws(
      () => loadConfig(without('RAZORPAY_WEBHOOK_SECRET')),
      /RAZORPAY_WEBHOOK_SECRET is required/,
    );
  });

  it('still runs development without Razorpay, in test mode', () => {
    assert.equal(loadConfig({ NODE_ENV: 'development' }).razorpay, null);
  });

  it('rejects allowed origins that are not plain http(s) origins', () => {
    assert.throws(
      () =>
        loadConfig({
          ...PRODUCTION,
          ALLOWED_ORIGINS: 'https://www.sridhaacademy.com, sridhaacademy.com',
        }),
      /ALLOWED_ORIGINS has entries that are not http\(s\) origins: sridhaacademy\.com/,
    );
    assert.throws(
      () =>
        loadConfig({
          ...PRODUCTION,
          ALLOWED_ORIGINS: 'https://www.sridhaacademy.com/login',
        }),
      /not http\(s\) origins/,
    );
  });

  it('rejects super admin entries that are not email addresses', () => {
    assert.throws(
      () =>
        loadConfig({
          ...PRODUCTION,
          SUPER_ADMIN_EMAILS: 'team@sridhaacademy.com, not-an-email',
        }),
      /SUPER_ADMIN_EMAILS has entries that are not email addresses: not-an-email/,
    );
  });

  it('normalises super admin emails', () => {
    const config = loadConfig({
      ...PRODUCTION,
      SUPER_ADMIN_EMAILS: ' Team@SriDhaAcademy.com ,, ',
    });

    assert.deepEqual(config.superAdminEmails, ['team@sridhaacademy.com']);
  });
});
