import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import type {
  EnquiryRequest,
  EnquiryType,
  ModelPaperExam,
} from '../../contracts/enquiries.js';
import { insertEnquiry } from './enquiries.repository.js';

export const ENQUIRY_TYPE = {
  modelPaperWaitlist: 'MODEL_PAPER_WAITLIST',
} as const satisfies Record<string, EnquiryType>;

export const MODEL_PAPER_EXAMS = [
  'JEE',
  'NEET',
  'UPSC',
  'CA',
  'COMMERCE_11_12',
] as const satisfies readonly ModelPaperExam[];

export const enquirySchema = z.strictObject({
  type: z.literal(ENQUIRY_TYPE.modelPaperWaitlist),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('Enter a valid email address')),
  exam: z.enum(MODEL_PAPER_EXAMS),
}) satisfies z.ZodType<EnquiryRequest>;

export type EnquiryInput = z.infer<typeof enquirySchema>;

// Saves a waitlist request; a signed-in visitor's request is linked to
// their account
export const createEnquiry = async (
  { db, now }: AppContext,
  input: EnquiryInput,
  userId: string | null,
) => {
  const id = randomUUID();

  await insertEnquiry(db, {
    id,
    type: input.type,
    email: input.email,
    exam: input.exam,
    userId,
    createdAt: now().toISOString(),
  });

  return { id, type: input.type };
};
