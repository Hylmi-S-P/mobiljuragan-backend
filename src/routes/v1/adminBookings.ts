import { Router } from 'express';
import { adminBookingController } from '../../controller/adminBookingController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { UserRole } from '../../generated/prisma/client.js';
import {
  adminBookingQuerySchema,
  assignDriverSchema,
  createLineItemSchema,
  updateBookingStatusSchema,
} from '../../validators/bookingSchemas.js';

/**
 * Antrean pesanan & konfirmasi admin: /api/v1/admin/bookings/*
 */
export const adminBookingRouter: Router = Router();

// Seluruh endpoint booking portal dibatasi khusus role ADMIN dan SUPER_ADMIN
adminBookingRouter.use(requireAuth);
adminBookingRouter.use(requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN));

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

/* Penyesuaian biaya manual. Didaftarkan sebelum `/:id` tidak masalah karena
   metode dan kedalaman jalurnya berbeda, tetapi urutannya tetap dijaga. */
adminBookingRouter.post(
  '/:id/line-items',
  validateBody(createLineItemSchema),
  adminBookingController.createLineItem,
);
adminBookingRouter.delete('/:id/line-items/:lineItemId', adminBookingController.cancelLineItem);
