import { Router } from 'express';

import type { AppContext } from '../../app/context.js';
import type {
  CheckoutResponse,
  PaymentResultResponse,
  PreRegistrationsResponse,
} from '../../contracts/payments.js';
import { validate } from '../../http/validate.js';
import { getRequiredAuth, requireAuth } from '../auth/session.js';
import { createPaymentGateway } from './gateway.js';
import {
  createCheckout,
  createCheckoutSchema,
  verifyPayment,
  verifyPaymentSchema,
} from './payments.service.js';
import { listPreRegistrations } from './preRegistrations.service.js';

// The signed-in student's pre-registrations, for My learning
export const createPreRegistrationsRouter = (context: AppContext) => {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const { userId } = getRequiredAuth(req.auth);
    res.json({
      preRegistrations: await listPreRegistrations(context, userId),
    } satisfies PreRegistrationsResponse);
  });

  return router;
};

export const createPaymentsRouter = (context: AppContext) => {
  const router = Router();
  const gateway =
    context.paymentGateway ?? createPaymentGateway(context.config);

  // Paying needs no account: the order is filed under the billing email,
  // and the provider's signature is what proves a payment
  router.post('/checkout', async (req, res) => {
    const input = validate(createCheckoutSchema, req.body);
    res.status(201).json({
      checkout: await createCheckout(context, gateway, input),
    } satisfies CheckoutResponse);
  });

  router.post('/verify', async (req, res) => {
    const input = validate(verifyPaymentSchema, req.body);
    res.json({
      payment: await verifyPayment(context, gateway, input),
    } satisfies PaymentResultResponse);
  });

  return router;
};
