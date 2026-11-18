import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkGstin } from './gstin.js';

// The supplier's own GSTIN (public on every invoice it issues), used as a
// real example whose check character is known to be right
const SUPPLIER_GSTIN = '08AAGCL9166P1ZL';

describe('GSTIN checks', () => {
  it('accepts a real GSTIN and reads its state from the state code', () => {
    assert.deepEqual(checkGstin(SUPPLIER_GSTIN), {
      valid: true,
      gstin: SUPPLIER_GSTIN,
      stateCode: '08',
      state: 'Rajasthan',
    });
  });

  it('normalises spaces and case before checking', () => {
    const result = checkGstin(' 08aagcl9166p1zl ');
    assert.equal(result.valid, true);
    assert.equal(result.valid && result.gstin, SUPPLIER_GSTIN);
  });

  it('refuses a wrong length, a broken structure, an unknown state code or a wrong check character', () => {
    for (const [input, problem] of [
      ['08AAGCL9166P1Z', 'length'],
      ['08AAGCL9166P1ZLX', 'length'],
      ['08AAGC19166P1ZL', 'format'],
      ['08AAGCL9166P1XL', 'format'],
      ['99AAGCL9166P1ZL', 'state'],
      ['00AAGCL9166P1ZL', 'state'],
      ['08AAGCL9166P1ZM', 'checksum'],
      ['08AAGCL9166Q1ZL', 'checksum'],
    ] as const) {
      assert.deepEqual(
        checkGstin(input),
        { valid: false, problem },
        `${input} should fail on ${problem}`,
      );
    }
  });

  it("maps the older Andhra Pradesh and Daman and Diu codes to today's states", () => {
    // A GSTIN is only valid with its own check character, so these are
    // built with the same algorithm the checker uses
    const withCheck = (first14: string) => {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let sum = 0;
      for (let index = 0; index < 14; index += 1) {
        const product = chars.indexOf(first14[index]) * (index % 2 ? 2 : 1);
        sum += Math.floor(product / 36) + (product % 36);
      }
      return first14 + chars[(36 - (sum % 36)) % 36];
    };

    const andhra = checkGstin(withCheck('28AAGCL9166P1Z'));
    assert.equal(andhra.valid && andhra.state, 'Andhra Pradesh');
    const andhraNew = checkGstin(withCheck('37AAGCL9166P1Z'));
    assert.equal(andhraNew.valid && andhraNew.state, 'Andhra Pradesh');
    const daman = checkGstin(withCheck('25AAGCL9166P1Z'));
    assert.equal(
      daman.valid && daman.state,
      'Dadra and Nagar Haveli and Daman and Diu',
    );
  });
});
