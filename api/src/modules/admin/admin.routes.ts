import { Router } from 'express';

import type { AppContext } from '../../app/context.js';
import type {
  TeamOrdersResponse,
  TeamTodayLoginsResponse,
} from '../../contracts/admin.js';
import { requirePermission } from '../auth/permissions.js';
import { requireAuth } from '../auth/session.js';
import { listTeamOrders, listTodayTeamLogins } from './admin.service.js';

export const createAdminRouter = (context: AppContext) => {
  const router = Router();

  router.use(requireAuth);

  router.get(
    '/orders',
    requirePermission(context, 'viewPayments'),
    async (_req, res) => {
      res.json({
        orders: await listTeamOrders(context),
      } satisfies TeamOrdersResponse);
    },
  );

  router.get(
    '/activity/today',
    requirePermission(context, 'viewLoginActivity'),
    async (_req, res) => {
      res.json({
        logins: await listTodayTeamLogins(context),
      } satisfies TeamTodayLoginsResponse);
    },
  );

  return router;
};
