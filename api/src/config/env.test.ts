import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadConfig } from './env.js';

const PRODUCTION = {
  NODE_ENV: 'production',
  WEB_ORIGIN: 'https://sridhaacademy.com',
  DATABASE_URL: 'postgres://sridha_app@localhost/test',
  MIGRATION_DATABASE_URL: 'postgres://owner@localhost/test',
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

  it('verifies the database TLS certificate in production by default', () => {
    const config = loadConfig(PRODUCTION);
    assert.deepEqual(config.databaseTls, { mode: 'verify', ca: null });
  });

  it('refuses to run production without database TLS', () => {
    assert.throws(
      () => loadConfig({ ...PRODUCTION, DATABASE_SSL: 'disable' }),
      /DATABASE_SSL=disable is not allowed in production/,
    );
  });

  it('keeps local development on a plain local connection', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://localhost/dev' });
    assert.deepEqual(config.databaseTls, { mode: 'disable', ca: null });
    assert.equal(config.migrationDatabaseUrl, null);
  });

  it('reads a CA certificate given with escaped newlines', () => {
    const config = loadConfig({
      ...PRODUCTION,
      DATABASE_SSL_CA:
        '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----',
    });
    assert.equal(
      config.databaseTls.ca,
      '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----',
    );
  });

  it('takes a separate migration connection, which must differ from the application one', () => {
    const config = loadConfig({
      ...PRODUCTION,
      MIGRATION_DATABASE_URL: 'postgres://owner@localhost/test',
    });
    assert.equal(
      config.migrationDatabaseUrl,
      'postgres://owner@localhost/test',
    );
    assert.throws(
      () =>
        loadConfig({
          ...PRODUCTION,
          MIGRATION_DATABASE_URL: PRODUCTION.DATABASE_URL,
        }),
      /MIGRATION_DATABASE_URL must use a different role/,
    );
    // The same role behind two different URLs
    assert.throws(
      () =>
        loadConfig({
          ...PRODUCTION,
          DATABASE_URL: 'postgres://owner@localhost/test?application_name=api',
        }),
      /MIGRATION_DATABASE_URL must use a different role/,
    );
    assert.throws(
      () =>
        loadConfig({
          MIGRATION_DATABASE_URL: 'postgres://owner@localhost/test',
        }),
      /MIGRATION_DATABASE_URL needs DATABASE_URL/,
    );
  });

  it('refuses production without a separate migration role', () => {
    assert.throws(
      () => loadConfig(without('MIGRATION_DATABASE_URL')),
      /MIGRATION_DATABASE_URL is required in production/,
    );
  });

  it('refuses a Resend key without MAIL_TRANSPORT instead of starting with email off', () => {
    for (const env of [
      { ...PRODUCTION, RESEND_API_KEY: 're_test_key' },
      { NODE_ENV: 'development', RESEND_API_KEY: 're_test_key' },
    ]) {
      assert.throws(
        () => loadConfig(env),
        /RESEND_API_KEY is set but MAIL_TRANSPORT is not/,
      );
    }
  });

  it('selects Resend only when MAIL_TRANSPORT says so, with the default sender', () => {
    const config = loadConfig({
      ...PRODUCTION,
      MAIL_TRANSPORT: 'resend',
      RESEND_API_KEY: 're_test_key',
    });
    assert.equal(config.mailTransport, 'resend');
    assert.equal(
      config.emailFrom,
      'SriDha Academy <noreply@sridhaacademy.com>',
    );
    assert.throws(
      () => loadConfig({ ...PRODUCTION, MAIL_TRANSPORT: 'resend' }),
      /RESEND_API_KEY is required when MAIL_TRANSPORT=resend/,
    );
  });

  it('writes console emails to a file only in development, never with Resend or in production', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      MAIL_TRANSPORT: 'console',
      MAIL_CONSOLE_FILE: '/tmp/mail.log',
    });
    assert.equal(config.mailConsoleFile, '/tmp/mail.log');
    for (const env of [
      { NODE_ENV: 'development', MAIL_CONSOLE_FILE: '/tmp/mail.log' },
      {
        ...PRODUCTION,
        MAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: 're_test_key',
        MAIL_CONSOLE_FILE: '/tmp/mail.log',
      },
    ]) {
      assert.throws(
        () => loadConfig(env),
        /MAIL_CONSOLE_FILE only works with MAIL_TRANSPORT=console/,
      );
    }
  });
});
