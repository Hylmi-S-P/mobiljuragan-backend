import { db } from '../db.js';
import {
  BookingStatus,
  DriverReadiness,
  type DriverRoute,
  type Prisma,
} from '../generated/prisma/client.js';

/**
 * Lapisan model untuk tabel `drivers`.
 *
 * Sesuai pemisahan tanggung jawab, hanya lapisan ini yang berbicara ke database.
 * Controller memanggil fungsi di sini dan tidak pernah menyusun query sendiri.
 *
 * Aturan bisnis modul supir (kesiapan SIAGA, LIBUR, SEDANG_TUGAS, penugasan ke
 * booking, dan penonaktifan) tetap dijaga di controller, karena aturan itu
 * keputusan alur, bukan bentuk query.
 */

/** Status booking yang membuat supir terkunci dan tidak boleh ditugaskan ganda. */
const ACTIVE_BOOKING_STATUSES = [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS];

/** Bentuk include yang dipakai hampir semua endpoint: penugasan aktif terdekat. */
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
 * Bentuk baris supir beserta penugasan aktifnya, diturunkan langsung dari `driverInclude`.
 * Dipakai controller untuk membentuk respons tanpa menebak bentuk datanya.
 */
export type DriverWithAssignment = Prisma.DriverGetPayload<{ include: typeof driverInclude }>;

export const driverModel = {
  /** Daftar roster supir. `where` disusun controller karena bergantung filter query. */
  findMany(where: Prisma.DriverWhereInput) {
    return db.driver.findMany({
      where,
      orderBy: [{ readiness: 'asc' }, { fullName: 'asc' }],
      include: driverInclude,
    });
  },

  findByIdOrExternalId(id: string) {
    return db.driver.findFirst({
      where: { OR: [{ id }, { externalId: id }] },
      include: driverInclude,
    });
  },

  /** Dipakai pemeriksaan duplikat: supir aktif dengan nama atau nomor kontak yang sama. */
  findActiveByName(fullName: string, exceptDriverId?: string) {
    return db.driver.findFirst({
      where: {
        isActive: true,
        fullName: { equals: fullName },
        ...(exceptDriverId ? { id: { not: exceptDriverId } } : {}),
      },
      select: { id: true, fullName: true },
    });
  },

  findActiveByPhoneNumber(phoneNumber: string, exceptDriverId?: string) {
    return db.driver.findFirst({
      where: {
        isActive: true,
        phoneNumber,
        ...(exceptDriverId ? { id: { not: exceptDriverId } } : {}),
      },
      select: { id: true, fullName: true },
    });
  },

  /** Supir tanpa relasi, dipakai untuk pemeriksaan status sebelum diubah. */
  findPlainByIdOrExternalId(id: string) {
    return db.driver.findFirst({ where: { OR: [{ id }, { externalId: id }] } });
  },

  existsByExternalId(externalId: string) {
    return db.driver.findUnique({ where: { externalId }, select: { id: true } });
  },

  /**
   * Penulisan supir selalu dibungkus transaksi bersama audit log, supaya jejak
   * audit dan perubahan roster tidak pernah terpisah.
   */
  createWithAudit(input: {
    externalId: string;
    fullName: string;
    phoneNumber: string | null;
    licenseNumber: string | null;
    routeScope: DriverRoute;
    actorId: string;
  }) {
    return db.$transaction(async (tx) => {
      const driver = await tx.driver.create({
        data: {
          externalId: input.externalId,
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          licenseNumber: input.licenseNumber,
          routeScope: input.routeScope,
          readiness: DriverReadiness.SIAGA,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
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
  },

  updateWithAudit(
    id: string,
    data: {
      fullName?: string;
      phoneNumber?: string | null;
      licenseNumber?: string | null;
      routeScope?: DriverRoute;
    },
    changes: Record<string, string | null>,
    actorId: string,
  ) {
    return db.$transaction(async (tx) => {
      const record = await tx.driver.update({
        where: { id },
        data: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}),
          ...(data.licenseNumber !== undefined ? { licenseNumber: data.licenseNumber } : {}),
          ...(data.routeScope !== undefined ? { routeScope: data.routeScope } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
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
  },

  updateReadinessWithAudit(input: {
    id: string;
    fromReadiness: DriverReadiness;
    toReadiness: DriverReadiness;
    note: string | null;
    actorId: string;
  }) {
    return db.$transaction(async (tx) => {
      const record = await tx.driver.update({
        where: { id: input.id },
        data: { readiness: input.toReadiness },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'UPDATE_DRIVER_READINESS',
          entityType: 'Driver',
          entityId: record.id,
          metadata: {
            externalId: record.externalId,
            fromReadiness: input.fromReadiness,
            toReadiness: input.toReadiness,
            note: input.note,
          },
        },
      });

      return record;
    });
  },

  deactivateWithAudit(id: string, actorId: string) {
    return db.$transaction(async (tx) => {
      const record = await tx.driver.update({
        where: { id },
        data: { isActive: false, readiness: DriverReadiness.LIBUR },
      });

      await tx.auditLog.create({
        data: {
          actorId,
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
  },

  /**
   * Pengikat supir bukan hanya booking yang sudah dikonfirmasi, tetapi juga yang masih
   * menunggu konfirmasi, karena penugasan itu sudah direncanakan.
   */
  countUnfinishedBookings(driverId: string) {
    return db.booking.count({
      where: {
        driverId,
        status: { notIn: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED] },
      },
    });
  },
};
