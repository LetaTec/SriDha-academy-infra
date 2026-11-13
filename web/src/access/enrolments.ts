import type { AuthContextValue } from '@context/AuthContext';
import { isBatchOpen, type Batch } from '@services/catalogue';

// Anyone can pay for an open batch; no account is needed. The API checks
// again that the batch is open and has a seat.
export const canEnrolInBatch = (_auth: AuthContextValue, batch: Batch) =>
  isBatchOpen(batch);
