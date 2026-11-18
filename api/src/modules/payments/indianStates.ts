import type { IndianState } from '../../contracts/payments.js';

// Every state and union territory once, with its GST state code (the first
// two digits of a GSTIN registered there). The type makes a missing or
// misspelt one a compile error. Tax rules compare these codes, never the
// names typed or chosen at checkout.
export const GST_STATE_CODE = {
  'Jammu and Kashmir': '01',
  'Himachal Pradesh': '02',
  Punjab: '03',
  Chandigarh: '04',
  Uttarakhand: '05',
  Haryana: '06',
  Delhi: '07',
  Rajasthan: '08',
  'Uttar Pradesh': '09',
  Bihar: '10',
  Sikkim: '11',
  'Arunachal Pradesh': '12',
  Nagaland: '13',
  Manipur: '14',
  Mizoram: '15',
  Tripura: '16',
  Meghalaya: '17',
  Assam: '18',
  'West Bengal': '19',
  Jharkhand: '20',
  Odisha: '21',
  Chhattisgarh: '22',
  'Madhya Pradesh': '23',
  Gujarat: '24',
  'Dadra and Nagar Haveli and Daman and Diu': '26',
  Maharashtra: '27',
  Karnataka: '29',
  Goa: '30',
  Lakshadweep: '31',
  Kerala: '32',
  'Tamil Nadu': '33',
  Puducherry: '34',
  'Andaman and Nicobar Islands': '35',
  Telangana: '36',
  'Andhra Pradesh': '37',
  Ladakh: '38',
} as const satisfies Record<IndianState, string>;

// Codes still found on GSTINs issued before a state was reorganised:
// 28 (Andhra Pradesh before 2014) and 25 (Daman and Diu before its 2020
// merger with Dadra and Nagar Haveli)
const LEGACY_GST_STATE_CODE: Record<string, IndianState> = {
  '28': 'Andhra Pradesh',
  '25': 'Dadra and Nagar Haveli and Daman and Diu',
};

export const INDIAN_STATES = Object.keys(GST_STATE_CODE) as [
  IndianState,
  ...IndianState[],
];

const STATE_FOR_CODE = new Map<string, IndianState>([
  ...Object.entries(LEGACY_GST_STATE_CODE),
  ...INDIAN_STATES.map(
    state => [GST_STATE_CODE[state], state] as [string, IndianState],
  ),
]);

// The state a GST state code belongs to, or null for an unknown code
export const stateForGstStateCode = (code: string): IndianState | null =>
  STATE_FOR_CODE.get(code) ?? null;
