import { Router } from 'express';
import { z } from 'zod';
import { vehicleController } from '../../controller/vehicleController.js';
import { validateQuery } from '../../middleware/validate.js';

/**
 * Vehicle Catalog & Availability: /api/v1/vehicles/*
 */
export const vehicleRouter: Router = Router();

const vehicleQuerySchema = z
  .object({
    category: z.string().optional(),
    transmission: z.string().optional(),
    search: z.string().optional(),
    operationalStatus: z
      .string()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['AVAILABLE', 'BOOKED', 'MAINTENANCE', 'UNAVAILABLE', 'ALL'].includes(val), {
        message:
          'Status operasional tidak valid (pilih: AVAILABLE, BOOKED, MAINTENANCE, UNAVAILABLE, atau ALL).',
      })
      .optional(),
    startDate: z
      .string()
      .datetime({
        message: 'Format startDate harus berupa ISO 8601 (contoh: 2026-10-01T08:00:00Z).',
      })
      .optional(),
    endDate: z
      .string()
      .datetime({ message: 'Format endDate harus berupa ISO 8601 (contoh: 2026-10-03T18:00:00Z).' })
      .optional(),
  })
  .refine(
    (data) => {
      if ((data.startDate && !data.endDate) || (!data.startDate && data.endDate)) {
        return false;
      }
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message:
        'startDate dan endDate harus diberikan bersamaan, dan endDate harus lebih besar dari startDate.',
      path: ['endDate'],
    },
  );

// Mengambil daftar kategori armada yang tersedia (MPV, SUV, PICKUP, dll).
vehicleRouter.get('/categories', vehicleController.listCategories);

// Katalog armada kendaraan dengan filter kategori, pencarian, dan ketersediaan tanggal sewa.
vehicleRouter.get('/', validateQuery(vehicleQuerySchema), vehicleController.list);

// Detail armada kendaraan berdasarkan ID (UUID) atau externalId.
vehicleRouter.get('/:id', vehicleController.detail);
