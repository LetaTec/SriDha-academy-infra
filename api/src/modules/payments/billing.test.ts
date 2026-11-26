import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createFakeRazorpay } from '../../test/fakeRazorpay.js';
import { startTestServer } from '../../test/testServer.js';

const PRE_REGISTER_TOPIC = 'topic_physics_ray_optics_class_12';
// The supplier's own GSTIN: a real, Rajasthan (08) GSTIN with a valid check
// character, used here only to exercise the business checkout
const RAJASTHAN_GSTIN = '08AAGCL9166P1ZL';

const INDIVIDUAL = {
  customerType: 'INDIVIDUAL',
  fullName: 'Asha Verma',
  email: 'asha.billing@example.com',
  mobile: '+91 98765 43210',
  addressLine1: '12 Civil Lines',
  addressLine2: 'Near the clock tower',
  city: 'Jaipur',
  state: 'Rajasthan',
  pinCode: '302006',
};

const BUSINESS = {
  customerType: 'BUSINESS',
  businessLegalName: 'Verma Learning Private Limited',
  gstin: RAJASTHAN_GSTIN,
  purchaseOrderReference: 'PO-2026-0042',
  fullName: 'Asha Verma',
  email: 'accounts@vermalearning.example.com',
  mobile: '+91 98765 43210',
  addressLine1: '4th floor, Tonk Road',
  city: 'Jaipur',
  state: 'Rajasthan',
  pinCode: '302015',
};

type FieldIssue = { path: string[]; message: string };

describe('billing details at checkout', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let buyer = 0;

  before(async () => {
    server = await startTestServer({ paymentGateway: createFakeRazorpay() });
  });

  after(async () => {
    await server.close();
  });

  const checkout = (billing: Record<string, unknown>) => {
    buyer += 1;
    return server.createClient().request('POST', '/api/payments/checkout', {
      kind: 'PRE_REGISTRATION',
      topicId: PRE_REGISTER_TOPIC,
      ...billing,
      email: String(billing.email).replace('@', `+${buyer}@`),
    });
  };

  const fieldsOf = (body: { details: { body: FieldIssue[] } }) =>
    body.details.body.map(issue => issue.path.join('.'));

  const billingRow = (paymentId: string) =>
    server.db.get<Record<string, unknown>>(
      `SELECT customer_type, billing_name, address_line1, address_line2,
              billing_city, billing_state, billing_state_code, pin_code,
              business_legal_name, gstin, gstin_state_code, gstin_check,
              purchase_order_reference
       FROM payments WHERE id = $1`,
      [paymentId],
    );

  it("records an individual's billing address, state code and PIN on the payment", async () => {
    const response = await checkout(INDIVIDUAL);
    assert.equal(response.status, 201);

    assert.deepEqual(await billingRow(response.body.checkout.paymentId), {
      customer_type: 'INDIVIDUAL',
      billing_name: 'Asha Verma',
      address_line1: '12 Civil Lines',
      address_line2: 'Near the clock tower',
      billing_city: 'Jaipur',
      billing_state: 'Rajasthan',
      billing_state_code: '08',
      pin_code: '302006',
      business_legal_name: null,
      gstin: null,
      gstin_state_code: null,
      gstin_check: null,
      purchase_order_reference: null,
    });
  });

  it('asks an individual for a valid PIN, but not a street address', async () => {
    const missing = await checkout({
      ...INDIVIDUAL,
      addressLine1: '',
      pinCode: '30200',
    });
    assert.equal(missing.status, 400);
    assert.deepEqual(fieldsOf(missing.body), ['pinCode']);

    for (const pinCode of ['012345', '30200A', '3020066']) {
      const invalid = await checkout({ ...INDIVIDUAL, pinCode });
      assert.equal(invalid.status, 400, pinCode);
      assert.deepEqual(fieldsOf(invalid.body), ['pinCode']);
    }
  });

  it('refuses business details on an individual checkout', async () => {
    const response = await checkout({ ...INDIVIDUAL, gstin: RAJASTHAN_GSTIN });
    assert.equal(response.status, 400);
  });

  it("records a business buyer's legal name, GSTIN (format checked) and purchase order", async () => {
    const response = await checkout({
      ...BUSINESS,
      gstin: ' 08aagcl9166p1zl ',
    });
    assert.equal(response.status, 201);

    assert.deepEqual(await billingRow(response.body.checkout.paymentId), {
      customer_type: 'BUSINESS',
      billing_name: 'Asha Verma',
      address_line1: '4th floor, Tonk Road',
      address_line2: null,
      billing_city: 'Jaipur',
      billing_state: 'Rajasthan',
      billing_state_code: '08',
      pin_code: '302015',
      business_legal_name: 'Verma Learning Private Limited',
      gstin: RAJASTHAN_GSTIN,
      gstin_state_code: '08',
      // Well-formed only: no authority has confirmed it is registered
      gstin_check: 'FORMAT_VALID',
      purchase_order_reference: 'PO-2026-0042',
    });
  });

  it('refuses a business checkout with a malformed GSTIN or one from another state', async () => {
    const malformed = await checkout({ ...BUSINESS, gstin: '08AAGCL9166P1ZM' });
    assert.equal(malformed.status, 400);
    assert.deepEqual(fieldsOf(malformed.body), ['gstin']);
    assert.match(malformed.body.details.body[0].message, /check the GSTIN/i);

    const otherState = await checkout({ ...BUSINESS, state: 'Maharashtra' });
    assert.equal(otherState.status, 400);
    assert.deepEqual(fieldsOf(otherState.body), ['gstin']);
    assert.match(otherState.body.details.body[0].message, /Rajasthan/);

    const noName = await checkout({ ...BUSINESS, businessLegalName: '' });
    assert.equal(noName.status, 400);
    assert.deepEqual(fieldsOf(noName.body), ['businessLegalName']);

    const noGstin = await checkout({ ...BUSINESS, gstin: undefined });
    assert.equal(noGstin.status, 400);
    assert.deepEqual(fieldsOf(noGstin.body), ['gstin']);
  });
});
