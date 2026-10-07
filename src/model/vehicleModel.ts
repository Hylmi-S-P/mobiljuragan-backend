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
  operationalStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Status booking yang dianggap masih mengunci armada. */
const BLOCKING_BOOKING_STATUS: BookingStatus[] = [
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

    // Filter status operasional (default: AVAILABLE)
    if (operationalStatus && operationalStatus !== 'ALL') {
      whereClause.operationalStatus = operationalStatus as OperationalStatus;
    } else if (!operationalStatus) {
      whereClause.operationalStatus = OperationalStatus.AVAILABLE;
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
      select: CATALOG_FIELDS,
    });
  },

  /** Detail armada dicari lewat ID internal maupun externalId, keduanya dipakai klien. */
  findByIdOrExternalId(id: string) {
    return db.vehicle.findFirst({
      where: {
        OR: [{ id }, { externalId: id }],
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
};
