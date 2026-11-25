import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../../app/context.js';
import type {
  TestAttemptResponse,
  TestAttemptsResponse,
} from '../../contracts/payments.js';
import { validate } from '../../http/validate.js';
import { getRequiredAuth, requireAuth } from '../auth/session.js';
import {
  finishTestAttempt,
  listTestAttempts,
  startTestAttempt,
} from './testAttempts.service.js';

const listQuery = z.strictObject({
  topicId: z.string().trim().min(1).max(150).optional(),
});

// Starting and finishing carry nothing: the attempt is in the address and
// the student is the signed-in account
const emptyBody = z.strictObject({});

// A signed-in student's paid topic test attempts: list them, start one (its
// 45-minute clock is set here, not by the browser) and finish one early.
// Attempts are bought through payment checkout (kind TEST_ATTEMPT).
export const createTestAttemptsRouter = (context: AppContext) => {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const { userId } = getRequiredAuth(req.auth);
    const { topicId } = validate(listQuery, req.query, 'query');
    res.json({
      attempts: await listTestAttempts(context, userId, topicId ?? null),
    } satisfies TestAttemptsResponse);
  });

  router.post('/:attemptId/start', async (req, res) => {
    const { userId } = getRequiredAuth(req.auth);
    validate(emptyBody, req.body ?? {});
    res.json({
      attempt: await startTestAttempt(
        context,
        userId,
        String(req.params.attemptId),
      ),
    } satisfies TestAttemptResponse);
  });

  router.post('/:attemptId/finish', async (req, res) => {
    const { userId } = getRequiredAuth(req.auth);
    validate(emptyBody, req.body ?? {});
    res.json({
      attempt: await finishTestAttempt(
        context,
        userId,
        String(req.params.attemptId),
      ),
    } satisfies TestAttemptResponse);
  });

  return router;
};
