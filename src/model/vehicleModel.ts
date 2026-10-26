import { db } from '../db.js';
import { BookingStatus, OperationalStatus, type Prisma } from '../generated/prisma/client.js';

/**
 * Lapisan model untuk tabel `vehicles`.
 *
 * Sesuai pemisahan tanggung jawab, hanya lapisan ini yang berbicara ke database.
 * Controller memanggil fungsi di sini dan tidak pernah menyusun query sendiri.
 */

/** Kolom katalog yang aman dipublikasikan ke klien. */
const CATALOG_FIELDS = {
  id: true,
  externalId: true,
  name: true,
  licensePlate: true,
  brand: true,
  model: true,
  seatingCapacity: true,
  transmission: true,
  category: true,
  imageUrl: true,
  pricePerDay: true,
  operationalStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Status booking yang dianggap masih mengunci armada. */
const BLOCKING_BOOKING_STATUS: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.PENDING_CONFIRMATION,
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
];

/** Bentuk filter katalog yang sudah tervalidasi dan siap dipakai menyusun query. */
export interface VehicleCatalogFilter {
  category?: string;
  transmission?: string;
  search?: string;
  operationalStatus?: string;
  startDate?: string;
  endDate?: string;
}

export const vehicleModel = {
  /** Kategori unik yang benar-benar terpakai di armada, nilai kosong dibuang. */
  async listCategories() {
    const records = await db.vehicle.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    return records.map((r) => r.category).filter((c): c is string => Boolean(c));
  },

  listCatalog(filter: VehicleCatalogFilter) {
    const { category, transmission, search, operationalStatus, startDate, endDate } = filter;
    const whereClause: Prisma.VehicleWhereInput = {};

    // Filter status operasional (sertakan AVAILABLE, BOOKED, MAINTENANCE agar status armada transparan)
    if (operationalStatus && operationalStatus !== 'ALL') {
      whereClause.operationalStatus = operationalStatus as OperationalStatus;
    } else if (!operationalStatus) {
      whereClause.operationalStatus = {
        in: [OperationalStatus.AVAILABLE, OperationalStatus.BOOKED, OperationalStatus.MAINTENANCE],
      };
    }

    // Filter kategori
    if (category) {
      whereClause.category = {
        equals: category,
      };
    }

    // Filter transmisi
    if (transmission) {
      whereClause.transmission = {
        equals: transmission,
      };
    }

    // Filter pencarian nama armada, plat nomor, atau model
    if (search && search.trim() !== '') {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q } },
        { licensePlate: { contains: q } },
        { model: { contains: q } },
        { brand: { contains: q } },
      ];
    }

    // Filter ketersediaan berdasarkan bentrok tanggal sewa dengan booking aktif
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      whereClause.bookings = {
        none: {
          AND: [
            {
              status: {
                in: BLOCKING_BOOKING_STATUS,
              },
            },
            { startDateTime: { lt: end } },
            { endDateTime: { gt: start } },
          ],
        },
      };
    }

    return db.vehicle.findMany({
      where: whereClause,
      orderBy: [{ operationalStatus: 'asc' }, { name: 'asc' }],
      select: {
        ...CATALOG_FIELDS,
        /* Ringkasan booking yang sedang mengunci unit saat ini.
         *
         * `operationalStatus` hanya berubah lewat perubahan manual admin, jadi
         * unit yang sedang disewa tetap tertulis AVAILABLE. Tanpa ringkasan ini,
         * katalog menampilkan "Tersedia" untuk mobil yang sudah keluar.
         *
         * Hanya kode dan status yang dikirim: klien tidak perlu tahu nominal atau
         * identitas penyewa untuk sekadar memberi badge. */
        bookings: {
          where: {
            status: { in: BLOCKING_BOOKING_STATUS },
            endDateTime: { gte: new Date() },
          },
          select: {
            id: true,
            bookingCode: true,
            status: true,
          },
          take: 1,
          orderBy: { startDateTime: 'asc' },
        },
      },
    });
  },

  /** Detail armada dicari lewat ID internal maupun externalId, keduanya dipakai klien. */
  findByIdOrExternalId(id: string) {
    return db.vehicle.findFirst({
      where: {
        OR: [{ id }, { externalId: id }],
      },
      include: {
        bookings: {
          where: {
            status: { in: BLOCKING_BOOKING_STATUS },
            endDateTime: { gte: new Date() },
          },
          select: {
            id: true,
            bookingCode: true,
            status: true,
            startDateTime: true,
            endDateTime: true,
          },
          take: 1,
          orderBy: { startDateTime: 'asc' },
        },
      },
    });
  },

  /**
   * Ubah status operasional armada sekaligus catat jejak audit staf.
   * Keduanya dibungkus satu transaksi supaya status dan audit log tidak pernah terpisah.
   */
  updateOperationalStatus(
    vehicle: {
      id: string;
      externalId: string;
      name: string;
      licensePlate: string;
      operationalStatus: OperationalStatus;
    },
    nextStatus: OperationalStatus,
    actorId: string,
    note?: string,
  ) {
    return db.$transaction(async (tx) => {
      const updated = await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          operationalStatus: nextStatus,
        },
      });

      // Catat jejak audit aktivitas staf
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE_VEHICLE_STATUS',
          entityType: 'Vehicle',
          entityId: vehicle.id,
          metadata: {
            externalId: vehicle.externalId,
            name: vehicle.name,
            licensePlate: vehicle.licensePlate,
            fromStatus: vehicle.operationalStatus,
            toStatus: nextStatus,
            note: note || null,
          },
        },
      });

      return updated;
    });
  },

  createVehicle(
    data: {
      name: string;
      licensePlate: string;
      category?: string;
      transmission?: string;
      seatingCapacity?: number;
      pricePerDay?: number;
      brand?: string;
      model?: string;
      imageUrl?: string;
      operationalStatus?: OperationalStatus;
    },
    actorId: string,
  ) {
    const slug =
      data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      data.licensePlate.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return db.$transaction(async (tx) => {
      const created = await tx.vehicle.create({
        data: {
          externalId: slug,
          name: data.name,
          licensePlate: data.licensePlate,
          category: data.category ?? 'MPV',
          transmission: data.transmission ?? 'MANUAL',
          seatingCapacity: data.seatingCapacity ?? 7,
          pricePerDay: data.pricePerDay ?? 400000,
          brand: data.brand ?? null,
          model: data.model ?? null,
          imageUrl: data.imageUrl ?? null,
          operationalStatus: data.operationalStatus ?? OperationalStatus.AVAILABLE,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CREATE_VEHICLE',
          entityType: 'Vehicle',
          entityId: created.id,
          metadata: {
            name: created.name,
            licensePlate: created.licensePlate,
            pricePerDay: created.pricePerDay,
          },
        },
      });

      return created;
    });
  },

  updateVehicle(
    id: string,
    data: {
      name?: string;
      licensePlate?: string;
      category?: string;
      transmission?: string;
      seatingCapacity?: number;
      pricePerDay?: number;
      brand?: string;
      model?: string;
      imageUrl?: string;
      operationalStatus?: OperationalStatus;
    },
    actorId: string,
  ) {
    return db.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { OR: [{ id }, { externalId: id }] },
      });

      if (!vehicle) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      const updated = await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.licensePlate !== undefined ? { licensePlate: data.licensePlate } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.transmission !== undefined ? { transmission: data.transmission } : {}),
          ...(data.seatingCapacity !== undefined ? { seatingCapacity: data.seatingCapacity } : {}),
          ...(data.pricePerDay !== undefined ? { pricePerDay: data.pricePerDay } : {}),
          ...(data.brand !== undefined ? { brand: data.brand } : {}),
          ...(data.model !== undefined ? { model: data.model } : {}),
          ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
          ...(data.operationalStatus !== undefined
            ? { operationalStatus: data.operationalStatus }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE_VEHICLE',
          entityType: 'Vehicle',
          entityId: updated.id,
          metadata: {
            fromPrice: vehicle.pricePerDay,
            toPrice: updated.pricePerDay,
            fromStatus: vehicle.operationalStatus,
            toStatus: updated.operationalStatus,
          },
        },
      });

      return updated;
    });
  },

  deleteVehicle(id: string, actorId: string) {
    return db.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { OR: [{ id }, { externalId: id }] },
      });

      if (!vehicle) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      const activeBookings = await tx.booking.count({
        where: {
          vehicleId: vehicle.id,
          status: { in: BLOCKING_BOOKING_STATUS },
        },
      });

      if (activeBookings > 0) {
        throw new Error('VEHICLE_HAS_ACTIVE_BOOKINGS');
      }

      const deleted = await tx.vehicle.delete({
        where: { id: vehicle.id },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'DELETE_VEHICLE',
          entityType: 'Vehicle',
          entityId: vehicle.id,
          metadata: {
            name: vehicle.name,
            licensePlate: vehicle.licensePlate,
          },
        },
      });

      return deleted;
    });
  },
};
