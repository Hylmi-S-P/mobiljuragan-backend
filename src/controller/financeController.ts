import type { Request, Response } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';

export async function getFinanceSummary(req: Request, res: Response): Promise<void> {
  try {
    const range = (req.query.range as string) || 'all'; // 'month' | 'last_month' | 'all'

    // Buat batasan tanggal opsional sesuai parameter filter
    let dateFilter: { gte?: Date; lte?: Date } | undefined;
    const now = new Date();

    if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (range === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      dateFilter = { gte: startOfLastMonth, lte: endOfLastMonth };
    }

    const bookingWhere = dateFilter ? { createdAt: dateFilter } : {};

    // 1. Ambil semua booking yang relevan dengan unit armada beserta status pembayarannya
    const bookings = await db.booking.findMany({
      where: bookingWhere,
      include: {
        vehicle: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Ambil semua armada untuk tabel kontribusi armada lengkap
    const allVehicles = await db.vehicle.findMany({
      where: { operationalStatus: { not: 'UNAVAILABLE' } },
      orderBy: { name: 'asc' },
    });

    // Agregasi metrik
    let totalRevenue = 0;
    let completedBookingsCount = 0;
    let confirmedOrActiveCount = 0;

    let withoutDriverRevenue = 0;
    let withoutDriverCount = 0;
    let withDriverRevenue = 0;
    let withDriverCount = 0;

    // Map omzet per armada
    const vehicleStatsMap = new Map<
      string,
      {
        vehicleId: string;
        externalId: string;
        name: string;
        licensePlate: string;
        category: string | null;
        completedBookings: number;
        totalRevenue: number;
        activeBookings: number;
      }
    >();

    // Inisialisasi setiap armada resmi
    for (const v of allVehicles) {
      vehicleStatsMap.set(v.id, {
        vehicleId: v.id,
        externalId: v.externalId,
        name: v.name,
        licensePlate: v.licensePlate,
        category: v.category,
        completedBookings: 0,
        totalRevenue: 0,
        activeBookings: 0,
      });
    }

    // Kalkulasi per booking
    for (const b of bookings) {
      const amount = b.quotedAmount ? Number(b.quotedAmount) : 0;
      const isPaid = b.payment?.status === 'PAID';

      if (isPaid) {
        // Omzet kas masuk riil hanya tercatat jika pembayaran telah terverifikasi lunas (PAID)
        totalRevenue += amount;

        if (b.rentalType === 'WITHOUT_DRIVER') {
          withoutDriverRevenue += amount;
        } else {
          withDriverRevenue += amount;
        }

        const stat = vehicleStatsMap.get(b.vehicleId);
        if (stat) {
          stat.totalRevenue += amount;
        }
      }
      /* Piutang berjalan tidak lagi dihitung. Kartunya sudah dihapus dari laporan
         keuangan sesuai keputusan pemilik proyek, jadi angkanya tidak dipakai
         siapa pun. Menghitung nilai yang tidak dipakai hanya menambah beban. */

      // Hitung metrik operasional armada
      if (b.status === 'COMPLETED') {
        completedBookingsCount += 1;
        if (b.rentalType === 'WITHOUT_DRIVER') {
          withoutDriverCount += 1;
        } else {
          withDriverCount += 1;
        }

        const stat = vehicleStatsMap.get(b.vehicleId);
        if (stat) {
          stat.completedBookings += 1;
        }
      } else if (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') {
        confirmedOrActiveCount += 1;

        const stat = vehicleStatsMap.get(b.vehicleId);
        if (stat) {
          stat.activeBookings += 1;
        }
      }
    }

    // Susun breakdown per armada, urutkan dari omzet tertinggi
    const fleetBreakdown = Array.from(vehicleStatsMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue || b.completedBookings - a.completedBookings
    );

    // Tren bulanan (6 bulan terakhir)
    const monthlyMap = new Map<string, { label: string; revenue: number; bookings: number }>();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      monthlyMap.set(key, { label, revenue: 0, bookings: 0 });
    }

    for (const b of bookings) {
      if (b.payment?.status === 'PAID') {
        const d = b.payment.verifiedAt ? new Date(b.payment.verifiedAt) : new Date(b.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap.has(key)) {
          const entry = monthlyMap.get(key)!;
          entry.revenue += b.quotedAmount ? Number(b.quotedAmount) : 0;
          entry.bookings += 1;
        }
      }
    }

    const monthlyTrends = Array.from(monthlyMap.values());

    res.status(200).json({
      status: 'ok',
      data: {
        summary: {
          totalRevenue,
          completedBookingsCount,
          confirmedOrActiveCount,
          totalAllBookings: bookings.length,
        },
        rentalTypes: {
          withoutDriver: {
            count: withoutDriverCount,
            revenue: withoutDriverRevenue,
            percentage: totalRevenue > 0 ? Math.round((withoutDriverRevenue / totalRevenue) * 100) : 0,
          },
          withDriver: {
            count: withDriverCount,
            revenue: withDriverRevenue,
            percentage: totalRevenue > 0 ? Math.round((withDriverRevenue / totalRevenue) * 100) : 0,
          },
        },
        fleetBreakdown,
        monthlyTrends,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Gagal menghitung ringkasan laporan keuangan');
    res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data laporan keuangan.',
    });
  }
}
