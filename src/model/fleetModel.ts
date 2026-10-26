import { db } from '../db.js';
import { BookingStatus, type Prisma } from '../generated/prisma/client.js';

/**
 * Lapisan model untuk kalender armada.
 *
 * Sesuai pemisahan tanggung jawab, hanya lapisan ini yang berbicara ke database.
 * Controller memanggil fungsi di sini dan tidak pernah menyusun query sendiri.
 */
export const fleetModel = {
  /**
   * Armada beserta jadwal sewa yang aktif pada rentang waktu tertentu.
   * Hanya booking CONFIRMED dan IN_PROGRESS yang dianggap mengunci jadwal.
   */
  listVehiclesWithSchedules(input: { category?: string; start: Date; end: Date }) {
    const vehicleWhere: Prisma.VehicleWhereInput = {};
    if (input.category) {
      vehicleWhere.category = { equals: input.category };
    }

    return db.vehicle.findMany({
      where: vehicleWhere,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        bookings: {
          where: {
            status: {
              in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
            },
            startDateTime: { lt: input.end },
            endDateTime: { gt: input.start },
          },
          orderBy: { startDateTime: 'asc' },
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });
  },

  /**
   * Unit yang sedang tersewa pada satu titik waktu.
   *
   * Dipakai katalog armada untuk menampilkan badge "Disewa". Tanpa ini, katalog
   * membaca kolom `operationalStatus` saja, dan kolom itu menyimpan keadaan unit
   * di gudang (servis, tidak tersedia) — tidak diperbarui saat ada sewa berjalan.
   * Akibatnya unit yang sedang disewa tetap tampil "Tersedia" di katalog.
   *
   * Yang dihitung hanya booking yang benar-benar mengunci jadwal: CONFIRMED dan
   * IN_PROGRESS. Booking yang masih menunggu konfirmasi tarif belum mengunci apa
   * pun, jadi unitnya masih pantas tampil tersedia.
   *
   * Mengembalikan himpunan id, bukan daftar lengkap, karena katalog hanya perlu
   * tahu "sedang disewa atau tidak".
   */
  async vehicleIdsRentedAt(waktu: Date): Promise<Set<string>> {
    const baris = await db.booking.findMany({
      where: {
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
        startDateTime: { lte: waktu },
        endDateTime: { gte: waktu },
      },
      select: { vehicleId: true },
      distinct: ['vehicleId'],
    });

    return new Set(baris.map((b) => b.vehicleId));
  },
};
