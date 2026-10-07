import { vehicleModel } from '../model/vehicleModel.js';
import type { NextFunction, Request, Response } from 'express';
import type { OperationalStatus } from '../generated/prisma/client.js';
import { AppError, sendSuccess } from '../utils/response.js';

/**
 * Controller manajemen armada untuk portal staf/admin.
 *
 * Menangani pembaruan status fisik armada beserta audit lognya.
 * Semua kegagalan diteruskan lewat `next(error)` supaya ditangani satu kali
 * oleh errorHandler global.
 */

export const adminVehicleController = {
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status: nextStatus, note } = req.body;
      const staffUser = req.user!;

      const vehicle = await vehicleModel.findByIdOrExternalId(id);

      if (!vehicle) {
        throw new AppError('VEHICLE_NOT_FOUND', `Armada dengan pengenal '${id}' tidak ditemukan.`, 404);
      }

      const updatedVehicle = await vehicleModel.updateOperationalStatus(
        vehicle,
        nextStatus as OperationalStatus,
        staffUser.userId,
        note
      );

      sendSuccess(res, updatedVehicle);
    } catch (error) {
      next(error);
    }
  },
};
