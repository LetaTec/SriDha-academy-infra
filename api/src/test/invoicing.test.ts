import assert from 'node:assert/strict';
import { it } from 'node:test';

import { getInvoicingActivation } from '../modules/finance/invoices/invoicing.activation.js';
import {
  recordTestApproval,
  TEST_APPROVAL_EFFECTIVE_FROM,
} from './invoicing.js';
import { startTestServer } from './testServer.js';

// Regression: the fixture approval used to take effect "a minute before
// the call", so on a slow machine (more than 30 seconds into the file) it
// started after the fixed test clocks and ledger.test.ts issued no invoice.
it('gives fixture approvals a fixed start that does not drift with the real clock', async () => {
  const testClock = new Date(
    new Date(TEST_APPROVAL_EFFECTIVE_FROM).getTime() + 30_000,
  );
  const server = await startTestServer({
    now: () => testClock,
    invoicingEnabled: true,
  });
  const realNow = Date.now;
  // As if the test file had already been running for 40 seconds
  Date.now = () => realNow() + 40_000;
  try {
    await recordTestApproval(server.db);
  } finally {
    Date.now = realNow;
  }

  const activation = await getInvoicingActivation(
    server.db,
    { invoicingEnabled: true },
    testClock,
  );
  await server.close();
  assert.equal(activation.active, true, JSON.stringify(activation));
});

// A file that runs past the database's 5-minute backdating guard (it
// compares with the real clock) must still be able to record an approval
it('keeps late fixture approvals inside the 5-minute backdating guard', async () => {
  const server = await startTestServer();
  const realNow = Date.now;
  const lateNow = realNow() + 5 * 60_000;
  Date.now = () => lateNow; // as if the file had run for 5 minutes
  try {
    await recordTestApproval(server.db);
  } finally {
    Date.now = realNow;
  }
  const row = await server.db.get<{ effective_from: string | Date }>(
    'SELECT effective_from FROM tax_configuration_approvals ORDER BY recorded_at DESC LIMIT 1',
  );
  await server.close();
  const effectiveFrom = new Date(String(row?.effective_from)).getTime();
  assert.ok(
    effectiveFrom >= lateNow - 5 * 60_000,
    'an approval starting more than 5 minutes back would be refused',
  );
});
