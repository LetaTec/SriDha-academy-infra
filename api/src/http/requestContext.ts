import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

import { logger, runWithRequestId } from '../logging/logger.js';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// A request id from the platform in front of us is kept when it looks
// like one; anything else is replaced, so the log cannot be forged
const VALID_REQUEST_ID = /^[\w.-]{8,100}$/;

const HEALTH_PATH = '/api/health';

// Gives every request an id, returns it in X-Request-Id (so a student or
// the website can quote it) and logs one line per request when it ends.
export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  const requestId =
    incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  const startedAt = process.hrtime.bigint();

  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    const fields = {
      requestId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Number((process.hrtime.bigint() - startedAt) / 1_000_000n),
    };

    // Uptime checks hit the health endpoint constantly
    if (path === HEALTH_PATH && res.statusCode < 400) {
      logger.debug('http.request', fields);
    } else if (res.statusCode >= 500) {
      logger.error('http.request', fields);
    } else {
      logger.info('http.request', fields);
    }
  });

  runWithRequestId(requestId, next);
};
