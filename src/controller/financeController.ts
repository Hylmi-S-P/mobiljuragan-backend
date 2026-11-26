import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { sendError } from '../lib/response.js';

type BookingAggregateRow = {
  vehicleId: string;
  rentalType: 'WITH_DRIVER' | 'WITHOUT_DRIVER';
  totalBookings: bigint | number | string;
  completedBookings: bigint | number | string | null;
  activeBookings: bigint | number | string | null;
  paidCount: bigint | number | string | null;
  rentalRevenue: number | string | null;
  refundWithFeeCount: bigint | number | string | null;
  cancellationFeeRevenue: number | string | null;
  refundFullCount: bigint | number | string | null;
  pendingRefundCount: bigint | number | string | null;
  unpaidCount: bigint | number | string | null;
};

type TrendAggregateRow = {
  tahun: bigint | number | string;
  bulan: bigint | number | string;
  indeksMinggu: bigint | number | string;
  isPaid: bigint | number | string;
  totalNominal: number | string | null;
  jumlah: bigint | number | string;
};

/* Rentang bulan yang boleh dipilih untuk grafik omzet. Dibatasi daftar putih,
   bukan bilangan bebas: grafik dengan 37 bulan tidak berguna dan hanya
   memperlambat kueri. */
const PILIHAN_BULAN = [1, 3, 6, 12] as const;
type JumlahBulan = (typeof PILIHAN_BULAN)[number];

/* Rentang bawaan untuk grafik omzet. Satu bulan, karena itu yang paling sering
   dilihat saat membuka halaman. */
const BULAN_GRAFIK_DEFAULT: JumlahBulan = 1;

/* YoY tetap 4 tahun — tidak ikut parameter `bulan`. */
const TAHUN_YOY = 4;

/**
 * Membaca parameter `?bulan=` dan mengembalikan jumlah bulan yang sah.
 *
 * Mengembalikan `undefined` kalau parameternya tidak dikirim (pakai nilai bawaan),
 * dan `null` kalau nilainya tidak ada di daftar putih (pemanggil balas 400).
 * Nilai salah sengaja TIDAK diam-diam jatuh ke nilai bawaan: filter yang ditelan
 * akan tampak seperti filter yang tidak jalan.
 */
function bacaJumlahBulan(raw: unknown): JumlahBulan | null | undefined {
  if (raw === undefined || raw === '') return undefined;
  const angka = Number(raw);
  return PILIHAN_BULAN.includes(angka as JumlahBulan) ? (angka as JumlahBulan) : null;
}

export async function getFinanceSummary(req: Request, res: Response): Promise<void> {
  try {
    const range = (req.query.range as string) || 'all'; // '1m' | '3m' | '6m' | '12m' | 'year' | 'month' | 'last_month' | 'all'

    // Rentang grafik omzet: 1, 3, 6, atau 12 bulan.
    const bulanDiminta = bacaJumlahBulan(req.query.bulan);
    if (bulanDiminta === null) {
      sendError(res, 'INVALID_MONTH_WINDOW', 'Parameter bulan hanya menerima 1, 3, 6, 12.', 400, {
        bulan: ['Nilai yang diterima: 1, 3, 6, 12.'],
      });
      return;
    }
    const jumlahBulan: JumlahBulan = bulanDiminta ?? BULAN_GRAFIK_DEFAULT;

    // Buat batasan tanggal opsional sesuai parameter filter
    let dateFilter: { gte?: Date; lte?: Date } | undefined;
    const now = new Date();

    if (range === 'month' || range === '1m') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (range === '3m') {
      dateFilter = { gte: new Date(now.getFullYear(), now.getMonth() - 2, 1) };
    } else if (range === '6m') {
      dateFilter = { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) };
    } else if (range === '12m') {
      dateFilter = { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) };
    } else if (range === 'year') {
      dateFilter = { gte: new Date(now.getFullYear(), 0, 1) };
    } else if (range === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      dateFilter = { gte: startOfLastMonth, lte: endOfLastMonth };
    }

    const whereClause =
      dateFilter?.gte && dateFilter?.lte
        ? Prisma.sql`WHERE b.createdAt >= ${dateFilter.gte} AND b.createdAt <= ${dateFilter.lte}`
        : dateFilter?.gte
          ? Prisma.sql`WHERE b.createdAt >= ${dateFilter.gte}`
          : Prisma.empty;

    const batasBawahGrafik = new Date(now.getFullYear() - (TAHUN_YOY - 1), 0, 1);
    const offsetMenit = Math.trunc(-now.getTimezoneOffset());
    const offsetSql = Prisma.raw(String(offsetMenit));

    // Agregasi langsung di MariaDB agar RAM server konstan O(armada + 48 bulan)
    // tanpa menarik seluruh riwayat booking sepanjang masa ke heap Node.js.
    const [bookingAggs, allVehicles, trendAggs] = await Promise.all([
      db.$queryRaw<BookingAggregateRow[]>`
        SELECT
          b.vehicleId AS vehicleId,
          b.rentalType AS rentalType,
          COUNT(*) AS totalBookings,
          SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedBookings,
          SUM(CASE WHEN b.status IN ('CONFIRMED', 'IN_PROGRESS') THEN 1 ELSE 0 END) AS activeBookings,
          SUM(CASE WHEN p.status = 'PAID' THEN 1 ELSE 0 END) AS paidCount,
          SUM(
            CASE
              WHEN p.status = 'PAID'
              THEN COALESCE(b.finalAmount, p.totalAmount, b.quotedAmount, 0)
              ELSE 0
            END
          ) AS rentalRevenue,
          SUM(
            CASE
              WHEN (p.status IS NULL OR p.status <> 'PAID')
                AND r.status = 'SELESAI'
                AND COALESCE(r.potongan, 0) > 0
              THEN 1
              ELSE 0
            END
          ) AS refundWithFeeCount,
          SUM(
            CASE
              WHEN (p.status IS NULL OR p.status <> 'PAID')
                AND r.status = 'SELESAI'
                AND COALESCE(r.potongan, 0) > 0
              THEN COALESCE(r.potongan, 0)
              ELSE 0
            END
          ) AS cancellationFeeRevenue,
          SUM(
            CASE
              WHEN (p.status IS NULL OR p.status <> 'PAID')
                AND r.status = 'SELESAI'
                AND COALESCE(r.potongan, 0) <= 0
              THEN 1
              ELSE 0
            END
          ) AS refundFullCount,
          SUM(
            CASE
              WHEN (p.status IS NULL OR p.status <> 'PAID')
                AND r.status = 'MENUNGGU'
              THEN 1
              ELSE 0
            END
          ) AS pendingRefundCount,
          SUM(
            CASE
              WHEN (p.status IS NULL OR p.status <> 'PAID')
                AND (r.status IS NULL OR r.status NOT IN ('SELESAI', 'MENUNGGU'))
              THEN 1
              ELSE 0
            END
          ) AS unpaidCount
        FROM bookings b
        LEFT JOIN payments p ON p.bookingId = b.id
        LEFT JOIN booking_refunds r ON r.bookingId = b.id
        ${whereClause}
        GROUP BY b.vehicleId, b.rentalType
      `,
      db.vehicle.findMany({
        where: { operationalStatus: { not: 'UNAVAILABLE' } },
        select: {
          id: true,
          externalId: true,
          name: true,
          licensePlate: true,
          category: true,
        },
        orderBy: { name: 'asc' },
      }),
      db.$queryRaw<TrendAggregateRow[]>`
        SELECT
          YEAR(t.tglLokal) AS tahun,
          MONTH(t.tglLokal) AS bulan,
          LEAST(FLOOR((DAYOFMONTH(t.tglLokal) - 1) / 7), 4) AS indeksMinggu,
          t.isPaid AS isPaid,
          SUM(t.nominal) AS totalNominal,
          COUNT(*) AS jumlah
        FROM (
          SELECT
            CASE WHEN p.status = 'PAID' THEN 1 ELSE 0 END AS isPaid,
            CASE
              WHEN p.status = 'PAID'
              THEN COALESCE(b.finalAmount, p.totalAmount, b.quotedAmount, 0)
              ELSE COALESCE(r.potongan, 0)
            END AS nominal,
            TIMESTAMPADD(
              MINUTE,
              ${offsetSql},
              CASE
                WHEN p.status = 'PAID' THEN COALESCE(p.verifiedAt, b.createdAt)
                ELSE COALESCE(r.diselesaikanPada, p.verifiedAt, b.createdAt)
              END
            ) AS tglLokal
          FROM bookings b
          LEFT JOIN payments p ON p.bookingId = b.id
          LEFT JOIN booking_refunds r ON r.bookingId = b.id
          WHERE
            (p.status = 'PAID' AND COALESCE(p.verifiedAt, b.createdAt) >= ${batasBawahGrafik})
            OR (
              (p.status IS NULL OR p.status <> 'PAID')
              AND r.status = 'SELESAI'
              AND COALESCE(r.potongan, 0) > 0
              AND COALESCE(r.diselesaikanPada, p.verifiedAt, b.createdAt) >= ${batasBawahGrafik}
            )
        ) t
        GROUP BY
          YEAR(t.tglLokal),
          MONTH(t.tglLokal),
          LEAST(FLOOR((DAYOFMONTH(t.tglLokal) - 1) / 7), 4),
          t.isPaid
      `,
    ]);

    // Agregasi metrik
    let totalRevenue = 0;
    let rentalRevenue = 0;
    let cancellationFeeRevenue = 0;
    let totalAllBookings = 0;
    let paidCount = 0;
    let refundWithFeeCount = 0;
    let refundFullCount = 0;
    let pendingRefundCount = 0;
    let unpaidCount = 0;
    let completedBookingsCount = 0;
    let confirmedOrActiveCount = 0;

    /* Omzet dan jumlah transaksi per model sewa.
     *
     * `count` hanya menghitung transaksi sewa yang benar-benar lunas (PAID),
     * sedangkan `feeCount` / `feeRevenue` mencatat potongan pembatalan dari
     * refund yang sudah selesai. Keduanya dipisah agar jumlah transaksi
     * sinkron dengan grafik Pemasukan Tahunan dan Tahun ke Tahun. */
    let tanpaSupirOmzet = 0;
    let tanpaSupirJumlah = 0;
    let tanpaSupirFeeJumlah = 0;
    let tanpaSupirFeeOmzet = 0;
    let denganSupirOmzet = 0;
    let denganSupirJumlah = 0;
    let denganSupirFeeJumlah = 0;
    let denganSupirFeeOmzet = 0;

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

    // Akumulasi hasil agregasi SQL per unit & model sewa
    for (const row of bookingAggs) {
      const rowTotal = Number(row.totalBookings ?? 0);
      const rowCompleted = Number(row.completedBookings ?? 0);
      const rowActive = Number(row.activeBookings ?? 0);
      const rowPaidCount = Number(row.paidCount ?? 0);
      const rowRentalRevenue = Number(row.rentalRevenue ?? 0);
      const rowRefundFeeCount = Number(row.refundWithFeeCount ?? 0);
      const rowCancellationFeeRevenue = Number(row.cancellationFeeRevenue ?? 0);
      const rowRefundFullCount = Number(row.refundFullCount ?? 0);
      const rowPendingRefundCount = Number(row.pendingRefundCount ?? 0);
      const rowUnpaidCount = Number(row.unpaidCount ?? 0);

      totalAllBookings += rowTotal;
      rentalRevenue += rowRentalRevenue;
      cancellationFeeRevenue += rowCancellationFeeRevenue;
      totalRevenue += rowRentalRevenue + rowCancellationFeeRevenue;
      paidCount += rowPaidCount;
      refundWithFeeCount += rowRefundFeeCount;
      refundFullCount += rowRefundFullCount;
      pendingRefundCount += rowPendingRefundCount;
      unpaidCount += rowUnpaidCount;
      completedBookingsCount += rowCompleted;
      confirmedOrActiveCount += rowActive;

      if (row.rentalType === 'WITHOUT_DRIVER') {
        tanpaSupirOmzet += rowRentalRevenue + rowCancellationFeeRevenue;
        tanpaSupirJumlah += rowPaidCount;
        tanpaSupirFeeJumlah += rowRefundFeeCount;
        tanpaSupirFeeOmzet += rowCancellationFeeRevenue;
      } else {
        denganSupirOmzet += rowRentalRevenue + rowCancellationFeeRevenue;
        denganSupirJumlah += rowPaidCount;
        denganSupirFeeJumlah += rowRefundFeeCount;
        denganSupirFeeOmzet += rowCancellationFeeRevenue;
      }

      const stat = vehicleStatsMap.get(row.vehicleId);
      if (stat) {
        stat.totalRevenue += rowRentalRevenue + rowCancellationFeeRevenue;
        stat.completedBookings += rowCompleted;
        stat.activeBookings += rowActive;
      }
    }

    // Susun breakdown per armada, urutkan dari omzet tertinggi
    const fleetBreakdown = Array.from(vehicleStatsMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue || b.completedBookings - a.completedBookings
    );

    // Data untuk grafik
    //
    // Query terpisah dari `bookingAggs` di atas. `bookingAggs` sudah disaring oleh
    // parameter `range` yang dipakai tabel dan kartu, sedangkan grafik butuh
    // rentang tetap 12 bulan dan 4 tahun.
    const BULAN_GRAFIK = jumlahBulan;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    // Grafik 1: 12 bulan terakhir per minggu
    type BulanGrafik = {
      label: string;
      shortLabel: string;
      tahun: number;
      bulan: number;
      revenue: number;
      bookings: number;
      refundFeeCount: number;
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
        refundFeeCount: 0,
        // Satu bulan paling banyak 5 minggu (31 hari -> ceil(31/7) = 5).
        weekly: [0, 0, 0, 0, 0],
      });
    }

    // Grafik 2: perbandingan tahunan (YoY) 4 tahun terakhir
    type TahunGrafik = {
      tahun: number;
      revenue: number;
      bookings: number;
      refundFeeCount: number;
    };
    const tahunMap = new Map<number, TahunGrafik>();
    const urutanTahun: number[] = [];

    for (let i = TAHUN_YOY - 1; i >= 0; i--) {
      const th = now.getFullYear() - i;
      urutanTahun.push(th);
      tahunMap.set(th, { tahun: th, revenue: 0, bookings: 0, refundFeeCount: 0 });
    }

    for (const row of trendAggs) {
      const tahunAngka = Number(row.tahun);
      const bulanAngka = Number(row.bulan);
      const indeksMinggu = Math.min(Math.max(Number(row.indeksMinggu), 0), 4);
      const isPaid = Number(row.isPaid) === 1;
      const nilai = Number(row.totalNominal ?? 0);
      const jumlah = Number(row.jumlah ?? 0);

      const keyBulan = `${tahunAngka}-${String(bulanAngka).padStart(2, '0')}`;
      const bulan = bulanMap.get(keyBulan);
      if (bulan) {
        bulan.revenue += nilai;
        if (isPaid) {
          bulan.bookings += jumlah;
        } else {
          bulan.refundFeeCount += jumlah;
        }
        bulan.weekly[indeksMinggu] += nilai;
      }

      const tahun = tahunMap.get(tahunAngka);
      if (tahun) {
        tahun.revenue += nilai;
        if (isPaid) {
          tahun.bookings += jumlah;
        } else {
          tahun.refundFeeCount += jumlah;
        }
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
        range,
        bulan: jumlahBulan,
        summary: {
          totalRevenue,
          rentalRevenue,
          cancellationFeeRevenue,
          completedBookingsCount,
          confirmedOrActiveCount,
          totalAllBookings,
          bookingBreakdown: {
            paidCount,
            refundWithFeeCount,
            refundFullCount,
            pendingRefundCount,
            unpaidCount,
          },
        },
        /* Perbandingan model sewa. Dikirim lagi karena tab-nya dipakai untuk
           melihat mana yang lebih menguntungkan: lepas kunci atau dengan supir. */
        rentalTypes: {
          withoutDriver: {
            count: tanpaSupirJumlah,
            feeCount: tanpaSupirFeeJumlah,
            feeRevenue: tanpaSupirFeeOmzet,
            revenue: tanpaSupirOmzet,
            percentage:
              totalRevenue > 0 ? Math.round((tanpaSupirOmzet / totalRevenue) * 100) : 0,
          },
          withDriver: {
            count: denganSupirJumlah,
            feeCount: denganSupirFeeJumlah,
            feeRevenue: denganSupirFeeOmzet,
            revenue: denganSupirOmzet,
            percentage:
              totalRevenue > 0 ? Math.round((denganSupirOmzet / totalRevenue) * 100) : 0,
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
