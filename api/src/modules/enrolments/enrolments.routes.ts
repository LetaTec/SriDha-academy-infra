import { Router } from 'express';

import type { AppContext } from '../../app/context.js';
import type { EnrolmentsResponse } from '../../contracts/payments.js';
import { getRequiredAuth, requireAuth } from '../auth/session.js';
import { listEnrolments } from './enrolments.service.js';

// Students read their enrolments here. Seats are only taken through
// payment checkout (/api/payments/checkout), never reserved without paying.
export const createEnrolmentsRouter = (context: AppContext) => {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const { userId } = getRequiredAuth(req.auth);
    res.json({
      enrolments: await listEnrolments(context, userId),
    } satisfies EnrolmentsResponse);
  });

  return router;
};
