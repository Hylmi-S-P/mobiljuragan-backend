import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateQuery } from '../../middleware/validate.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { BookingStatus, UserRole } from '../../generated/prisma/client.js';

export const adminFleetRouter: Router = Router();

// Endpoint khusus role STAFF dan ADMIN
adminFleetRouter.use(requireAuth);
adminFleetRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

const fleetCalendarQuerySchema = z
  .object({
    startDate: z.string().datetime({ message: 'startDate harus berformat ISO 8601.' }).optional(),
    endDate: z.string().datetime({ message: 'endDate harus berformat ISO 8601.' }).optional(),
    category: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'endDate harus lebih besar dari startDate.',
      path: ['endDate'],
    }
  );

/**
 * GET /api/v1/admin/fleet/calendar
 * Mengambil matriks jadwal pemesanan sewa 9 armada untuk tampilan visual timeline / kalender admin.
 */
adminFleetRouter.get(
  '/calendar',
  validateQuery(fleetCalendarQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { startDate: rawStart, endDate: rawEnd, category } = req.query as {
        startDate?: string;
        endDate?: string;
        category?: string;
      };

      // Default rentang waktu: 30 hari ke depan jika parameter tidak ditentukan
      const now = new Date();
      const start = rawStart ? new Date(rawStart) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = rawEnd
        ? new Date(rawEnd)
        : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

      const vehicleWhere: any = {};
      if (category) {
        vehicleWhere.category = { equals: category, mode: 'insensitive' };
      }

      const vehicles = await db.vehicle.findMany({
        where: vehicleWhere,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
        include: {
          bookings: {
            where: {
              status: {
                in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
              },
              startDateTime: { lt: end },
              endDateTime: { gt: start },
            },
            orderBy: { startDateTime: 'asc' },
            include: {
              customer: {
                select: {
                  id: true,
                  fullName: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      });

      const fleetData = vehicles.map((v) => ({
        id: v.id,
        externalId: v.externalId,
        name: v.name,
        licensePlate: v.licensePlate,
        brand: v.brand,
        model: v.model,
        category: v.category,
        seatingCapacity: v.seatingCapacity,
        transmission: v.transmission,
        operationalStatus: v.operationalStatus,
        activeBookingsCount: v.bookings.length,
        schedules: v.bookings.map((b) => ({
          bookingId: b.id,
          bookingCode: b.bookingCode,
          customerName: b.customer.fullName,
          customerPhone: b.customer.phoneNumber,
          rentalType: b.rentalType,
          status: b.status,
          startDateTime: b.startDateTime,
          endDateTime: b.endDateTime,
          tariffStatus: b.tariffStatus,
          quotedAmount: b.quotedAmount,
        })),
      }));

      sendSuccess(res, {
        timeRange: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        totalVehicles: vehicles.length,
        fleet: fleetData,
      });
    } catch (error) {
      sendError(res, 'FETCH_FLEET_CALENDAR_ERROR', 'Gagal memuat data kalender armada.', 500);
    }
  }
);
