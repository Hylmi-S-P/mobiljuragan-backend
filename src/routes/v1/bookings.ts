import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess, sendError, AppError } from '../../utils/response.js';
import {
  BookingStatus,
  BookingStatusActor,
  OperationalStatus,
  RentalType,
  TariffStatus,
  UserRole,
} from '../../generated/prisma/client.js';

export const bookingRouter: Router = Router();

// Seluruh endpoint booking mewajibkan autentikasi Bearer token
bookingRouter.use(requireAuth);

const createBookingSchema = z
  .object({
    vehicleId: z.string().min(1, 'vehicleId wajib diisi.'),
    startDateTime: z.string().datetime({ message: 'startDateTime harus berformat ISO 8601 (contoh: 2026-10-01T08:00:00Z).' }),
    endDateTime: z.string().datetime({ message: 'endDateTime harus berformat ISO 8601 (contoh: 2026-10-03T18:00:00Z).' }),
    rentalType: z.nativeEnum(RentalType, {
      errorMap: () => ({ message: 'rentalType harus bernilai WITH_DRIVER atau WITHOUT_DRIVER.' }),
    }),
    pickupLocation: z.string().max(255).optional(),
    customerRequest: z.string().max(1000).optional(),
    numberGuests: z.number().int().min(1, 'Minimal jumlah penumpang adalah 1 orang.').max(50).optional(),
  })
  .refine((data) => new Date(data.endDateTime) > new Date(data.startDateTime), {
    message: 'endDateTime harus lebih besar dari startDateTime.',
    path: ['endDateTime'],
  });

function generateBookingCode(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MJ-${dateStr}-${randomStr}`;
}

/**
 * POST /api/v1/bookings
 * Membuat pemesanan sewa mobil baru dengan transaksi atomik dan pencatatan riwayat status awal.
 */
bookingRouter.post('/', validateBody(createBookingSchema), async (req: Request, res: Response) => {
  try {
    const {
      vehicleId,
      startDateTime,
      endDateTime,
      rentalType,
      pickupLocation,
      customerRequest,
      numberGuests,
    } = req.body;

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const customerId = req.user!.userId;

    const result = await db.$transaction(async (tx) => {
      // 1. Verifikasi ketersediaan armada mobil
      const vehicle = await tx.vehicle.findFirst({
        where: {
          OR: [{ id: vehicleId }, { externalId: vehicleId }],
        },
      });

      if (!vehicle) {
        throw new AppError('VEHICLE_NOT_FOUND', `Armada dengan pengenal '${vehicleId}' tidak ditemukan.`, 404);
      }

      if (vehicle.operationalStatus !== OperationalStatus.AVAILABLE) {
        throw new AppError(
          'BOOKING_VEHICLE_UNAVAILABLE',
          `Armada '${vehicle.name}' sedang dalam status operasional ${vehicle.operationalStatus} dan tidak dapat disewa.`,
          409
        );
      }

      // 2. Cek bentrok jadwal sewa dengan booking aktif (CONFIRMED / IN_PROGRESS)
      const conflictingBooking = await tx.booking.findFirst({
        where: {
          vehicleId: vehicle.id,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
          startDateTime: { lt: end },
          endDateTime: { gt: start },
        },
      });

      if (conflictingBooking) {
        throw new AppError(
          'BOOKING_VEHICLE_UNAVAILABLE',
          `Armada '${vehicle.name}' sudah terpesan pada jadwal tersebut. Silakan pilih armada lain atau sesuaikan tanggal sewa.`,
          409
        );
      }

      // 3. Buat kode booking unik
      let bookingCode = generateBookingCode();
      let isDuplicate = await tx.booking.findUnique({ where: { bookingCode } });
      while (isDuplicate) {
        bookingCode = generateBookingCode();
        isDuplicate = await tx.booking.findUnique({ where: { bookingCode } });
      }

      // 4. Buat entitas booking (tarif tetap null sesuai aturan konfirmasi admin)
      const booking = await tx.booking.create({
        data: {
          bookingCode,
          customerId,
          vehicleId: vehicle.id,
          startDateTime: start,
          endDateTime: end,
          rentalType,
          pickupLocation: pickupLocation || null,
          customerRequest: customerRequest || null,
          numberGuests: numberGuests || null,
          tariffStatus: TariffStatus.PENDING_TEAM_CONFIRMATION,
          quotedAmount: null,
          status: BookingStatus.CREATED,
        },
        include: {
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
        },
      });

      // 5. Catat riwayat status awal
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: BookingStatus.CREATED,
          actor: BookingStatusActor.CUSTOMER,
          actorUserId: customerId,
          note: 'Pemesanan sewa dibuat oleh pelanggan. Menunggu konfirmasi tarif dan armada oleh tim.',
        },
      });

      return booking;
    });

    sendSuccess(res, result, 201);
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }
    sendError(res, 'CREATE_BOOKING_ERROR', 'Gagal memproses pesanan sewa mobil.', 500);
  }
});

/**
 * GET /api/v1/bookings
 * Mengambil daftar seluruh pemesanan milik customer yang sedang login.
 */
bookingRouter.get('/', async (req: Request, res: Response) => {
  try {
    const customerId = req.user!.userId;
    const isStaffOrAdmin = req.user!.role === UserRole.STAFF || req.user!.role === UserRole.ADMIN;

    const bookings = await db.booking.findMany({
      where: isStaffOrAdmin ? {} : { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
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

    sendSuccess(res, bookings);
  } catch (error) {
    sendError(res, 'FETCH_BOOKINGS_ERROR', 'Gagal mengambil riwayat pesanan sewa.', 500);
  }
});

/**
 * GET /api/v1/bookings/:id/status
 * Melacak timeline dan status terkini pemesanan sewa mobil.
 */
bookingRouter.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.userId;
    const isStaffOrAdmin = req.user!.role === UserRole.STAFF || req.user!.role === UserRole.ADMIN;

    const booking = await db.booking.findFirst({
      where: {
        OR: [{ id }, { bookingCode: id }],
        ...(isStaffOrAdmin ? {} : { customerId }),
      },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        tariffStatus: true,
        quotedAmount: true,
        startDateTime: true,
        endDateTime: true,
        createdAt: true,
        statusHistory: {
          orderBy: { changedAt: 'asc' },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            actor: true,
            note: true,
            changedAt: true,
          },
        },
      },
    });

    if (!booking) {
      sendError(res, 'BOOKING_NOT_FOUND', `Pesanan dengan pengenal '${id}' tidak ditemukan.`, 404);
      return;
    }

    sendSuccess(res, booking);
  } catch (error) {
    sendError(res, 'FETCH_BOOKING_STATUS_ERROR', 'Gagal memuat status pesanan sewa.', 500);
  }
});

/**
 * GET /api/v1/bookings/:id
 * Mengambil detail lengkap pemesanan sewa mobil.
 */
bookingRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.userId;
    const isStaffOrAdmin = req.user!.role === UserRole.STAFF || req.user!.role === UserRole.ADMIN;

    const booking = await db.booking.findFirst({
      where: {
        OR: [{ id }, { bookingCode: id }],
        ...(isStaffOrAdmin ? {} : { customerId }),
      },
      include: {
        vehicle: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
    });

    if (!booking) {
      sendError(res, 'BOOKING_NOT_FOUND', `Pesanan dengan pengenal '${id}' tidak ditemukan.`, 404);
      return;
    }

    sendSuccess(res, booking);
  } catch (error) {
    sendError(res, 'FETCH_BOOKING_DETAIL_ERROR', 'Gagal memuat detail pesanan sewa.', 500);
  }
});
