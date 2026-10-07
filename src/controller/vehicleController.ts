import type { NextFunction, Request, Response } from 'express';
import { vehicleModel } from '../model/vehicleModel.js';
import { AppError, sendSuccess } from '../utils/response.js';

/**
 * Controller katalog armada.
 *
 * Menangani daftar kategori, daftar armada dengan filter, dan detail armada.
 * Semua kegagalan diteruskan lewat `next(error)` supaya ditangani satu kali
 * oleh errorHandler global.
 */

export const vehicleController = {
  async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await vehicleModel.listCategories();
      sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, transmission, search, operationalStatus, startDate, endDate } =
        req.query as {
          category?: string;
          transmission?: string;
          search?: string;
          operationalStatus?: string;
          startDate?: string;
          endDate?: string;
        };

      const vehicles = await vehicleModel.listCatalog({
        category,
        transmission,
        search,
        operationalStatus,
        startDate,
        endDate,
      });

      sendSuccess(res, vehicles);
    } catch (error) {
      next(error);
    }
  },

  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const vehicle = await vehicleModel.findByIdOrExternalId(id);

      if (!vehicle) {
        throw new AppError(
          'VEHICLE_NOT_FOUND',
          `Armada dengan pengenal '${id}' tidak ditemukan.`,
          404,
        );
      }

      sendSuccess(res, vehicle);
    } catch (error) {
      next(error);
    }
  },
};
