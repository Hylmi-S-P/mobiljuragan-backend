import type { NextFunction, Request, Response } from 'express';
import { fleetModel } from '../model/fleetModel.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Controller kalender armada.
 *
 * Semua kegagalan diteruskan lewat `next(error)` supaya ditangani satu kali oleh
 * errorHandler global.
 */
export const adminFleetController = {
  /**
   * GET /api/v1/admin/fleet/calendar
   * Mengambil matriks jadwal pemesanan sewa 9 armada untuk tampilan visual timeline / kalender admin.
   */
  async calendar(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const vehicles = await fleetModel.listVehiclesWithSchedules({ category, start, end });

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
      next(error);
    }
  },
};
