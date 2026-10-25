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

        /* Jumlah transaksi per model sewa dihitung dari basis yang sama dengan
           omzetnya, yaitu PAID. Sebelumnya angka ini diambil dari COMPLETED,
           sehingga donut bisa menampilkan "Rp 3.000.000 · 0 transaksi" ketika
           pembayaran sudah lunas tetapi perjalanannya belum ditandai selesai. */
        if (b.rentalType === 'WITHOUT_DRIVER') {
          withoutDriverRevenue += amount;
          withoutDriverCount += 1;
        } else {
          withDriverRevenue += amount;
          withDriverCount += 1;
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

        /* Jumlah per model sewa TIDAK dihitung di sini lagi. Angkanya sudah
           dihitung pada cabang isPaid di atas, supaya pembilang dan penyebut
           persentase memakai basis yang sama dengan omzetnya. */

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

    /* ================= Data untuk grafik =================
     *
     * Query terpisah dari `bookings` di atas. `bookings` sudah disaring oleh
     * parameter `range` yang dipakai tabel dan kartu, sedangkan grafik butuh
     * rentang tetap 12 bulan dan 4 tahun. Kalau memakai `bookings` yang sama,
     * grafik akan ikut mengecil begitu pengguna memilih "bulan ini".
     *
     * Yang dihitung hanya transaksi yang benar-benar lunas (PAID). Tanggal yang
     * dipakai adalah waktu verifikasi pembayaran, karena di situlah uang masuk.
     * Kalau belum ada waktu verifikasi, dipakai waktu pesanan dibuat.
     */
    const BULAN_GRAFIK = 12;
    const TAHUN_YOY = 4;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const transaksiLunas = await db.booking.findMany({
      where: { payment: { is: { status: 'PAID' } } },
      select: {
        quotedAmount: true,
        createdAt: true,
        payment: { select: { verifiedAt: true } },
      },
    });

    const tanggalMasuk = (b: (typeof transaksiLunas)[number]): Date =>
      b.payment?.verifiedAt ? new Date(b.payment.verifiedAt) : new Date(b.createdAt);

    const nominal = (b: (typeof transaksiLunas)[number]): number =>
      b.quotedAmount ? Number(b.quotedAmount) : 0;

    /* --- Grafik 1: 12 bulan terakhir, tiap bulan dipecah per minggu --- */
    type BulanGrafik = {
      label: string;
      shortLabel: string;
      tahun: number;
      bulan: number;
      revenue: number;
      bookings: number;
      weekly: number[];
    };

    const bulanMap = new Map<string, BulanGrafik>();
    const urutanBulan: string[] = [];

    for (let i = BULAN_GRAFIK - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      urutanBulan.push(key);
      bulanMap.set(key, {
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        shortLabel: monthNames[d.getMonth()],
        tahun: d.getFullYear(),
        bulan: d.getMonth() + 1,
        revenue: 0,
        bookings: 0,
        // Satu bulan paling banyak 5 minggu (31 hari → ceil(31/7) = 5).
        weekly: [0, 0, 0, 0, 0],
      });
    }

    /* --- Grafik 2: tahun ke tahun, 4 tahun terakhir --- */
    type TahunGrafik = { tahun: number; revenue: number; bookings: number };
    const tahunMap = new Map<number, TahunGrafik>();
    const urutanTahun: number[] = [];

    for (let i = TAHUN_YOY - 1; i >= 0; i--) {
      const th = now.getFullYear() - i;
      urutanTahun.push(th);
      tahunMap.set(th, { tahun: th, revenue: 0, bookings: 0 });
    }

    for (const b of transaksiLunas) {
      const d = tanggalMasuk(b);
      const nilai = nominal(b);

      const keyBulan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bulan = bulanMap.get(keyBulan);
      if (bulan) {
        bulan.revenue += nilai;
        bulan.bookings += 1;
        // Minggu ke-1 = tanggal 1-7, ke-2 = 8-14, dan seterusnya.
        const indeksMinggu = Math.min(Math.floor((d.getDate() - 1) / 7), 4);
        bulan.weekly[indeksMinggu] += nilai;
      }

      const tahun = tahunMap.get(d.getFullYear());
      if (tahun) {
        tahun.revenue += nilai;
        tahun.bookings += 1;
      }
    }

    const monthlyTrends = urutanBulan.map((k) => bulanMap.get(k)!);
    const yearOverYear = urutanTahun.map((t) => tahunMap.get(t)!);

    /* Label minggu dibuat dari tanggal asli, bukan sekadar "Minggu 1", supaya
       pembaca tahu rentang tanggalnya. */
    const labelMinggu = (tahun: number, bulan: number, indeks: number): string => {
      const awal = new Date(tahun, bulan - 1, indeks * 7 + 1);
      const akhirHari = Math.min((indeks + 1) * 7, new Date(tahun, bulan, 0).getDate());
      const akhir = new Date(tahun, bulan - 1, akhirHari);
      return `${awal.getDate()}–${akhir.getDate()} ${monthNames[bulan - 1]}`;
    };

    const weeklyBreakdown = monthlyTrends.map((m) => ({
      label: m.label,
      tahun: m.tahun,
      bulan: m.bulan,
      minggu: m.weekly.map((revenue, i) => ({
        label: labelMinggu(m.tahun, m.bulan, i),
        revenue,
      })),
    }));

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
        weeklyBreakdown,
        yearOverYear,
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
