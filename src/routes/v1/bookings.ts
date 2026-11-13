import { Router } from 'express';
import { bookingController } from '../../controller/bookingController.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { bookingCreateRateLimiter } from '../../middleware/rateLimiter.js';
import { createBookingSchema, customerCancelBookingSchema, updateRefundAccountSchema } from '../../validators/bookingSchemas.js';

/**
 * Pemesanan sewa sisi pelanggan: /api/v1/bookings/*
 */
export const bookingRouter: Router = Router();

// Seluruh endpoint booking mewajibkan autentikasi Bearer token
bookingRouter.use(requireAuth);

bookingRouter.post(
  '/',
  bookingCreateRateLimiter,
  validateBody(createBookingSchema),
  bookingController.create,
);
bookingRouter.get('/', bookingController.list);
bookingRouter.get('/:id/status', bookingController.status);
bookingRouter.get('/:id', bookingController.detail);
bookingRouter.patch('/:id/cancel', validateBody(customerCancelBookingSchema), bookingController.cancel);
bookingRouter.post('/:id/cancel', validateBody(customerCancelBookingSchema), bookingController.cancel);
bookingRouter.patch(
  '/:id/refund-account',
  validateBody(updateRefundAccountSchema),
  bookingController.claimRefundAccount,
);
