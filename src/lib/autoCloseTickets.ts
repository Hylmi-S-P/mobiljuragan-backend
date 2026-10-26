import { BookingStatus } from '../generated/prisma/client.js';
import { db } from '../db.js';
import { logger } from '../logger.js';

/**
 * Penutupan otomatis tiket yang sudah lama tidak bergerak.
 *
 * Masalah yang diselesaikan: tiket yang ditinggalkan pelanggan menumpuk di
 * antrean tanpa batas. Tidak ada cara membedakan percakapan yang masih hidup
 * dari yang sudah mati, jadi admin melihat daftar panjang berisi tiket yang
 * sebenarnya sudah selesai.
 *
 * Aturan yang dipakai:
 * - Hanya tiket yang belum tertutup yang diperiksa.
 * - Batas diamnya 24 jam sejak aktivitas terakhir.
 * - Tiket yang masih ditangani AI TIDAK ikut ditutup, karena asisten AI boleh
 *   saja masih menunggu balasan pelanggan pada percakapan yang baru dimulai.
 * - Tiket yang punya pesanan aktif (CONFIRMED atau IN_PROGRESS) juga tidak
 *   ditutup. Pelanggan yang sedang dalam perjalanan masih butuh saluran ini,
 *   dan menutupnya di tengah jalan justru menambah masalah.
 */

/** Batas diam sebelum tiket ditutup, dalam milidetik. */
export const BATAS_DIAM_MS = 24 * 60 * 60 * 1000;

/** Jeda antar siklus pemeriksaan, dalam milidetik. */
const JEDA_SIKLUS_MS = 60 * 60 * 1000;

/** Status tiket yang dianggap masih terbuka. */
const STATUS_TERBUKA = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER'] as const;

export interface HasilPenutupan {
  diperiksa: number;
  ditutup: number;
  dilewatiKarenaPesananAktif: number;
  idYangDitutup: string[];
}

/**
 * Menutup satu putaran tiket yang sudah kedaluwarsa.
 *
 * Dipisah dari penjadwal supaya bisa dipanggil langsung oleh pengujian tanpa
 * menunggu satu jam.
 */
export async function tutupTiketKedaluwarsa(
  sekarang: Date = new Date(),
): Promise<HasilPenutupan> {
  const batas = new Date(sekarang.getTime() - BATAS_DIAM_MS);

  const kandidat = await db.supportTicket.findMany({
    where: {
      status: { in: [...STATUS_TERBUKA] },
      lastActivityAt: { lt: batas },
      /* Tiket yang masih dipegang AI dilewati. */
      handledBy: { not: 'AI' },
    },
    select: {
      id: true,
      ticketNumber: true,
      customerId: true,
      status: true,
      lastActivityAt: true,
    },
  });

  if (kandidat.length === 0) {
    return {
      diperiksa: 0,
      ditutup: 0,
      dilewatiKarenaPesananAktif: 0,
      idYangDitutup: [],
    };
  }

  /* Pelanggan yang masih punya pesanan aktif tidak ikut ditutup. Satu query
     untuk semua pelanggan kandidat, bukan satu query per tiket. */
  const idPelanggan = [...new Set(kandidat.map((t) => t.customerId))];
  const pesananAktif = await db.booking.findMany({
    where: {
      customerId: { in: idPelanggan },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
    },
    select: { customerId: true },
  });
  const pelangganDenganPesanan = new Set(pesananAktif.map((b) => b.customerId));

  const akanDitutup = kandidat.filter((t) => !pelangganDenganPesanan.has(t.customerId));
  const dilewati = kandidat.length - akanDitutup.length;

  if (akanDitutup.length === 0) {
    return {
      diperiksa: kandidat.length,
      ditutup: 0,
      dilewatiKarenaPesananAktif: dilewati,
      idYangDitutup: [],
    };
  }

  /* Setiap penutupan menulis pesan penjelasan supaya pelanggan tidak mendapati
     tiketnya hilang tanpa sebab. Pesan dan perubahan status dibungkus satu
     transaksi per tiket agar tidak pernah terpisah. */
  for (const tiket of akanDitutup) {
    await db.$transaction(async (tx) => {
      const pesanTerakhir = await tx.ticketMessage.aggregate({
        where: { ticketId: tiket.id },
        _max: { sequence: true },
      });
      const urutanBerikut = (pesanTerakhir._max.sequence ?? 0) + 1;

      await tx.ticketMessage.create({
        data: {
          ticketId: tiket.id,
          body:
            'Tiket ini ditutup otomatis karena tidak ada balasan selama 24 jam. ' +
            'Kalau masih perlu dibantu, silakan balas pesan ini atau buat tiket baru.',
          isCustomer: false,
          isAi: false,
          sequence: urutanBerikut,
        },
      });

      await tx.supportTicket.update({
        where: { id: tiket.id },
        data: {
          status: 'CLOSED',
          lastActivityAt: sekarang,
        },
      });
    });
  }

  return {
    diperiksa: kandidat.length,
    ditutup: akanDitutup.length,
    dilewatiKarenaPesananAktif: dilewati,
    idYangDitutup: akanDitutup.map((t) => t.id),
  };
}

let penjadwal: NodeJS.Timeout | null = null;

/**
 * Menyalakan penjadwal. Aman dipanggil berkali-kali: kalau sudah menyala,
 * panggilan berikutnya tidak membuat penjadwal kedua.
 */
export function mulaiPenjadwalTiket(): void {
  if (penjadwal) return;

  const jalankan = async () => {
    try {
      const hasil = await tutupTiketKedaluwarsa();
      if (hasil.ditutup > 0) {
        logger.info(
          {
            ditutup: hasil.ditutup,
            diperiksa: hasil.diperiksa,
            dilewatiKarenaPesananAktif: hasil.dilewatiKarenaPesananAktif,
          },
          'Penutupan otomatis tiket selesai',
        );
      }
    } catch (error) {
      /* Kegagalan satu siklus tidak boleh mematikan penjadwal. Dicatat lalu
         siklus berikutnya tetap berjalan. */
      logger.error({ error }, 'Penutupan otomatis tiket gagal');
    }
  };

  /* Satu putaran langsung saat mulai, lalu berkala. Tanpa putaran awal, tiket
     yang sudah kedaluwarsa baru tertutup satu jam setelah server menyala. */
  void jalankan();
  penjadwal = setInterval(jalankan, JEDA_SIKLUS_MS);

  /* Jangan menahan proses tetap hidup hanya karena penjadwal ini. */
  penjadwal.unref?.();
}

/** Mematikan penjadwal. Dipakai pengujian supaya proses bisa berhenti bersih. */
export function hentikanPenjadwalTiket(): void {
  if (!penjadwal) return;
  clearInterval(penjadwal);
  penjadwal = null;
}
