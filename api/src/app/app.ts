import { existsSync } from 'node:fs';
import path from 'node:path';

import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

import {
  ApiError,
  ERROR_CODE,
  errorHandler,
  notFoundHandler,
} from '../http/errors.js';
import { createOriginGuard } from '../http/originGuard.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createSessionMiddleware } from '../modules/auth/session.js';
import { createCatalogueRouter } from '../modules/catalogue/catalogue.routes.js';
import { createEnquiriesRouter } from '../modules/enquiries/enquiries.routes.js';
import { createEnrolmentsRouter } from '../modules/enrolments/enrolments.routes.js';
import { createPaymentsRouter } from '../modules/payments/payments.routes.js';
import { createRazorpayWebhookHandler } from '../modules/payments/payments.webhook.js';
import type { AppContext } from './context.js';

const WEB_DIST_PATH = path.resolve(import.meta.dirname, '../../../web/dist');
const JSON_BODY_LIMIT = '32kb';

const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
  next();
};

const apiSecurityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none';",
  );
  next();
};

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

const createCorsMiddleware = (
  allowedOrigins: readonly string[],
): RequestHandler => {
  const originSet = new Set(allowedOrigins);

  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && originSet.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Cookie, Accept, X-Requested-With',
      );
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
};

export const createApp = (context: AppContext) => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);

  const api = express.Router();
  api.use(noStore);
  api.use(apiSecurityHeaders);
  api.use(createCorsMiddleware(context.config.allowedOrigins));
  // Razorpay signs the exact request bytes, so its webhook reads the raw
  // body before JSON parsing. It is server to server: no session or origin.
  api.post(
    '/payments/webhook',
    express.raw({ type: 'application/json', limit: JSON_BODY_LIMIT }),
    createRazorpayWebhookHandler(context),
  );
  api.use(express.json({ limit: JSON_BODY_LIMIT }));
  api.use(cookieParser());
  api.use(createOriginGuard(context.config.allowedOrigins));
  api.use(createSessionMiddleware(context));

  // Health endpoint: tests live database connectivity
  api.get('/health', async (_req, res) => {
    try {
      await context.db.query('SELECT 1');
      res.json({
        status: 'ok',
        env: context.config.env,
        database: 'connected',
        timestamp: context.now().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        message: (error as Error).message,
      });
    }
  });

  // Rate limiting on sensitive endpoints
  if (context.config.enableRateLimiting) {
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(
          new ApiError(
            429,
            ERROR_CODE.rateLimitExceeded,
            'Too many login attempts. Please try again later.',
          ),
        );
      },
    });

    const registerLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(
          new ApiError(
            429,
            ERROR_CODE.rateLimitExceeded,
            'Too many registration attempts. Please try again later.',
          ),
        );
      },
    });

    const passwordResetConfirmLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(
          new ApiError(
            429,
            ERROR_CODE.rateLimitExceeded,
            'Too many password reset verification attempts. Please try again later.',
          ),
        );
      },
    });

    const passwordResetLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(
          new ApiError(
            429,
            ERROR_CODE.rateLimitExceeded,
            'Too many password reset attempts. Please try again later.',
          ),
        );
      },
    });

    const enquiryLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(
          new ApiError(
            429,
            ERROR_CODE.rateLimitExceeded,
            'Too many enquiry submissions. Please try again later.',
          ),
        );
      },
    });

    // Each checkout creates a provider order, so retries are capped
    const paymentLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(
          new ApiError(
            429,
            ERROR_CODE.rateLimitExceeded,
            'Too many payment attempts. Please try again later.',
          ),
        );
      },
    });

    api.use('/auth/login', loginLimiter);
    api.use('/auth/register', registerLimiter);
    api.use('/auth/password-reset/confirm', passwordResetConfirmLimiter);
    api.use('/auth/password-reset', passwordResetLimiter);
    api.use('/auth/admin-sign-in', passwordResetLimiter);
    api.use('/enquiries', enquiryLimiter);
    api.use('/payments', paymentLimiter);
  }

  api.use('/auth', createAuthRouter(context));
  api.use('/catalogue', createCatalogueRouter(context));
  api.use('/enrolments', createEnrolmentsRouter(context));
  api.use('/payments', createPaymentsRouter(context));
  api.use('/enquiries', createEnquiriesRouter(context));
  api.use(notFoundHandler);
  api.use(errorHandler);

  app.use('/api', api);

  if (context.config.serveWebDist) {
    if (!existsSync(WEB_DIST_PATH)) {
      throw new Error(
        `SERVE_WEB_DIST is enabled but ${WEB_DIST_PATH} does not exist — run "npm run build -w web" first`,
      );
    }

    app.use(express.static(WEB_DIST_PATH, { index: false }));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(WEB_DIST_PATH, 'index.html'));
    });
  }

  return app;
};
