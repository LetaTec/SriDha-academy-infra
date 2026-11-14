import type { RequestHandler } from 'express';

import { ApiError, ERROR_CODE } from './errors.js';
import { isOriginAllowed } from './origins.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Session cookies are SameSite=Lax; this guard additionally rejects
// state-changing requests that a browser sends from another origin.
export const createOriginGuard =
  (allowedOrigins: readonly string[]): RequestHandler =>
  (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const rawOrigin = req.get('origin');
    const origin = rawOrigin ? rawOrigin.trim().replace(/\/+$/, '') : null;

    if (origin && !isOriginAllowed(allowedOrigins, origin)) {
      next(
        new ApiError(
          403,
          ERROR_CODE.originNotAllowed,
          'This request is not allowed from this origin',
        ),
      );
      return;
    }

    next();
  };
