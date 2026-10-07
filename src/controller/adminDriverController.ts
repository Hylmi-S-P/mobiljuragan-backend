import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { DriverReadiness, DriverRoute, type Prisma } from '../generated/prisma/client.js';
import { driverModel } from '../model/driverModel.js';
import { AppError, sendSuccess } from '../lib/response.js';
import {
  createDriverSchema,
  readinessSchema,
  updateDriverSchema,
} from '../validators/driverSchemas.js';
import type { DriverWithAssignment } from '../model/driverModel.js';

/**
 * Controller roster supir.
 *
 * Roster supir resmi MobilJuragan Merauke. Menopang layar Manajemen Supir (07),
 * modal M4 dan M5, serta pemilihan supir di Detail Pemesanan (04B) pada dashboard.
 *
 * Aturan yang dijaga di sini: nama atau nomor kontak supir aktif tidak boleh kembar,
 * supir yang masih terikat pesanan aktif tidak boleh dinonaktifkan, dan sakelar
 * kesiapan tidak bisa diubah saat supir sedang bertugas.
 *
 * Semua kegagalan diteruskan lewat `next(error)` supaya ditangani satu kali oleh
 * errorHandler global, yang sudah menerjemahkan AppError menjadi respons error standar.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Supir aktif dengan nama atau nomor kontak yang sama dianggap duplikat. */
async function assertNoDuplicate(
  fullName: string | undefined,
  phoneNumber: string | null | undefined,
  exceptDriverId?: string,
): Promise<void> {
  if (fullName) {
    const sameName = await driverModel.findActiveByName(fullName, exceptDriverId);
    if (sameName) {
      throw new AppError(
        'DRIVER_DUPLICATE',
        `Supir dengan nama '${fullName}' sudah terdaftar di roster.`,
        409,
      );
    }
  }

  if (phoneNumber) {
    const samePhone = await driverModel.findActiveByPhoneNumber(phoneNumber, exceptDriverId);
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
function toDriverResponse(driver: DriverWithAssignment) {
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

export const adminDriverController = {
  /**
   * GET /api/v1/admin/drivers
   * Daftar roster supir beserta penugasan aktifnya. Default hanya supir aktif.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { readiness, routeScope, search, includeInactive } = req.query as {
        readiness?: DriverReadiness;
        routeScope?: DriverRoute;
        search?: string;
        includeInactive?: 'true' | 'false';
      };

      const where: Prisma.DriverWhereInput = {};
      if (includeInactive !== 'true') where.isActive = true;
      if (readiness) where.readiness = readiness;
      if (routeScope) where.routeScope = routeScope;
      if (search && search.trim() !== '') {
        const keyword = search.trim();
        where.OR = [
          { fullName: { contains: keyword } },
          { externalId: { contains: keyword } },
          { phoneNumber: { contains: keyword } },
        ];
      }

      const drivers = await driverModel.findMany(where);

      sendSuccess(res, drivers.map(toDriverResponse));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/drivers/:id
   * Detail satu supir. `:id` boleh uuid atau externalId.
   */
  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const driver = await driverModel.findByIdOrExternalId(id);

      if (!driver) {
        throw new AppError(
          'DRIVER_NOT_FOUND',
          `Supir dengan pengenal '${id}' tidak ditemukan di roster.`,
          404,
        );
      }

      sendSuccess(res, toDriverResponse(driver));
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/admin/drivers
   * Menambah supir baru ke roster dengan status awal SIAGA.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffUser = req.user!;
      const payload = req.body as z.infer<typeof createDriverSchema>;

      await assertNoDuplicate(payload.fullName, payload.phoneNumber ?? null);

      let externalId = slugify(payload.fullName);
      if (externalId.length === 0) externalId = `supir-${Date.now()}`;

      /* Nomor urut dipakai kalau slug sudah terpakai supir nonaktif dengan nama sama. */
      let suffix = 2;
      while (await driverModel.existsByExternalId(externalId)) {
        externalId = `${slugify(payload.fullName)}-${suffix}`;
        suffix += 1;
      }

      const created = await driverModel.createWithAudit({
        externalId,
        fullName: payload.fullName,
        phoneNumber: payload.phoneNumber ?? null,
        licenseNumber: payload.licenseNumber ?? null,
        routeScope: payload.routeScope,
        actorId: staffUser.userId,
      });

      sendSuccess(res, { ...created, activeAssignment: null, isLocked: false }, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/drivers/:id
   * Memperbarui data supir. Status kesiapan tidak diubah di sini, pakai endpoint readiness.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffUser = req.user!;
      const { id } = req.params;
      const payload = req.body as z.infer<typeof updateDriverSchema>;

      const driver = await driverModel.findPlainByIdOrExternalId(id);
      if (!driver) {
        throw new AppError(
          'DRIVER_NOT_FOUND',
          `Supir dengan pengenal '${id}' tidak ditemukan di roster.`,
          404,
        );
      }
      if (!driver.isActive) {
        throw new AppError(
          'DRIVER_INACTIVE',
          `Supir '${driver.fullName}' sudah nonaktif dan tidak bisa diubah.`,
          409,
        );
      }

      await assertNoDuplicate(payload.fullName, payload.phoneNumber ?? null, driver.id);

      /* Hanya field yang benar-benar dikirim yang dicatat, dan hanya nilai JSON-safe. */
      const changes: Record<string, string | null> = {};
      if (payload.fullName !== undefined) changes.fullName = payload.fullName;
      if (payload.phoneNumber !== undefined) changes.phoneNumber = payload.phoneNumber ?? null;
      if (payload.licenseNumber !== undefined)
        changes.licenseNumber = payload.licenseNumber ?? null;
      if (payload.routeScope !== undefined) changes.routeScope = payload.routeScope;

      const updated = await driverModel.updateWithAudit(
        driver.id,
        {
          fullName: payload.fullName,
          phoneNumber:
            payload.phoneNumber === undefined ? undefined : (payload.phoneNumber ?? null),
          licenseNumber:
            payload.licenseNumber === undefined ? undefined : (payload.licenseNumber ?? null),
          routeScope: payload.routeScope,
        },
        changes,
        staffUser.userId,
      );

      sendSuccess(res, {
        ...updated,
        activeAssignment: null,
        isLocked: updated.readiness === DriverReadiness.SEDANG_TUGAS,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/drivers/:id/readiness
   * Sakelar kesiapan supir: hanya memindahkan antara SIAGA dan LIBUR.
   * Status SEDANG_TUGAS lahir dari penugasan booking, bukan dari sakelar.
   */
  async updateReadiness(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const driver = await driverModel.findByIdOrExternalId(id);

      if (!driver) {
        throw new AppError(
          'DRIVER_NOT_FOUND',
          `Supir dengan pengenal '${id}' tidak ditemukan di roster.`,
          404,
        );
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

      const updated = await driverModel.updateReadinessWithAudit({
        id: driver.id,
        fromReadiness: driver.readiness,
        toReadiness: readiness,
        note: note ?? null,
        actorId: staffUser.userId,
      });

      sendSuccess(res, { ...updated, activeAssignment: null, isLocked: false });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/admin/drivers/:id
   * Menonaktifkan supir dari roster. Data tidak dihapus permanen supaya jejak audit utuh.
   * Supir yang masih terikat booking aktif ditolak.
   */
  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffUser = req.user!;
      const { id } = req.params;

      const driver = await driverModel.findByIdOrExternalId(id);

      if (!driver) {
        throw new AppError(
          'DRIVER_NOT_FOUND',
          `Supir dengan pengenal '${id}' tidak ditemukan di roster.`,
          404,
        );
      }
      if (!driver.isActive) {
        throw new AppError(
          'DRIVER_INACTIVE',
          `Supir '${driver.fullName}' sudah nonaktif sebelumnya.`,
          409,
        );
      }

      /* Pengikat supir bukan hanya booking yang sudah dikonfirmasi, tetapi juga yang masih
         menunggu konfirmasi, karena penugasan itu sudah direncanakan. */
      const pesananBelumSelesai = await driverModel.countUnfinishedBookings(driver.id);

      if (pesananBelumSelesai > 0) {
        throw new AppError(
          'DRIVER_ASSIGNED',
          `Supir '${driver.fullName}' masih terikat ${pesananBelumSelesai} pesanan yang belum selesai, jadi belum bisa dinonaktifkan.`,
          409,
        );
      }

      const updated = await driverModel.deactivateWithAudit(driver.id, staffUser.userId);

      sendSuccess(res, { ...updated, activeAssignment: null, isLocked: false });
    } catch (error) {
      next(error);
    }
  },
};
