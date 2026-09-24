import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { validateQuery } from '../../middleware/validate.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { BookingStatus, OperationalStatus } from '../../generated/prisma/client.js';

export const vehicleRouter: Router = Router();

const vehicleQuerySchema = z.object({
  category: z.string().optional(),
  transmission: z.string().optional(),
  search: z.string().optional(),
  operationalStatus: z.string().optional(),
  startDate: z.string().datetime({ message: 'Format startDate harus berupa ISO 8601 (contoh: 2026-10-01T08:00:00Z).' }).optional(),
  endDate: z.string().datetime({ message: 'Format endDate harus berupa ISO 8601 (contoh: 2026-10-03T18:00:00Z).' }).optional(),
}).refine(
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
    message: 'startDate dan endDate harus diberikan bersamaan, dan endDate harus lebih besar dari startDate.',
    path: ['endDate'],
  }
);

/**
 * GET /api/v1/vehicles/categories
 * Mengambil daftar kategori armada yang tersedia (MPV, SUV, PICKUP, dll).
 */
vehicleRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const records = await db.vehicle.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    const categories = records
      .map((r) => r.category)
      .filter((c): c is string => Boolean(c));

    sendSuccess(res, categories);
  } catch (error) {
    sendError(res, 'FETCH_CATEGORIES_ERROR', 'Gagal memuat kategori armada.', 500);
  }
});

/**
 * GET /api/v1/vehicles
 * Mengambil katalog armada kendaraan dengan filter kategori, pencarian, dan ketersediaan tanggal sewa.
 */
vehicleRouter.get('/', validateQuery(vehicleQuerySchema), async (req: Request, res: Response) => {
  try {
    const { category, transmission, search, operationalStatus, startDate, endDate } = req.query as {
      category?: string;
      transmission?: string;
      search?: string;
      operationalStatus?: string;
      startDate?: string;
      endDate?: string;
    };

    const whereClause: any = {};

    // Filter status operasional (default: AVAILABLE)
    if (operationalStatus && operationalStatus.toUpperCase() !== 'ALL') {
      whereClause.operationalStatus = operationalStatus.toUpperCase() as OperationalStatus;
    } else if (!operationalStatus) {
      whereClause.operationalStatus = OperationalStatus.AVAILABLE;
    }

    // Filter kategori
    if (category) {
      whereClause.category = {
        equals: category,
        mode: 'insensitive',
      };
    }

    // Filter transmisi
    if (transmission) {
      whereClause.transmission = {
        equals: transmission,
        mode: 'insensitive',
      };
    }

    // Filter pencarian nama armada, plat nomor, atau model
    if (search && search.trim() !== '') {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { licensePlate: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filter ketersediaan berdasarkan bentrok tanggal sewa dengan booking aktif
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      whereClause.bookings = {
        none: {
          AND: [
            {
              status: {
                in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
              },
            },
            { startDateTime: { lt: end } },
            { endDateTime: { gt: start } },
          ],
        },
      };
    }

    const vehicles = await db.vehicle.findMany({
      where: whereClause,
      orderBy: [
        { operationalStatus: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        externalId: true,
        name: true,
        licensePlate: true,
        brand: true,
        model: true,
        seatingCapacity: true,
        transmission: true,
        category: true,
        imageUrl: true,
        operationalStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    sendSuccess(res, vehicles);
  } catch (error) {
    sendError(res, 'FETCH_VEHICLES_ERROR', 'Gagal memuat katalog armada kendaraan.', 500);
  }
});

/**
 * GET /api/v1/vehicles/:id
 * Mengambil detail armada kendaraan berdasarkan ID (UUID) atau externalId.
 */
vehicleRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vehicle = await db.vehicle.findFirst({
      where: {
        OR: [
          { id },
          { externalId: id },
        ],
      },
    });

    if (!vehicle) {
      sendError(res, 'VEHICLE_NOT_FOUND', `Armada dengan pengenal '${id}' tidak ditemukan.`, 404);
      return;
    }

    sendSuccess(res, vehicle);
  } catch (error) {
    sendError(res, 'FETCH_VEHICLE_DETAIL_ERROR', 'Gagal memuat detail armada kendaraan.', 500);
  }
});
