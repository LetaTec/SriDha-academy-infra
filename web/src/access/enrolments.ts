import type { AuthContextValue } from '@context/AuthContext';
import { isBatchOpen, type Batch } from '@services/catalogue';

// Anyone can head to payment for an open batch; the checkout page asks for
// an account before taking any money, and the API requires one to check out.
export const canEnrolInBatch = (_auth: AuthContextValue, batch: Batch) =>
  isBatchOpen(batch);
