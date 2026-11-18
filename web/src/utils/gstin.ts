import type { IndianState } from '@contracts/payments';
import { stateForGstStateCode } from '@constants/payments';

// GSTIN checks done on the client, identical to the API logic:
// length (15), structure (state code, PAN, entity number, Z, check character),
// a known state code, and the check character recomputed with the published
// GSTIN checksum (MOD 36).
export type GstinCheck =
  | { valid: true; gstin: string; stateCode: string; state: IndianState }
  | { valid: false; problem: 'length' | 'format' | 'state' | 'checksum' };

const CHARACTERS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const STRUCTURE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const checkCharacter = (first14: string) => {
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const product =
      CHARACTERS.indexOf(first14[index]) * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARACTERS[(36 - (sum % 36)) % 36];
};

export const checkGstin = (input: string): GstinCheck => {
  const gstin = input.trim().toUpperCase();

  if (gstin.length !== 15) return { valid: false, problem: 'length' };
  if (!STRUCTURE.test(gstin)) return { valid: false, problem: 'format' };

  const stateCode = gstin.slice(0, 2);
  const state = stateForGstStateCode(stateCode);
  if (!state) return { valid: false, problem: 'state' };

  if (checkCharacter(gstin.slice(0, 14)) !== gstin[14]) {
    return { valid: false, problem: 'checksum' };
  }

  return { valid: true, gstin, stateCode, state };
};
