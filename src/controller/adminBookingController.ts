import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { BookingStatusActor, UserRole, type Prisma } from '../generated/prisma/client.js';
import { bookingModel, type AdminBookingDetail } from '../model/bookingModel.js';
import { AppError, sendSuccess } from '../utils/response.js';
import type {
  adminBookingQuerySchema,
  assignDriverSchema,
  updateBookingStatusSchema,
} from '../validators/bookingSchemas.js';

/**
 * Controller pengelolaan pesanan sisi admin.
 *
 * Menopang layar Antrean Pesanan dan Detail Pemesanan pada dashboard: daftar
 * berpaginasi, detail beserta payload WhatsApp, perubahan status dengan
 * konfirmasi tarif, dan penugasan supir.
 *
 * Aturan bisnis modul ini ada di sini; bentuk query dan transaksinya ada di
 * `bookingModel`. Semua kegagalan diteruskan lewat `next(error)` supaya
 * ditangani satu kali oleh errorHandler global.
 *
 * Aturan penolakan penugasan supir dijaga di sini: supir harus berstatus SIAGA,
 * tidak sedang terikat pesanan lain, jadwalnya tidak bentrok, dan hanya pesanan
 * bertipe WITH_DRIVER yang boleh ditugaskan supir.
 */

/** WhatsApp memakai format internasional tanpa tanda plus, mis. 6281234567890. */
function toInternationalPhone(phone: string): string {
  let cleaned = phone.trim().replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Data minimum yang dibutuhkan draf WhatsApp. Sengaja lebih sempit daripada
 * `AdminBookingDetail` supaya fungsi ini juga bisa dipakai untuk hasil konfirmasi
 * dan penugasan supir, yang tidak membawa riwayat status.
 */
type WhatsAppIntentSource = Pick<
  AdminBookingDetail,
  'bookingCode' | 'status' | 'quotedAmount' | 'startDateTime' | 'endDateTime'
> & {
  customer: Pick<AdminBookingDetail['customer'], 'fullName' | 'phoneNumber'>;
  vehicle: { name: string; licensePlate: string };
};

/** Menyusun draf pesan konfirmasi beserta tautan WhatsApp yang dikirim staf ke pelanggan. */
function buildWhatsAppIntent(booking: WhatsAppIntentSource): { message: string; url: string } {
  const phone = toInternationalPhone(booking.customer.phoneNumber);
  const startStr = booking.startDateTime.toISOString().slice(0, 10);
  const endStr = booking.endDateTime.toISOString().slice(0, 10);
  const tarifStr =
    booking.quotedAmount !== null
      ? `Rp ${Number(booking.quotedAmount).toLocaleString('id-ID')}`
      : 'Menunggu konfirmasi';

  const message =
    `Halo Kak ${booking.customer.fullName},\n` +
    `Konfirmasi pesanan sewa mobil di CV. Mobil Juragan Merauke:\n\n` +
    `• Kode Booking: ${booking.bookingCode}\n` +
    `• Armada: ${booking.vehicle.name} (${booking.vehicle.licensePlate})\n` +
    `• Jadwal Sewa: ${startStr} s.d. ${endStr}\n` +
    `• Status: ${booking.status}\n` +
    `• Tarif Sewa: ${tarifStr}\n\n` +
    `Silakan balas pesan ini jika ada pertanyaan atau penyesuaian jadwal. Terima kasih!`;

  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

  return { message, url };
}

/** Penulis riwayat status memakai peran pelaku, bukan peran tetap. */
function actorOf(role: string): BookingStatusActor {
  return role === UserRole.ADMIN ? BookingStatusActor.ADMIN : BookingStatusActor.STAFF;
}

export const adminBookingController = {
  /**
   * GET /api/v1/admin/bookings
   * Mengambil daftar antrean pemesanan sewa mobil dengan pagination, pencarian, dan filter status.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, search } = req.query as unknown as z.infer<
        typeof adminBookingQuerySchema
      >;

      const whereClause: Prisma.BookingWhereInput = {};

      if (status) {
        whereClause.status = status;
      }

      /* Pencarian menyentuh kode booking, nama pelanggan, dan armada sekaligus,
         karena staf di loket sering menerima salah satu dari ketiganya. */
      if (search && search.trim() !== '') {
        const q = search.trim();
        whereClause.OR = [
          { bookingCode: { contains: q } },
          { customer: { fullName: { contains: q } } },
          { customer: { phoneNumber: { contains: q } } },
          { vehicle: { name: { contains: q } } },
          { vehicle: { licensePlate: { contains: q } } },
        ];
      }

      const totalItems = await bookingModel.countByFilter(whereClause);
      const totalPages = Math.ceil(totalItems / limit) || 1;
      const skip = (page - 1) * limit;

      const bookings = await bookingModel.listPaged({ where: whereClause, skip, take: limit });

      sendSuccess(res, {
        items: bookings,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/bookings/:id
   * Mengambil detail pesanan tertentu beserta histori status dan payload WhatsApp intent.
   */
  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const booking = await bookingModel.findAdminDetail(id);

      if (!booking) {
        throw new AppError('BOOKING_NOT_FOUND', `Pesanan dengan pengenal '${id}' tidak ditemukan.`, 404);
      }

      sendSuccess(res, {
        ...booking,
        whatsappIntent: buildWhatsAppIntent(booking),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/bookings/:id/status
   * Memperbarui status pemesanan, konfirmasi tarif sewa, serta mencatat history dan audit log staf.
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status: nextStatus, quotedAmount, note } = req.body as z.infer<
        typeof updateBookingStatusSchema
      >;
      const staffUser = req.user!;

      const result = await bookingModel.updateStatusWithHistoryAndAudit({
        id,
        nextStatus,
        quotedAmount,
        note: note ?? null,
        actorUserId: staffUser.userId,
        actor: actorOf(staffUser.role),
        actorFullName: staffUser.fullName,
        actorRole: staffUser.role,
      });

      if (result === null) {
        throw new AppError('BOOKING_NOT_FOUND', `Pesanan dengan ID '${id}' tidak ditemukan.`, 404);
      }

      if (result.kind === 'conflict') {
        throw new AppError(
          'BOOKING_CONFLICT',
          `Tidak dapat mengonfirmasi pesanan karena armada '${result.booking.vehicle.name}' telah memiliki jadwal sewa aktif lain pada rentang tanggal tersebut.`,
          409,
        );
      }

      if (result.kind === 'driver_required') {
        throw new AppError(
          'DRIVER_REQUIRED',
          'Booking dengan supir harus punya supir terpilih sebelum bisa dikonfirmasi. Tugaskan supir lebih dulu.',
          409,
        );
      }

      sendSuccess(res, {
        ...result.booking,
        whatsappIntent: buildWhatsAppIntent(result.booking),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/bookings/:id/driver
   * Menugaskan supir ke pesanan sewa bertipe WITH_DRIVER. Dalam satu transaksi:
   * supir diikat ke pesanan, kesiapannya menjadi SEDANG_TUGAS, riwayat dan audit log ditulis.
   */
  async assignDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { driverId, note } = req.body as z.infer<typeof assignDriverSchema>;
      const staffUser = req.user!;

      const result = await bookingModel.assignDriverWithAudit({
        id,
        driverId,
        note: note ?? null,
        actorUserId: staffUser.userId,
        actor: actorOf(staffUser.role),
        actorFullName: staffUser.fullName,
        actorRole: staffUser.role,
      });

      if (result === null) {
        throw new AppError('BOOKING_NOT_FOUND', `Pesanan dengan ID '${id}' tidak ditemukan.`, 404);
      }

      if (result.kind === 'not_with_driver') {
        throw new AppError(
          'BOOKING_NOT_WITH_DRIVER',
          'Pesanan ini bertipe lepas kunci, jadi tidak memakai supir.',
          409,
        );
      }

      if (result.kind === 'not_assignable') {
        throw new AppError(
          'BOOKING_NOT_ASSIGNABLE',
          `Pesanan berstatus ${result.booking.status} sudah tidak bisa ditugaskan ke supir.`,
          409,
        );
      }

      if (result.kind === 'driver_not_found') {
        throw new AppError(
          'DRIVER_NOT_FOUND',
          `Supir dengan pengenal '${driverId}' tidak ditemukan di roster.`,
          404,
        );
      }

      if (result.kind === 'driver_inactive') {
        throw new AppError(
          'DRIVER_INACTIVE',
          `Supir '${result.driver.fullName}' sudah nonaktif.`,
          409,
        );
      }

      if (result.kind === 'driver_not_available') {
        throw new AppError(
          'DRIVER_NOT_AVAILABLE',
          `Supir '${result.driver.fullName}' sedang berstatus LIBUR, ubah kesiapannya lebih dulu.`,
          409,
        );
      }

      if (result.kind === 'driver_already_assigned') {
        throw new AppError(
          'DRIVER_ALREADY_ASSIGNED',
          `Supir '${result.driver.fullName}' sudah terikat pesanan ${result.clashingBooking.bookingCode} pada rentang tanggal yang bertabrakan.`,
          409,
        );
      }

      sendSuccess(res, {
        ...result.booking,
        whatsappIntent: buildWhatsAppIntent(result.booking),
      });
    } catch (error) {
      next(error);
    }
  },
};
