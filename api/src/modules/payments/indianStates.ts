import type { IndianState } from '../../contracts/payments.js';

// Every state and union territory once; the type makes a missing or
// misspelt one a compile error
const STATE_SET = {
  'Andhra Pradesh': true,
  'Arunachal Pradesh': true,
  Assam: true,
  Bihar: true,
  Chhattisgarh: true,
  Goa: true,
  Gujarat: true,
  Haryana: true,
  'Himachal Pradesh': true,
  Jharkhand: true,
  Karnataka: true,
  Kerala: true,
  'Madhya Pradesh': true,
  Maharashtra: true,
  Manipur: true,
  Meghalaya: true,
  Mizoram: true,
  Nagaland: true,
  Odisha: true,
  Punjab: true,
  Rajasthan: true,
  Sikkim: true,
  'Tamil Nadu': true,
  Telangana: true,
  Tripura: true,
  'Uttar Pradesh': true,
  Uttarakhand: true,
  'West Bengal': true,
  'Andaman and Nicobar Islands': true,
  Chandigarh: true,
  'Dadra and Nagar Haveli and Daman and Diu': true,
  Delhi: true,
  'Jammu and Kashmir': true,
  Ladakh: true,
  Lakshadweep: true,
  Puducherry: true,
} as const satisfies Record<IndianState, true>;

export const INDIAN_STATES = Object.keys(STATE_SET) as [
  IndianState,
  ...IndianState[],
];
