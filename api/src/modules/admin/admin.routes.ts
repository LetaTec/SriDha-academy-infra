import { Router } from 'express';

import type { AppContext } from '../../app/context.js';
import type { TeamOrdersResponse } from '../../contracts/admin.js';
import { requirePermission } from '../auth/permissions.js';
import { requireAuth } from '../auth/session.js';
import { listTeamOrders } from './admin.service.js';

export const createAdminRouter = (context: AppContext) => {
  const router = Router();

  router.use(requireAuth);
  router.use(requirePermission(context, 'viewPayments'));

  router.get('/orders', async (_req, res) => {
    res.json({
      orders: await listTeamOrders(context),
    } satisfies TeamOrdersResponse);
  });

  return router;
};
