import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { sendSuccess, sendError, AppError } from '../../utils/response.js';
import {
  BookingStatus,
  DriverReadiness,
  DriverRoute,
  UserRole,
} from '../../generated/prisma/client.js';

/**
 * Roster supir resmi MobilJuragan Merauke.
 * Menopang layar Manajemen Supir (07), modal M4 dan M5, serta pemilihan supir di
 * Detail Pemesanan (04B) pada dashboard.
 *
 * Daftar lengkap cara modul ini bisa gagal ada di `docs(discontinueid)/DRIVER-MODULE-FAILURE-MODES.md`
 * pada root workspace, di luar repo ini,
 * dan setiap butirnya diuji lewat E2E di `.verify/e2e/api-e2e.ts` pada root workspace.
 */
export const adminDriverRouter: Router = Router();

adminDriverRouter.use(requireAuth);
adminDriverRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

/** Status booking yang membuat supir terkunci dan tidak boleh ditugaskan ganda. */
const ACTIVE_BOOKING_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS];

const listQuerySchema = z.object({
  readiness: z.nativeEnum(DriverReadiness).optional(),
  routeScope: z.nativeEnum(DriverRoute).optional(),
  search: z.string().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{8,20}$/, 'Nomor kontak harus 8 sampai 20 karakter angka, boleh memakai tanda + atau tanda hubung.')
  .nullable()
  .optional();

const licenseSchema = z
  .string()
  .trim()
  .min(4, 'Nomor SIM minimal 4 karakter.')
  .max(30, 'Nomor SIM maksimal 30 karakter.')
  .nullable()
  .optional();

const createDriverSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama supir minimal 3 karakter.').max(80, 'Nama supir maksimal 80 karakter.'),
  phoneNumber: phoneSchema,
  licenseNumber: licenseSchema,
  routeScope: z.nativeEnum(DriverRoute, {
    errorMap: () => ({ message: 'Rute penugasan tidak valid (pilih: DALAM_KOTA atau LUAR_KOTA).' }),
  }),
});

const updateDriverSchema = createDriverSchema.partial();

const readinessSchema = z.object({
  readiness: z.nativeEnum(DriverReadiness, {
    errorMap: () => ({ message: 'Status kesiapan tidak valid (pilih: SIAGA, LIBUR, atau SEDANG_TUGAS).' }),
  }),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Supir aktif dengan nama atau nomor kontak yang sama dianggap duplikat (butir A5 dan A6). */
async function assertNoDuplicate(
  fullName: string | undefined,
  phoneNumber: string | null | undefined,
  exceptDriverId?: string,
): Promise<void> {
  if (fullName) {
    const sameName = await db.driver.findFirst({
      where: {
        isActive: true,
        fullName: { equals: fullName, mode: 'insensitive' },
        ...(exceptDriverId ? { id: { not: exceptDriverId } } : {}),
      },
      select: { id: true, fullName: true },
    });
    if (sameName) {
      throw new AppError('DRIVER_DUPLICATE', `Supir dengan nama '${fullName}' sudah terdaftar di roster.`, 409);
    }
  }

  if (phoneNumber) {
    const samePhone = await db.driver.findFirst({
      where: {
        isActive: true,
        phoneNumber,
        ...(exceptDriverId ? { id: { not: exceptDriverId } } : {}),
      },
      select: { id: true, fullName: true },
    });
    if (samePhone) {
      throw new AppError(
        'DRIVER_DUPLICATE',
        `Nomor kontak '${phoneNumber}' sudah dipakai supir '${samePhone.fullName}'.`,
        409,
      );
    }
  }
}

/** Bentuk keluaran supir yang dipakai dashboard: ditambah penugasan aktif dan status terkunci. */
function toDriverResponse(driver: any) {
  const activeBooking = Array.isArray(driver.bookings) ? driver.bookings[0] : undefined;
  return {
    ...driver,
    bookings: undefined,
    activeAssignment: activeBooking
      ? {
          bookingId: activeBooking.id,
          bookingCode: activeBooking.bookingCode,
          status: activeBooking.status,
          startDateTime: activeBooking.startDateTime,
          endDateTime: activeBooking.endDateTime,
          vehicle: activeBooking.vehicle ?? null,
        }
      : null,
    isLocked: driver.readiness === DriverReadiness.SEDANG_TUGAS || Boolean(activeBooking),
  };
}

const driverInclude = {
  bookings: {
    where: { status: { in: ACTIVE_BOOKING_STATUSES } },
    orderBy: { startDateTime: 'asc' as const },
    take: 1,
    select: {
      id: true,
      bookingCode: true,
      status: true,
      startDateTime: true,
      endDateTime: true,
      vehicle: { select: { name: true, licensePlate: true } },
    },
  },
};

/**
 * GET /api/v1/admin/drivers
 * Daftar roster supir beserta penugasan aktifnya. Default hanya supir aktif (butir C5).
 */
adminDriverRouter.get('/', validateQuery(listQuerySchema), async (req: Request, res: Response) => {
  try {
    const { readiness, routeScope, search, includeInactive } = req.query as {
      readiness?: DriverReadiness;
      routeScope?: DriverRoute;
      search?: string;
      includeInactive?: 'true' | 'false';
    };

    const where: any = {};
    if (includeInactive !== 'true') where.isActive = true;
    if (readiness) where.readiness = readiness;
    if (routeScope) where.routeScope = routeScope;
    if (search && search.trim() !== '') {
      const keyword = search.trim();
      where.OR = [
        { fullName: { contains: keyword, mode: 'insensitive' } },
        { externalId: { contains: keyword, mode: 'insensitive' } },
        { phoneNumber: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const drivers = await db.driver.findMany({
      where,
      orderBy: [{ readiness: 'asc' }, { fullName: 'asc' }],
      include: driverInclude,
    });

    sendSuccess(res, drivers.map(toDriverResponse));
  } catch (_error) {
    sendError(res, 'FETCH_DRIVERS_ERROR', 'Gagal memuat roster supir.', 500);
  }
});

/**
 * GET /api/v1/admin/drivers/:id
 * Detail satu supir. `:id` boleh uuid atau externalId (butir C1).
 */
adminDriverRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const driver = await db.driver.findFirst({
      where: { OR: [{ id }, { externalId: id }] },
      include: driverInclude,
    });

    if (!driver) {
      sendError(res, 'DRIVER_NOT_FOUND', `Supir dengan pengenal '${id}' tidak ditemukan di roster.`, 404);
      return;
    }

    sendSuccess(res, toDriverResponse(driver));
  } catch (_error) {
    sendError(res, 'FETCH_DRIVER_DETAIL_ERROR', 'Gagal memuat detail supir.', 500);
  }
});

/**
 * POST /api/v1/admin/drivers
 * Menambah supir baru ke roster dengan status awal SIAGA.
 */
adminDriverRouter.post('/', validateBody(createDriverSchema), async (req: Request, res: Response) => {
  try {
    const staffUser = req.user!;
    const payload = req.body as z.infer<typeof createDriverSchema>;

    await assertNoDuplicate(payload.fullName, payload.phoneNumber ?? null);

    let externalId = slugify(payload.fullName);
    if (externalId.length === 0) externalId = `supir-${Date.now()}`;

    /* Nomor urut dipakai kalau slug sudah terpakai supir nonaktif dengan nama sama. */
    let suffix = 2;
    while (await db.driver.findUnique({ where: { externalId }, select: { id: true } })) {
      externalId = `${slugify(payload.fullName)}-${suffix}`;
      suffix += 1;
    }

    const created = await db.$transaction(async (tx) => {
      const driver = await tx.driver.create({
        data: {
          externalId,
          fullName: payload.fullName,
          phoneNumber: payload.phoneNumber ?? null,
          licenseNumber: payload.licenseNumber ?? null,
          routeScope: payload.routeScope,
          readiness: DriverReadiness.SIAGA,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: staffUser.userId,
          action: 'CREATE_DRIVER',
          entityType: 'Driver',
          entityId: driver.id,
          metadata: {
            externalId: driver.externalId,
            fullName: driver.fullName,
            routeScope: driver.routeScope,
            readiness: driver.readiness,
          },
        },
      });

      return driver;
    });

    sendSuccess(res, { ...created, activeAssignment: null, isLocked: false }, 201);
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }
    sendError(res, 'CREATE_DRIVER_ERROR', 'Gagal menambah supir baru.', 500);
  }
});

/**
 * PATCH /api/v1/admin/drivers/:id
 * Memperbarui data supir. Status kesiapan tidak diubah di sini, pakai endpoint readiness.
 */
adminDriverRouter.patch('/:id', validateBody(updateDriverSchema), async (req: Request, res: Response) => {
  try {
    const staffUser = req.user!;
    const { id } = req.params;
    const payload = req.body as z.infer<typeof updateDriverSchema>;

    const driver = await db.driver.findFirst({ where: { OR: [{ id }, { externalId: id }] } });
    if (!driver) {
      throw new AppError('DRIVER_NOT_FOUND', `Supir dengan pengenal '${id}' tidak ditemukan di roster.`, 404);
    }
    if (!driver.isActive) {
      throw new AppError('DRIVER_INACTIVE', `Supir '${driver.fullName}' sudah nonaktif dan tidak bisa diubah.`, 409);
    }

    await assertNoDuplicate(payload.fullName, payload.phoneNumber ?? null, driver.id);

    /* Hanya field yang benar-benar dikirim yang dicatat, dan hanya nilai JSON-safe. */
    const changes: Record<string, string | null> = {};
    if (payload.fullName !== undefined) changes.fullName = payload.fullName;
    if (payload.phoneNumber !== undefined) changes.phoneNumber = payload.phoneNumber ?? null;
    if (payload.licenseNumber !== undefined) changes.licenseNumber = payload.licenseNumber ?? null;
    if (payload.routeScope !== undefined) changes.routeScope = payload.routeScope;

    const updated = await db.$transaction(async (tx) => {
      const record = await tx.driver.update({
        where: { id: driver.id },
        data: {
          ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
          ...(payload.phoneNumber !== undefined ? { phoneNumber: payload.phoneNumber ?? null } : {}),
          ...(payload.licenseNumber !== undefined ? { licenseNumber: payload.licenseNumber ?? null } : {}),
          ...(payload.routeScope !== undefined ? { routeScope: payload.routeScope } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: staffUser.userId,
          action: 'UPDATE_DRIVER',
          entityType: 'Driver',
          entityId: record.id,
          metadata: {
            externalId: record.externalId,
            changes,
          },
        },
      });

      return record;
    });

    sendSuccess(res, { ...updated, activeAssignment: null, isLocked: updated.readiness === DriverReadiness.SEDANG_TUGAS });
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }
    sendError(res, 'UPDATE_DRIVER_ERROR', 'Gagal memperbarui data supir.', 500);
  }
});

/**
 * PATCH /api/v1/admin/drivers/:id/readiness
 * Sakelar kesiapan supir: hanya memindahkan antara SIAGA dan LIBUR.
 * Status SEDANG_TUGAS lahir dari penugasan booking, bukan dari sakelar (butir B1 dan B2).
 */
adminDriverRouter.patch(
  '/:id/readiness',
  validateBody(readinessSchema),
  async (req: Request, res: Response) => {
    try {
      const staffUser = req.user!;
      const { id } = req.params;
      const { readiness, note } = req.body as z.infer<typeof readinessSchema>;

      if (readiness === DriverReadiness.SEDANG_TUGAS) {
        throw new AppError(
          'DRIVER_READINESS_MANUAL_INVALID',
          'Status SEDANG_TUGAS hanya diberikan sistem saat supir ditugaskan ke booking, tidak bisa dipilih manual.',
          400,
        );
      }

      const driver = await db.driver.findFirst({
        where: { OR: [{ id }, { externalId: id }] },
        include: driverInclude,
      });

      if (!driver) {
        throw new AppError('DRIVER_NOT_FOUND', `Supir dengan pengenal '${id}' tidak ditemukan di roster.`, 404);
      }
      if (!driver.isActive) {
        throw new AppError('DRIVER_INACTIVE', `Supir '${driver.fullName}' sudah nonaktif.`, 409);
      }
      if (driver.bookings.length > 0 || driver.readiness === DriverReadiness.SEDANG_TUGAS) {
        throw new AppError(
          'DRIVER_ON_DUTY',
          `Supir '${driver.fullName}' sedang bertugas, jadi kesiapannya belum bisa diubah.`,
          409,
        );
      }
      if (driver.readiness === readiness) {
        sendSuccess(res, {
          ...toDriverResponse({ ...driver, readiness }),
          unchanged: true,
        });
        return;
      }

      const updated = await db.$transaction(async (tx) => {
        const record = await tx.driver.update({
          where: { id: driver.id },
          data: { readiness },
        });

        await tx.auditLog.create({
          data: {
            actorId: staffUser.userId,
            action: 'UPDATE_DRIVER_READINESS',
            entityType: 'Driver',
            entityId: record.id,
            metadata: {
              externalId: record.externalId,
              fromReadiness: driver.readiness,
              toReadiness: readiness,
              note: note ?? null,
            },
          },
        });

        return record;
      });

      sendSuccess(res, { ...updated, activeAssignment: null, isLocked: false });
    } catch (error) {
      if (error instanceof AppError) {
        sendError(res, error.code, error.message, error.statusCode);
        return;
      }
      sendError(res, 'UPDATE_DRIVER_READINESS_ERROR', 'Gagal mengubah kesiapan supir.', 500);
    }
  },
);

/**
 * DELETE /api/v1/admin/drivers/:id
 * Menonaktifkan supir dari roster. Data tidak dihapus permanen supaya jejak audit utuh
 * (butir C3 dan C4). Supir yang masih terikat booking aktif ditolak.
 */
adminDriverRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const staffUser = req.user!;
    const { id } = req.params;

    const driver = await db.driver.findFirst({
      where: { OR: [{ id }, { externalId: id }] },
      include: driverInclude,
    });

    if (!driver) {
      throw new AppError('DRIVER_NOT_FOUND', `Supir dengan pengenal '${id}' tidak ditemukan di roster.`, 404);
    }
    if (!driver.isActive) {
      throw new AppError('DRIVER_INACTIVE', `Supir '${driver.fullName}' sudah nonaktif sebelumnya.`, 409);
    }

    /* Pengikat supir bukan hanya booking yang sudah dikonfirmasi, tetapi juga yang masih
       menunggu konfirmasi, karena penugasan itu sudah direncanakan (butir C3). */
    const pesananBelumSelesai = await db.booking.count({
      where: {
        driverId: driver.id,
        status: { notIn: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED] },
      },
    });

    if (pesananBelumSelesai > 0) {
      throw new AppError(
        'DRIVER_ASSIGNED',
        `Supir '${driver.fullName}' masih terikat ${pesananBelumSelesai} pesanan yang belum selesai, jadi belum bisa dinonaktifkan.`,
        409,
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const record = await tx.driver.update({
        where: { id: driver.id },
        data: { isActive: false, readiness: DriverReadiness.LIBUR },
      });

      await tx.auditLog.create({
        data: {
          actorId: staffUser.userId,
          action: 'DEACTIVATE_DRIVER',
          entityType: 'Driver',
          entityId: record.id,
          metadata: {
            externalId: record.externalId,
            fullName: record.fullName,
          },
        },
      });

      return record;
    });

    sendSuccess(res, { ...updated, activeAssignment: null, isLocked: false });
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }
    sendError(res, 'DEACTIVATE_DRIVER_ERROR', 'Gagal menonaktifkan supir.', 500);
  }
});
