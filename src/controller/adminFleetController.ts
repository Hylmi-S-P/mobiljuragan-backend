import type { NextFunction, Request, Response } from 'express';
import { fleetModel } from '../model/fleetModel.js';
import { getDriverDailyRate, simpanDriverDailyRate } from '../lib/tariff.js';
import { sendSuccess } from '../lib/response.js';

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
      const {
        startDate: rawStart,
        endDate: rawEnd,
        category,
      } = req.query as {
        startDate?: string;
        endDate?: string;
        category?: string;
      };

      // Default rentang waktu: 30 hari ke depan jika parameter tidak ditentukan
      const now = new Date();
      const start = rawStart
        ? new Date(rawStart)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = rawEnd ? new Date(rawEnd) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

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

  /**
   * GET /api/v1/admin/fleet/rented
   *
   * Daftar id unit yang sedang disewa saat ini. Dipakai katalog armada untuk
   * badge "Disewa".
   *
   * Kenapa endpoint terpisah, bukan menambah field di GET /admin/vehicles:
   * katalog hanya butuh himpunan id, sedangkan endpoint kendaraan dipakai juga
   * oleh formulir dan modul lain yang tidak peduli jadwal sewa. Menambah query
   * booking di sana berarti setiap pemanggil ikut menanggung biayanya.
   *
   * Sengaja mengembalikan array id, bukan objek peta, supaya bentuknya sederhana
   * dan mudah dipakai lintas bahasa (web dan mobile).
   */
  async rented(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ids = await fleetModel.vehicleIdsRentedAt(new Date());
      sendSuccess(res, { vehicleIds: [...ids] });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/fleet/tariff-settings
   *
   * Tarif jasa supir global. Dashboard membutuhkannya untuk menampilkan
   * perkiraan tarif pesanan bersupir sebelum admin mengonfirmasi, karena angka
   * finalnya dihitung server dari harga katalog ditambah tarif ini.
   */
  async getTariffSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const driverDailyRate = await getDriverDailyRate();
      sendSuccess(res, { driverDailyRate });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/fleet/tariff-settings
   *
   * Mengubah tarif jasa supir global. Hanya ADMIN: angka ini berlaku untuk semua
   * pesanan baru, jadi bukan keputusan operasional harian staf.
   */
  async updateTariffSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { driverDailyRate } = req.body as { driverDailyRate: number };
      const tersimpan = await simpanDriverDailyRate(driverDailyRate);
      sendSuccess(res, { driverDailyRate: tersimpan });
    } catch (error) {
      next(error);
    }
  },
};
