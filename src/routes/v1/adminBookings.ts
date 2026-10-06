import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { sendSuccess, sendError, AppError } from '../../utils/response.js';
import {
  BookingStatus,
  BookingStatusActor,
  DriverReadiness,
  RentalType,
  TariffStatus,
  UserRole,
} from '../../generated/prisma/client.js';

export const adminBookingRouter: Router = Router();

// Seluruh endpoint admin booking dibatasi khusus role STAFF dan ADMIN
adminBookingRouter.use(requireAuth);
adminBookingRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

const adminBookingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(BookingStatus).optional(),
  search: z.string().optional(),
});

const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus, {
    errorMap: () => ({ message: 'Status sewa tidak valid.' }),
  }),
  quotedAmount: z.number().nonnegative('Tarif sewa tidak boleh bernilai negatif.').optional(),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

const assignDriverSchema = z.object({
  driverId: z
    .string()
    .trim()
    .min(1, 'driverId wajib diisi, boleh uuid supir atau externalId seperti markus-gebze.'),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

/** Status booking yang dianggap sudah selesai, sehingga supirnya dilepas kembali. */
const CLOSED_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.REJECTED,
];

function toInternationalPhone(phone: string): string {
  let cleaned = phone.trim().replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

function buildWhatsAppIntent(booking: {
  bookingCode: string;
  status: string;
  quotedAmount: any;
  startDateTime: Date;
  endDateTime: Date;
  customer: { fullName: string; phoneNumber: string };
  vehicle: { name: string; licensePlate: string };
}): { message: string; url: string } {
  const phone = toInternationalPhone(booking.customer.phoneNumber);
  const startStr = booking.startDateTime.toISOString().slice(0, 10);
  const endStr = booking.endDateTime.toISOString().slice(0, 10);
  const tarifStr =
    booking.quotedAmount !== null && booking.quotedAmount !== undefined
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

/**
 * GET /api/v1/admin/bookings
 * Mengambil daftar antrean pemesanan sewa mobil dengan pagination, pencarian, dan filter status.
 */
adminBookingRouter.get(
  '/',
  validateQuery(adminBookingQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { page, limit, status, search } = req.query as unknown as {
        page: number;
        limit: number;
        status?: BookingStatus;
        search?: string;
      };

      const whereClause: any = {};

      if (status) {
        whereClause.status = status;
      }

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

      const totalItems = await db.booking.count({ where: whereClause });
      const totalPages = Math.ceil(totalItems / limit) || 1;
      const skip = (page - 1) * limit;

      const bookings = await db.booking.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              externalId: true,
              name: true,
              licensePlate: true,
              category: true,
              seatingCapacity: true,
              transmission: true,
            },
          },
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1,
          },
        },
      });

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
      sendError(res, 'FETCH_ADMIN_BOOKINGS_ERROR', 'Gagal memuat daftar pesanan admin.', 500);
    }
  }
);

/**
 * GET /api/v1/admin/bookings/:id
 * Mengambil detail pesanan tertentu beserta histori status dan payload WhatsApp intent.
 */
adminBookingRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await db.booking.findFirst({
      where: {
        OR: [{ id }, { bookingCode: id }],
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            role: true,
          },
        },
        vehicle: true,
        statusHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
    });

    if (!booking) {
      sendError(res, 'BOOKING_NOT_FOUND', `Pesanan dengan pengenal '${id}' tidak ditemukan.`, 404);
      return;
    }

    const whatsappIntent = buildWhatsAppIntent(booking);

    sendSuccess(res, {
      ...booking,
      whatsappIntent,
    });
  } catch (error) {
    sendError(res, 'FETCH_ADMIN_BOOKING_DETAIL_ERROR', 'Gagal memuat detail pesanan admin.', 500);
  }
});

/**
 * PATCH /api/v1/admin/bookings/:id/status
 * Memperbarui status pemesanan, konfirmasi tarif sewa, serta mencatat history dan audit log staf.
 */
adminBookingRouter.patch(
  '/:id/status',
  validateBody(updateBookingStatusSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status: nextStatus, quotedAmount, note } = req.body;
      const staffUser = req.user!;

      const result = await db.$transaction(async (tx) => {
        // 1. Temukan pesanan
        const booking = await tx.booking.findFirst({
          where: {
            OR: [{ id }, { bookingCode: id }],
          },
          include: {
            vehicle: true,
            customer: true,
          },
        });

        if (!booking) {
          throw new AppError('BOOKING_NOT_FOUND', `Pesanan dengan ID '${id}' tidak ditemukan.`, 404);
        }

        // 2. Jika status diubah menjadi CONFIRMED, pastikan tidak ada bentrok booking lain
        if (nextStatus === BookingStatus.CONFIRMED) {
          const conflictingBooking = await tx.booking.findFirst({
            where: {
              id: { not: booking.id },
              vehicleId: booking.vehicleId,
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
              startDateTime: { lt: booking.endDateTime },
              endDateTime: { gt: booking.startDateTime },
            },
          });

          if (conflictingBooking) {
            throw new AppError(
              'BOOKING_CONFLICT',
              `Tidak dapat mengonfirmasi pesanan karena armada '${booking.vehicle.name}' telah memiliki jadwal sewa aktif lain pada rentang tanggal tersebut.`,
              409
            );
          }
        }

        /* Booking dengan supir wajib punya supir terpilih sebelum dikonfirmasi (butir B8). */
        if (
          nextStatus === BookingStatus.CONFIRMED &&
          booking.rentalType === RentalType.WITH_DRIVER &&
          !booking.driverId
        ) {
          throw new AppError(
            'DRIVER_REQUIRED',
            'Booking dengan supir harus punya supir terpilih sebelum bisa dikonfirmasi. Tugaskan supir lebih dulu.',
            409
          );
        }

        // 3. Tentukan pembaruan tarif sewa
        const updateData: any = {
          status: nextStatus,
        };

        if (quotedAmount !== undefined) {
          updateData.quotedAmount = quotedAmount;
          updateData.tariffStatus = TariffStatus.CONFIRMED;
        }

        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: updateData,
          include: {
            vehicle: true,
            customer: true,
          },
        });

        // 4. Catat riwayat status sewa
        const actor =
          staffUser.role === UserRole.ADMIN ? BookingStatusActor.ADMIN : BookingStatusActor.STAFF;

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: nextStatus,
            actor,
            actorUserId: staffUser.userId,
            note:
              note ||
              `Status pesanan diperbarui oleh ${staffUser.fullName} (${staffUser.role}) menjadi ${nextStatus}.`,
          },
        });

        // 5. Catat audit log aktivitas staf
        await tx.auditLog.create({
          data: {
            actorId: staffUser.userId,
            action: 'UPDATE_BOOKING_STATUS',
            entityType: 'Booking',
            entityId: booking.id,
            metadata: {
              bookingCode: booking.bookingCode,
              fromStatus: booking.status,
              toStatus: nextStatus,
              quotedAmount: quotedAmount ?? booking.quotedAmount,
              note: note || null,
            },
          },
        });

        /* Supir dilepas kembali ke SIAGA saat pesanan selesai, batal, atau ditolak (butir E4). */
        if (booking.driverId && CLOSED_BOOKING_STATUSES.includes(nextStatus)) {
          const otherActiveBooking = await tx.booking.count({
            where: {
              driverId: booking.driverId,
              id: { not: booking.id },
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
            },
          });

          if (otherActiveBooking === 0) {
            await tx.driver.update({
              where: { id: booking.driverId },
              data: { readiness: DriverReadiness.SIAGA },
            });
          }
        }

        return updatedBooking;
      });

      const whatsappIntent = buildWhatsAppIntent(result);

      sendSuccess(res, {
        ...result,
        whatsappIntent,
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.code, error.message, error.statusCode);
        return;
      }
      sendError(res, 'UPDATE_BOOKING_STATUS_ERROR', 'Gagal memperbarui status pesanan sewa.', 500);
    }
  }
);

/**
 * PATCH /api/v1/admin/bookings/:id/driver
 * Menugaskan supir ke pesanan sewa bertipe WITH_DRIVER. Dalam satu transaksi:
 * supir diikat ke pesanan, kesiapannya menjadi SEDANG_TUGAS, riwayat dan audit log ditulis.
 * Aturan penolakannya mengikuti daftar cara gagal modul supir pada
 * `docs(discontinueid)/DRIVER-MODULE-FAILURE-MODES.md` butir B3 sampai B7.
 */
adminBookingRouter.patch(
  '/:id/driver',
  validateBody(assignDriverSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { driverId, note } = req.body as z.infer<typeof assignDriverSchema>;
      const staffUser = req.user!;

      const result = await db.$transaction(async (tx) => {
        const booking = await tx.booking.findFirst({
          where: { OR: [{ id }, { bookingCode: id }] },
          include: { vehicle: true, customer: true },
        });

        if (!booking) {
          throw new AppError('BOOKING_NOT_FOUND', `Pesanan dengan ID '${id}' tidak ditemukan.`, 404);
        }
        if (booking.rentalType !== RentalType.WITH_DRIVER) {
          throw new AppError(
            'BOOKING_NOT_WITH_DRIVER',
            'Pesanan ini bertipe lepas kunci, jadi tidak memakai supir.',
            409
          );
        }
        if (CLOSED_BOOKING_STATUSES.includes(booking.status)) {
          throw new AppError(
            'BOOKING_NOT_ASSIGNABLE',
            `Pesanan berstatus ${booking.status} sudah tidak bisa ditugaskan ke supir.`,
            409
          );
        }

        const driver = await tx.driver.findFirst({
          where: { OR: [{ id: driverId }, { externalId: driverId }] },
        });

        if (!driver) {
          throw new AppError('DRIVER_NOT_FOUND', `Supir dengan pengenal '${driverId}' tidak ditemukan di roster.`, 404);
        }
        if (!driver.isActive) {
          throw new AppError('DRIVER_INACTIVE', `Supir '${driver.fullName}' sudah nonaktif.`, 409);
        }
        if (driver.readiness === DriverReadiness.LIBUR) {
          throw new AppError(
            'DRIVER_NOT_AVAILABLE',
            `Supir '${driver.fullName}' sedang berstatus LIBUR, ubah kesiapannya lebih dulu.`,
            409
          );
        }

        const clashingBooking = await tx.booking.findFirst({
          where: {
            id: { not: booking.id },
            driverId: driver.id,
            /* Termasuk pesanan yang masih menunggu konfirmasi, karena penugasan supir
               sudah direncanakan sejak saat itu (butir B5). */
            status: { notIn: CLOSED_BOOKING_STATUSES },
            startDateTime: { lt: booking.endDateTime },
            endDateTime: { gt: booking.startDateTime },
          },
          select: { bookingCode: true, status: true },
        });

        if (clashingBooking) {
          throw new AppError(
            'DRIVER_ALREADY_ASSIGNED',
            `Supir '${driver.fullName}' sudah terikat pesanan ${clashingBooking.bookingCode} pada rentang tanggal yang bertabrakan.`,
            409
          );
        }

        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { driverId: driver.id },
          include: { vehicle: true, customer: true, driver: true },
        });

        await tx.driver.update({
          where: { id: driver.id },
          data: { readiness: DriverReadiness.SEDANG_TUGAS },
        });

        const actor =
          staffUser.role === UserRole.ADMIN ? BookingStatusActor.ADMIN : BookingStatusActor.STAFF;

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: booking.status,
            actor,
            actorUserId: staffUser.userId,
            note:
              note ||
              `Supir ${driver.fullName} ditugaskan oleh ${staffUser.fullName} (${staffUser.role}).`,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: staffUser.userId,
            action: 'ASSIGN_DRIVER',
            entityType: 'Booking',
            entityId: booking.id,
            metadata: {
              bookingCode: booking.bookingCode,
              driverId: driver.id,
              driverExternalId: driver.externalId,
              driverName: driver.fullName,
              note: note || null,
            },
          },
        });

        return updatedBooking;
      });

      sendSuccess(res, {
        ...result,
        whatsappIntent: buildWhatsAppIntent(result),
      });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.code, error.message, error.statusCode);
        return;
      }
      sendError(res, 'ASSIGN_DRIVER_ERROR', 'Gagal menugaskan supir ke pesanan.', 500);
    }
  }
);
