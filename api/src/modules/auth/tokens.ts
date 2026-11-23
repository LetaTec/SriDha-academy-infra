import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

const TOKEN_BYTES = 32;

// The raw token only ever lives in the cookie or reset link; the database
// stores its SHA-256 digest so a leaked database cannot be replayed.
export const generateToken = () =>
  randomBytes(TOKEN_BYTES).toString('base64url');

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

// A 6-digit code, e.g. "042917"
export const generateCode = () =>
  String(randomInt(0, 1_000_000)).padStart(6, '0');

// Codes are short, so each is hashed with its own row id: a leaked table
// cannot be matched against one precomputed list of all million codes
export const hashCode = (codeId: string, code: string) =>
  hashToken(`${codeId}:${code}`);

export const isSameHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
