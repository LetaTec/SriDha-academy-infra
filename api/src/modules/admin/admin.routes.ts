import { Router, type RequestHandler } from 'express';

import type { AppContext } from '../../app/context.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { USER_ROLE } from '../auth/roles.js';
import { getRequiredAuth, requireAuth } from '../auth/session.js';
import { listTeamOrders } from './admin.service.js';

// The role is read from the database on every request, so removing someone
// from SUPER_ADMIN_EMAILS takes effect at the next restart
const requireSuperAdmin =
  ({ db }: AppContext): RequestHandler =>
  async (req, _res, next) => {
    const { userId } = getRequiredAuth(req.auth);
    const user = await db.get<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [userId],
    );

    if (user?.role !== USER_ROLE.superAdmin) {
      throw new ApiError(
        403,
        ERROR_CODE.forbidden,
        'Only the SriDha Academy team can see this',
      );
    }

    next();
  };

export const createAdminRouter = (context: AppContext) => {
  const router = Router();

  router.use(requireAuth);
  router.use(requireSuperAdmin(context));

  router.get('/orders', async (_req, res) => {
    res.json({ orders: await listTeamOrders(context) });
  });

  return router;
};
