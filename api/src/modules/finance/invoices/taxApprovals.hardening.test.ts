import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { startTestServer } from '../../../test/testServer.js';
import { CURRENT_TAX_CONFIGURATION } from './invoicing.activation.js';
import {
  findLatestApprovalForConfiguration,
  listTaxConfigurationApprovals,
} from './invoices.repository.js';

type TestServer = Awaited<ReturnType<typeof startTestServer>>;

describe('Phase 2.0: Tax Approval Timestamp Hardening', () => {
  let server: TestServer;

  before(async () => {
    server = await startTestServer({ invoicingEnabled: true });
  });

  after(async () => {
    await server.close();
  });

  it('allows normal approval with current effective date', async () => {
    const id = randomUUID();
    const effectiveFrom = new Date().toISOString();

    await server.db.query(
      `INSERT INTO tax_configuration_approvals (
         id, status, supplier_gstin, sac_code, gst_rate_basis_points,
         pricing_mode, calculation_version, rounding_policy, effective_from,
         approved_by, approval_reference, recorded_by, recorded_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        'APPROVED',
        CURRENT_TAX_CONFIGURATION.supplierGstin,
        CURRENT_TAX_CONFIGURATION.sacCode,
        CURRENT_TAX_CONFIGURATION.gstRateBasisPoints,
        CURRENT_TAX_CONFIGURATION.pricingMode,
        CURRENT_TAX_CONFIGURATION.calculationVersion,
        CURRENT_TAX_CONFIGURATION.roundingPolicy,
        effectiveFrom,
        'Chartered Accountant Firm A',
        'REF-NORMAL-001',
        'admin-user-1',
        effectiveFrom,
      ],
    );

    const latest = await findLatestApprovalForConfiguration(
      server.db,
      CURRENT_TAX_CONFIGURATION,
    );
    assert.ok(latest);
    assert.equal(latest.id, id);
    assert.equal(latest.status, 'APPROVED');
    // recorded_at is guaranteed to be within seconds of now
    const recordedAt = new Date(latest.recordedAt).getTime();
    assert.ok(Math.abs(Date.now() - recordedAt) < 10_000);
  });

  it('allows approval effective within 5-minute clock-skew tolerance (e.g. 2 minutes ago)', async () => {
    const id = randomUUID();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    await server.db.query(
      `INSERT INTO tax_configuration_approvals (
         id, status, supplier_gstin, sac_code, gst_rate_basis_points,
         pricing_mode, calculation_version, rounding_policy, effective_from,
         approved_by, approval_reference, recorded_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        'APPROVED',
        CURRENT_TAX_CONFIGURATION.supplierGstin,
        CURRENT_TAX_CONFIGURATION.sacCode,
        CURRENT_TAX_CONFIGURATION.gstRateBasisPoints,
        CURRENT_TAX_CONFIGURATION.pricingMode,
        CURRENT_TAX_CONFIGURATION.calculationVersion,
        CURRENT_TAX_CONFIGURATION.roundingPolicy,
        twoMinutesAgo,
        'Chartered Accountant Firm A',
        'REF-SKEW-002',
        'admin-user-1',
      ],
    );

    const approvals = await listTaxConfigurationApprovals(server.db);
    const found = approvals.find(a => a.id === id);
    assert.ok(found);
    assert.equal(found.status, 'APPROVED');
  });

  it('rejects approval effective > 5 minutes in the past (e.g. 10 minutes ago)', async () => {
    const id = randomUUID();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    await assert.rejects(
      server.db.query(
        `INSERT INTO tax_configuration_approvals (
           id, status, supplier_gstin, sac_code, gst_rate_basis_points,
           pricing_mode, calculation_version, rounding_policy, effective_from,
           approved_by, approval_reference, recorded_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          'APPROVED',
          CURRENT_TAX_CONFIGURATION.supplierGstin,
          CURRENT_TAX_CONFIGURATION.sacCode,
          CURRENT_TAX_CONFIGURATION.gstRateBasisPoints,
          CURRENT_TAX_CONFIGURATION.pricingMode,
          CURRENT_TAX_CONFIGURATION.calculationVersion,
          CURRENT_TAX_CONFIGURATION.roundingPolicy,
          tenMinutesAgo,
          'Chartered Accountant Firm A',
          'REF-BACKDATED-003',
          'admin-user-1',
        ],
      ),
      /cannot take effect before it is recorded/,
    );
  });

  it('overwrites caller-supplied recorded_at with clock_timestamp() and blocks backdating attack', async () => {
    const id = randomUUID();
    // Attacker tries to bypass backdating by fabricating both effective_from and recorded_at in the past
    const historicalTime = '2026-07-15T10:00:00.000Z';

    await assert.rejects(
      server.db.query(
        `INSERT INTO tax_configuration_approvals (
           id, status, supplier_gstin, sac_code, gst_rate_basis_points,
           pricing_mode, calculation_version, rounding_policy, effective_from,
           approved_by, approval_reference, recorded_by, recorded_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          id,
          'APPROVED',
          CURRENT_TAX_CONFIGURATION.supplierGstin,
          CURRENT_TAX_CONFIGURATION.sacCode,
          CURRENT_TAX_CONFIGURATION.gstRateBasisPoints,
          CURRENT_TAX_CONFIGURATION.pricingMode,
          CURRENT_TAX_CONFIGURATION.calculationVersion,
          CURRENT_TAX_CONFIGURATION.roundingPolicy,
          historicalTime,
          'Malicious Actor',
          'REF-FORGED-004',
          'attacker-user',
          historicalTime, // Forged recorded_at
        ],
      ),
      /cannot take effect before it is recorded/,
    );
  });

  it('blocks direct SQL UPDATE on tax_configuration_approvals (append-only)', async () => {
    await assert.rejects(
      server.db.query(
        `UPDATE tax_configuration_approvals SET status = 'REVOKED'`,
      ),
      /immutable/,
    );
  });

  it('blocks direct SQL DELETE on tax_configuration_approvals (append-only)', async () => {
    await assert.rejects(
      server.db.query(`DELETE FROM tax_configuration_approvals`),
      /immutable/,
    );
  });

  it('records revocation workflow immediately without effective_from requirement', async () => {
    const id = randomUUID();
    const effectiveFrom = new Date().toISOString();

    await server.db.query(
      `INSERT INTO tax_configuration_approvals (
         id, status, supplier_gstin, sac_code, gst_rate_basis_points,
         pricing_mode, calculation_version, rounding_policy, effective_from,
         approved_by, approval_reference, recorded_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        'REVOKED',
        CURRENT_TAX_CONFIGURATION.supplierGstin,
        CURRENT_TAX_CONFIGURATION.sacCode,
        CURRENT_TAX_CONFIGURATION.gstRateBasisPoints,
        CURRENT_TAX_CONFIGURATION.pricingMode,
        CURRENT_TAX_CONFIGURATION.calculationVersion,
        CURRENT_TAX_CONFIGURATION.roundingPolicy,
        effectiveFrom,
        'Chartered Accountant Firm A',
        'REF-REVOCATION-005',
        'admin-user-1',
      ],
    );

    const latest = await findLatestApprovalForConfiguration(
      server.db,
      CURRENT_TAX_CONFIGURATION,
    );
    assert.ok(latest);
    assert.equal(latest.id, id);
    assert.equal(latest.status, 'REVOKED');
  });
});
