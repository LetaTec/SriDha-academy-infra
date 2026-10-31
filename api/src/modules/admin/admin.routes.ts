import { Router, type RequestHandler } from 'express';

import type { AppContext } from '../../app/context.js';
import type { TeamOrdersResponse } from '../../contracts/admin.js';
import { ApiError, ERROR_CODE } from '../../http/errors.js';
import { findUserRole } from '../auth/auth.repository.js';
import { USER_ROLE } from '../auth/roles.js';
import { getRequiredAuth, requireAuth } from '../auth/session.js';
import { listTeamOrders } from './admin.service.js';

// The role is read from the database on every request, so removing someone
// from SUPER_ADMIN_EMAILS takes effect at the next restart
const requireSuperAdmin =
  ({ db }: AppContext): RequestHandler =>
  async (req, _res, next) => {
    const { userId } = getRequiredAuth(req.auth);
    if ((await findUserRole(db, userId)) !== USER_ROLE.superAdmin) {
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
    res.json({
      orders: await listTeamOrders(context),
    } satisfies TeamOrdersResponse);
  });

  return router;
};
