import { Router } from 'express';

import type { AppContext } from '../../app/context.js';
import { validate } from '../../http/validate.js';
import { createEnquiry, enquirySchema } from './enquiries.service.js';

// Public: visitors can join the AI model paper waitlist without an account.
// A signed-in visitor's request is linked to their user.
export const createEnquiriesRouter = (context: AppContext) => {
  const router = Router();

  router.post('/', async (req, res) => {
    const input = validate(enquirySchema, req.body);
    const enquiry = await createEnquiry(
      context,
      input,
      req.auth?.userId ?? null,
    );

    res.status(201).json({ enquiry });
  });

  return router;
};
