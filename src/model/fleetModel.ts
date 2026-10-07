import { db } from '../db.js';
import { BookingStatus } from '../generated/prisma/client.js';

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
    const vehicleWhere: Record<string, unknown> = {};
    if (input.category) {
      vehicleWhere.category = { equals: input.category };
    }

    return db.vehicle.findMany({
      where: vehicleWhere,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
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
};
