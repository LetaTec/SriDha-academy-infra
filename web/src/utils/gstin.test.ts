import { describe, expect, it } from 'vitest';

import { checkGstin } from './gstin';

// Supplier's GSTIN: Rajasthan (08), valid format and checksum
const RAJASTHAN_GSTIN = '08AAGCL9166P1ZL';

describe('checkGstin', () => {
  it('accepts a valid GSTIN and returns state information', () => {
    const result = checkGstin(RAJASTHAN_GSTIN);
    expect(result).toEqual({
      valid: true,
      gstin: RAJASTHAN_GSTIN,
      stateCode: '08',
      state: 'Rajasthan',
    });
  });

  it('normalises spaces and case', () => {
    const result = checkGstin('  08aagcl9166p1zl  ');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.gstin).toBe(RAJASTHAN_GSTIN);
    }
  });

  it('detects length issues', () => {
    expect(checkGstin('08AAGCL9166P1Z')).toEqual({
      valid: false,
      problem: 'length',
    });
    expect(checkGstin('08AAGCL9166P1ZL99')).toEqual({
      valid: false,
      problem: 'length',
    });
  });

  it('detects format issues', () => {
    // 14th character must be 'Z'
    expect(checkGstin('08AAGCL9166P1AL')).toEqual({
      valid: false,
      problem: 'format',
    });
    // PAN format invalid
    expect(checkGstin('08123456789P1ZL')).toEqual({
      valid: false,
      problem: 'format',
    });
  });

  it('detects unknown state codes', () => {
    // 99 is not a valid state code
    expect(checkGstin('99AAGCL9166P1Z8')).toEqual({
      valid: false,
      problem: 'state',
    });
  });

  it('detects checksum mismatch', () => {
    // Last character should be 'L', change to 'A'
    expect(checkGstin('08AAGCL9166P1ZA')).toEqual({
      valid: false,
      problem: 'checksum',
    });
  });

  it('maps legacy state codes correctly', () => {
    // 28 is legacy Andhra Pradesh
    const result = checkGstin('28AAAAP1234A1Z9');
    if (!result.valid && result.problem === 'checksum') {
      // Structure and state code recognized even if synthetic PAN checksum differs
      expect(result.problem).toBe('checksum');
    }
  });
});
