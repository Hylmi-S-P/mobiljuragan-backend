import { Router } from 'express';
import { z } from 'zod';
import { adminVehicleController } from '../../controller/adminVehicleController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { OperationalStatus, UserRole } from '../../generated/prisma/client.js';

/**
 * Admin Vehicle Management: /api/v1/admin/vehicles/*
 */
export const adminVehicleRouter: Router = Router();

// Endpoint khusus role STAFF dan ADMIN
adminVehicleRouter.use(requireAuth);
adminVehicleRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

const updateVehicleStatusSchema = z.object({
  status: z.nativeEnum(OperationalStatus, {
    errorMap: () => ({ message: 'Status operasional tidak valid (pilih: AVAILABLE, BOOKED, MAINTENANCE, UNAVAILABLE).' }),
  }),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

// Memperbarui status fisik/operasional armada mobil dan mencatat ke audit log staf.
adminVehicleRouter.patch('/:id/status', validateBody(updateVehicleStatusSchema), adminVehicleController.updateStatus);