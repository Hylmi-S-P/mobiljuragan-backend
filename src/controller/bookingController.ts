import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { db } from '../db.js';
import { bookingModel } from '../model/bookingModel.js';
import { refundModel } from '../model/refundModel.js';
import { BookingStatus, BookingStatusActor, OperationalStatus, RefundStatus, UserRole } from '../generated/prisma/client.js';
import { AppError, sendSuccess } from '../lib/response.js';
import { generateBookingCode } from '../lib/bookingCode.js';
import { deskripsikanTenggat } from '../lib/documentDeadline.js';
import { computeBookingBlockers, MAKS_PESANAN_AKTIF_PER_NOMOR, resolveBookingSubStage } from '../lib/bookingStage.js';
import { segarkanTautanMedia } from '../lib/mediaService.js';
import { normalkanRefund } from '../lib/refund.js';
import { toClientDocument } from '../services/document.service.js';
import type { createBookingSchema, customerCancelBookingSchema, updateRefundAccountSchema } from '../validators/bookingSchemas.js';

/**
 * Menyeragamkan kontrak respons booking sisi pelanggan:
 * - konversi nilai Decimal (`quotedAmount`, `finalAmount`, `refund`) menjadi angka bulat `number`
 * - tanda tangan ulang tautan dokumen & bukti transfer (`segarkanTautanMedia`)
 * - penguraian `rejectionTargets` dokumen (`toClientDocument`)
 * - penyertaan `blockers` dan `deadline`
 */
async function formatCustomerBooking<
  T extends {
    status: BookingStatus;
    rentalType: any;
    tariffStatus: any;
    quotedAmount: { toString(): string } | number | null;
    finalAmount?: { toString(): string } | number | null;
    documentDeadlineState: any;
    documentDeadlineAt: Date | null;
    document?: {
      status: any;
      statementLetterUrl?: string | null;
      ktpUrl?: string | null;
      simUrl?: string | null;
      rejectionReason?: string | null;
      rejectionTargets?: string | null;
    } | null;
    payment?: {
      status: any;
      proofImageUrl?: string | null;
    } | null;
    refund?: {
      totalDibayar: unknown;
      potongan: unknown;
      nominal: unknown;
    } | null;
    vehicle?: {
      operationalStatus?: any;
    } | null;
  },
>(booking: T) {
  const document = booking.document
    ? toClientDocument({
        ...booking.document,
        statementLetterUrl: await segarkanTautanMedia(booking.document.statementLetterUrl),
        ktpUrl: await segarkanTautanMedia(booking.document.ktpUrl),
        simUrl: await segarkanTautanMedia(booking.document.simUrl),
      })
    : (booking.document ?? null);

  const payment = booking.payment
    ? {
        ...booking.payment,
        proofImageUrl: await segarkanTautanMedia(booking.payment.proofImageUrl),
      }
    : (booking.payment ?? null);

  const quotedAmount =
    booking.quotedAmount !== null && booking.quotedAmount !== undefined
      ? Math.round(Number(booking.quotedAmount))
      : null;

  const finalAmount =
    booking.finalAmount !== null && booking.finalAmount !== undefined
      ? Math.round(Number(booking.finalAmount))
      : null;

  return {
    ...booking,
    subStage: resolveBookingSubStage(booking.status, booking.payment?.status),
    quotedAmount,
    finalAmount,
    document,
    payment,
    refund: normalkanRefund(booking.refund),
    blockers: computeBookingBlockers({
      status: booking.status,
      rentalType: booking.rentalType,
      tariffStatus: booking.tariffStatus,
      quotedAmount: booking.quotedAmount !== null ? String(booking.quotedAmount) : null,
      document: booking.document ?? null,
      payment: booking.payment ?? null,
      vehicle:
        booking.vehicle && booking.vehicle.operationalStatus
          ? { operationalStatus: booking.vehicle.operationalStatus }
          : null,
    }),
    deadline: deskripsikanTenggat({
      state: booking.documentDeadlineState,
      deadlineAt: booking.documentDeadlineAt,
    }),
  };
}

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

/** Kode booking dibentuk di `src/lib/bookingCode.ts` (tanggal Merauke + acak kuat). */

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

      /* Satu nomor hanya boleh memegang sejumlah pesanan hidup. Setiap pesanan
         hidup menahan satu unit armada dari katalog, jadi nomor yang menumpuk
         pesanan tanpa membayar bisa mengosongkan katalog untuk pelanggan lain. */
      const pesananAktif = await bookingModel.countActiveBookingsByPhone(
        req.user!.phoneNumber,
      );
      if (pesananAktif >= MAKS_PESANAN_AKTIF_PER_NOMOR) {
        throw new AppError(
          'BOOKING_ACTIVE_LIMIT_REACHED',
          `Nomor ini sudah memegang ${pesananAktif} pesanan yang belum selesai. Selesaikan atau batalkan salah satunya dulu sebelum memesan lagi (maksimal ${MAKS_PESANAN_AKTIF_PER_NOMOR} pesanan aktif).`,
          409,
        );
      }

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

      sendSuccess(res, await formatCustomerBooking(booking), 201);
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

      const formatted = await Promise.all(bookings.map((b) => formatCustomerBooking(b)));

      sendSuccess(res, formatted);
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

      sendSuccess(res, {
        ...booking,
        quotedAmount:
          booking.quotedAmount !== null && booking.quotedAmount !== undefined
            ? Math.round(Number(booking.quotedAmount))
            : null,
        deadline: deskripsikanTenggat({
          state: booking.documentDeadlineState,
          deadlineAt: booking.documentDeadlineAt,
        }),
      });
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

      sendSuccess(res, await formatCustomerBooking(booking));
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/bookings/:id/cancel
   * Membatalkan pemesanan sewa sisi pelanggan.
   */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason, refundAccount } = (req.body ?? {}) as z.infer<typeof customerCancelBookingSchema>;
      const customer = req.user!;
      const isStaffOrAdmin = customer.role === UserRole.STAFF || customer.role === UserRole.ADMIN;

      const booking = await bookingModel.findCustomerDetail({
        id,
        customerId: customer.userId,
        isStaffOrAdmin,
      });

      if (!booking) {
        throw new AppError(
          'BOOKING_NOT_FOUND',
          `Pesanan dengan pengenal '${id}' tidak ditemukan.`,
          404,
        );
      }

      if (booking.status === BookingStatus.CANCELLED) {
        sendSuccess(res, {
          message: 'Pesanan sudah dalam status dibatalkan.',
          booking: await formatCustomerBooking(booking),
        });
        return;
      }

      if (booking.status === BookingStatus.COMPLETED) {
        throw new AppError(
          'BOOKING_CANNOT_BE_CANCELLED',
          'Pesanan yang sudah selesai tidak dapat dibatalkan.',
          400,
        );
      }

      /* Pesanan yang sudah ditolak tidak punya tahap untuk dibatalkan, dan sewa
         yang sedang berjalan hanya boleh dihentikan lewat admin (penyelesaian
         dini, penagihan overtime, dsb.). */
      if (booking.status === BookingStatus.REJECTED) {
        throw new AppError(
          'BOOKING_ALREADY_REJECTED',
          'Pesanan ini sudah ditolak, tidak ada yang perlu dibatalkan.',
          409,
        );
      }

      if (booking.status === BookingStatus.IN_PROGRESS) {
        throw new AppError(
          'BOOKING_IN_PROGRESS',
          'Sewa sedang berjalan. Hubungi admin MobilJuragan untuk penghentian lebih awal.',
          409,
        );
      }

      const noteText = reason?.trim() ? `Dibatalkan oleh pemesan: ${reason.trim()}` : 'Dibatalkan oleh pemesan.';

      const result = await bookingModel.updateStatusWithHistoryAndAudit({
        id: booking.id,
        nextStatus: BookingStatus.CANCELLED,
        note: noteText,
        actorUserId: customer.userId,
        actor: BookingStatusActor.CUSTOMER,
        actorFullName: customer.fullName,
        actorRole: customer.role,
        refundAccount,
      });

      if (!result) {
        throw new AppError(
          'BOOKING_NOT_FOUND',
          `Pesanan dengan ID '${id}' tidak ditemukan saat memperbarui status.`,
          404,
        );
      }

      sendSuccess(res, {
        message: 'Pesanan berhasil dibatalkan.',
        booking: await formatCustomerBooking(result.booking),
      });
    } catch (error) {
      next(error);
    }
  },
  /**
   * PATCH /api/v1/bookings/:id/refund-account
   * Pelanggan melengkapi rekening tujuan pengembalian dana setelah membatalkan.
   */
  async claimRefundAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { refundAccount } = (req.body ?? {}) as z.infer<typeof updateRefundAccountSchema>;
      const customer = req.user!;
      const isStaffOrAdmin = customer.role === UserRole.STAFF || customer.role === UserRole.ADMIN;

      const booking = await bookingModel.findCustomerDetail({
        id,
        customerId: customer.userId,
        isStaffOrAdmin,
      });

      if (!booking) {
        throw new AppError(
          'BOOKING_NOT_FOUND',
          `Pesanan dengan pengenal '${id}' tidak ditemukan.`,
          404,
        );
      }

      if (!booking.refund) {
        throw new AppError(
          'REFUND_NOT_FOUND',
          'Pesanan ini tidak punya pengembalian dana yang perlu diklaim.',
          404,
        );
      }

      if (booking.refund.status === RefundStatus.SELESAI) {
        throw new AppError(
          'REFUND_ALREADY_SETTLED',
          'Pengembalian dana pesanan ini sudah ditransfer kantor.',
          409,
        );
      }

      const shouldMoveToDiproses =
        booking.refund.danaTerverifikasi === true &&
        booking.refund.status === RefundStatus.MENUNGGU;

      const updated = await refundModel.update(booking.refund.id, {
        namaBank: refundAccount.bankName,
        nomorRekening: refundAccount.accountNumber,
        namaPemilik: refundAccount.accountHolderName,
        ...(shouldMoveToDiproses ? { status: RefundStatus.DIPROSES } : {}),
      });

      await db.auditLog.create({
        data: {
          actorId: customer.userId,
          action: 'CLAIM_REFUND_ACCOUNT',
          entityType: 'BookingRefund',
          entityId: booking.refund.id,
          metadata: {
            bookingCode: updated.booking.bookingCode,
            namaBank: refundAccount.bankName,
            nomorRekening: refundAccount.accountNumber,
            namaPemilik: refundAccount.accountHolderName,
            previousStatus: booking.refund.status,
            newStatus: updated.status,
          },
        },
      });

      sendSuccess(res, {
        message: 'Rekening tujuan pengembalian dana tersimpan.',
        refund: normalkanRefund(updated),
      });
    } catch (error) {
      next(error);
    }
  },
};
