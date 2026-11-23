import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toPoolConnection } from './connection.js';

describe('database connection settings', () => {
  it('verifies the server certificate, optionally against a given CA', () => {
    assert.deepEqual(
      toPoolConnection('postgres://app:pw@db.example.com:5432/sridha', {
        mode: 'verify',
        ca: null,
      }).ssl,
      { rejectUnauthorized: true },
    );
    assert.deepEqual(
      toPoolConnection('postgres://app:pw@db.example.com:5432/sridha', {
        mode: 'verify',
        ca: 'PEM',
      }).ssl,
      { rejectUnauthorized: true, ca: 'PEM' },
    );
  });

  it('ignores TLS settings in the URL, which would otherwise override verification', () => {
    const connection = toPoolConnection(
      'postgres://app:p%40ss@db.example.com:5432/sridha?sslmode=no-verify&sslrootcert=/tmp/x&application_name=api',
      { mode: 'verify', ca: null },
    );
    assert.deepEqual(connection.ssl, { rejectUnauthorized: true });
    assert.deepEqual(connection.ignoredUrlParameters, [
      'sslmode',
      'sslrootcert',
    ]);
    assert.equal(
      connection.connectionString,
      'postgres://app:p%40ss@db.example.com:5432/sridha?application_name=api',
    );
  });

  it('uses no TLS only when told to', () => {
    assert.equal(
      toPoolConnection('postgres://localhost/dev', {
        mode: 'disable',
        ca: null,
      }).ssl,
      false,
    );
  });
});
