import { Router } from 'express';
import { adminBookingController } from '../../controller/adminBookingController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { UserRole } from '../../generated/prisma/client.js';
import {
  adminBookingQuerySchema,
  assignDriverSchema,
  updateBookingStatusSchema,
} from '../../validators/bookingSchemas.js';

/**
 * Admin Bookings & Operations: /api/v1/admin/bookings/*
 */
export const adminBookingRouter: Router = Router();

// Seluruh endpoint admin booking dibatasi khusus role STAFF dan ADMIN
adminBookingRouter.use(requireAuth);
adminBookingRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminBookingRouter.get('/', validateQuery(adminBookingQuerySchema), adminBookingController.list);
adminBookingRouter.get('/:id', adminBookingController.detail);
adminBookingRouter.patch(
  '/:id/status',
  validateBody(updateBookingStatusSchema),
  adminBookingController.updateStatus,
);
adminBookingRouter.patch(
  '/:id/driver',
  validateBody(assignDriverSchema),
  adminBookingController.assignDriver,
);