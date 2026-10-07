import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { bookingModel } from '../model/bookingModel.js';
import { OperationalStatus, UserRole } from '../generated/prisma/client.js';
import { AppError, sendSuccess } from '../utils/response.js';
import type { createBookingSchema } from '../validators/bookingSchemas.js';

/**
 * Controller pemesanan sewa sisi pelanggan.
 *
 * Menopang alur pemesanan di aplikasi mobile: membuat pesanan, melihat riwayat,
 * melacak timeline status, dan membuka detail pesanan. Aturan bisnis modul ini
 * ada di sini; bentuk query ada di `bookingModel`.
 *
 * Semua kegagalan diteruskan lewat `next(error)` supaya ditangani satu kali oleh
 * errorHandler global, yang sudah menerjemahkan AppError menjadi respons error
 * standar `{ error: { code, message, details } }`.
 */

/** Kode booking berformat MJ-YYYYMMDD-XXXX, acak supaya tidak mudah ditebak pelanggan lain. */
function generateBookingCode(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MJ-${dateStr}-${randomStr}`;
}

export const bookingController = {
  /**
   * POST /api/v1/bookings
   * Membuat pemesanan sewa mobil baru dengan transaksi atomik dan pencatatan riwayat status awal.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as z.infer<typeof createBookingSchema>;
      const customerId = req.user!.userId;

      const start = new Date(payload.startDateTime);
      const end = new Date(payload.endDateTime);

      const vehicle = await bookingModel.findVehicleByIdOrExternalId(payload.vehicleId);

      if (!vehicle) {
        throw new AppError(
          'VEHICLE_NOT_FOUND',
          `Armada dengan pengenal '${payload.vehicleId}' tidak ditemukan.`,
          404,
        );
      }

      if (vehicle.operationalStatus !== OperationalStatus.AVAILABLE) {
        throw new AppError(
          'BOOKING_VEHICLE_UNAVAILABLE',
          `Armada '${vehicle.name}' sedang dalam status operasional ${vehicle.operationalStatus} dan tidak dapat disewa.`,
          409,
        );
      }

      // Hanya pesanan berstatus aktif yang dihitung bentrok jadwal.
      const conflictingBooking = await bookingModel.findVehicleScheduleConflict(
        vehicle.id,
        start,
        end,
      );

      if (conflictingBooking) {
        throw new AppError(
          'BOOKING_VEHICLE_UNAVAILABLE',
          `Armada '${vehicle.name}' sudah terpesan pada jadwal tersebut. Silakan pilih armada lain atau sesuaikan tanggal sewa.`,
          409,
        );
      }

      let bookingCode = generateBookingCode();
      let isDuplicate = await bookingModel.findByBookingCode(bookingCode);
      while (isDuplicate) {
        bookingCode = generateBookingCode();
        isDuplicate = await bookingModel.findByBookingCode(bookingCode);
      }

      // Pesanan dan riwayat status awalnya disimpan dalam satu transaksi.
      const booking = await bookingModel.createWithHistory({
        bookingCode,
        customerId,
        vehicleId: vehicle.id,
        start,
        end,
        rentalType: payload.rentalType,
        pickupLocation: payload.pickupLocation || null,
        customerRequest: payload.customerRequest || null,
        numberGuests: payload.numberGuests || null,
      });

      sendSuccess(res, booking, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/bookings
   * Mengambil daftar seluruh pemesanan milik customer yang sedang login.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user!;
      const isStaffOrAdmin = actor.role === UserRole.STAFF || actor.role === UserRole.ADMIN;

      const bookings = await bookingModel.listForActor({
        customerId: actor.userId,
        isStaffOrAdmin,
      });

      sendSuccess(res, bookings);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/bookings/:id/status
   * Melacak timeline dan status terkini pemesanan sewa mobil.
   * `:id` boleh uuid atau kode booking, karena pelanggan memegang kodenya.
   */
  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const actor = req.user!;
      const isStaffOrAdmin = actor.role === UserRole.STAFF || actor.role === UserRole.ADMIN;

      const booking = await bookingModel.findStatusTimeline({
        id,
        customerId: actor.userId,
        isStaffOrAdmin,
      });

      if (!booking) {
        throw new AppError(
          'BOOKING_NOT_FOUND',
          `Pesanan dengan pengenal '${id}' tidak ditemukan.`,
          404,
        );
      }

      sendSuccess(res, booking);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/bookings/:id
   * Mengambil detail lengkap pemesanan sewa mobil. Pelanggan hanya boleh membuka
   * pesanannya sendiri; staf dan admin boleh membuka pesanan siapa pun.
   */
  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const actor = req.user!;
      const isStaffOrAdmin = actor.role === UserRole.STAFF || actor.role === UserRole.ADMIN;

      const booking = await bookingModel.findCustomerDetail({
        id,
        customerId: actor.userId,
        isStaffOrAdmin,
      });

      if (!booking) {
        throw new AppError(
          'BOOKING_NOT_FOUND',
          `Pesanan dengan pengenal '${id}' tidak ditemukan.`,
          404,
        );
      }

      sendSuccess(res, booking);
    } catch (error) {
      next(error);
    }
  },
};
