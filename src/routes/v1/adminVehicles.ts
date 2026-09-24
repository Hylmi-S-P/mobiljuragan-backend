import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess, sendError, AppError } from '../../utils/response.js';
import { OperationalStatus, UserRole } from '../../generated/prisma/client.js';

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

/**
 * PATCH /api/v1/admin/vehicles/:id/status
 * Memperbarui status fisik/operasional armada mobil dan mencatat ke audit log staf.
 */
adminVehicleRouter.patch(
  '/:id/status',
  validateBody(updateVehicleStatusSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status: nextStatus, note } = req.body;
      const staffUser = req.user!;

      const vehicle = await db.vehicle.findFirst({
        where: {
          OR: [{ id }, { externalId: id }],
        },
      });

      if (!vehicle) {
        throw new AppError('VEHICLE_NOT_FOUND', `Armada dengan pengenal '${id}' tidak ditemukan.`, 404);
      }

      const updatedVehicle = await db.$transaction(async (tx) => {
        const updated = await tx.vehicle.update({
          where: { id: vehicle.id },
          data: {
            operationalStatus: nextStatus,
          },
        });

        // Catat jejak audit aktivitas staf
        await tx.auditLog.create({
          data: {
            actorId: staffUser.userId,
            action: 'UPDATE_VEHICLE_STATUS',
            entityType: 'Vehicle',
            entityId: vehicle.id,
            metadata: {
              externalId: vehicle.externalId,
              name: vehicle.name,
              licensePlate: vehicle.licensePlate,
              fromStatus: vehicle.operationalStatus,
              toStatus: nextStatus,
              note: note || null,
            },
          },
        });

        return updated;
      });

      sendSuccess(res, updatedVehicle);
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.code, error.message, error.statusCode);
        return;
      }
      sendError(res, 'UPDATE_VEHICLE_STATUS_ERROR', 'Gagal memperbarui status armada kendaraan.', 500);
    }
  }
);
