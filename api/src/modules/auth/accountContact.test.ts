import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createFakeRazorpay } from '../../test/fakeRazorpay.js';
import { SIGN_UP_CONTACT, startTestServer } from '../../test/testServer.js';

const OPEN_BATCH = 'batch_accountancy_rectification_of_errors_class_11_b2';

describe('account contact details and the billing address', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer({ paymentGateway: createFakeRazorpay() });
  });

  after(async () => {
    await server.close();
  });

  it('keeps the mobile, state, city and PIN code from sign-up on the account', async () => {
    const client = server.createClient();
    const signUp = await client.request('POST', '/api/auth/sign-up', {
      fullName: 'Kavya Rao',
      email: 'kavya@example.com',
      password: 'correct-horse-1',
      ...SIGN_UP_CONTACT,
    });
    assert.equal(signUp.status, 201);
    assert.deepEqual(signUp.body.user.contact, SIGN_UP_CONTACT);

    const session = await client.request('GET', '/api/auth/session');
    assert.deepEqual(session.body.user.contact, SIGN_UP_CONTACT);
  });

  it('asks for every contact detail at sign-up', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/auth/sign-up', {
        fullName: 'Kavya Rao',
        email: 'kavya.two@example.com',
        password: 'correct-horse-1',
        mobile: SIGN_UP_CONTACT.mobile,
        city: SIGN_UP_CONTACT.city,
        pinCode: '12345',
      });
    assert.equal(response.status, 400);
    const fields = response.body.details.body.map(
      (issue: { path: string[] }) => issue.path[0],
    );
    assert.deepEqual(fields.sort(), ['pinCode', 'state']);
  });

  it('takes an individual payment without a billing address', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: OPEN_BATCH,
        customerType: 'INDIVIDUAL',
        fullName: 'Kavya Rao',
        email: 'kavya.buyer@example.com',
        ...SIGN_UP_CONTACT,
      });
    assert.equal(response.status, 201);

    const row = await server.db.get<{ address_line1: string | null }>(
      'SELECT address_line1 FROM payments WHERE id = $1',
      [response.body.checkout.paymentId],
    );
    assert.equal(row?.address_line1, null);
  });

  it('still needs a billing address for a business tax invoice', async () => {
    const response = await server
      .createClient()
      .request('POST', '/api/payments/checkout', {
        kind: 'ENROLMENT',
        batchId: OPEN_BATCH,
        customerType: 'BUSINESS',
        fullName: 'Kavya Rao',
        email: 'kavya.business@example.com',
        businessLegalName: 'Rao Traders',
        gstin: '08AAGCL9166P1ZL',
        ...SIGN_UP_CONTACT,
      });
    assert.equal(response.status, 400);
    const fields = response.body.details.body.map(
      (issue: { path: string[] }) => issue.path[0],
    );
    assert.ok(fields.includes('addressLine1'));
  });
});
