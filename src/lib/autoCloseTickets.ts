import { TicketStatus } from '../generated/prisma/client.js';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { publishTicketEvent } from './ticketEvents.js';

/**
 * Penjadwal tunggal penutupan otomatis tiket manual (`bookingId == null`) yang tidak
 * aktif selama 24 jam.
 *
 * Aturan yang ditegakkan:
 * - Hanya tiket manual (`bookingId: null`) yang belum tertutup (`OPEN`, `IN_PROGRESS`,
 *   `WAITING_CUSTOMER`, `RESOLVED`) yang diperiksa.
 * - Tiket khusus pesanan (`bookingId != null`) dikecualikan dari auto-close 24 jam
 *   selama masa sewa berjalan, dan ditutup otomatis begitu pesanan `COMPLETED` atau
 *   `CANCELLED`.
 * - Setiap penutupan otomatis selalu menyetel `status = CLOSED`,
 *   `closedBySystem = true`, dan `closedAt = sekarang`.
 */

/** Batas diam sebelum tiket ditutup, dalam milidetik (24 jam). */
export const BATAS_DIAM_MS = 24 * 60 * 60 * 1000;

/** Jeda antar siklus pemeriksaan, dalam milidetik (30 menit). */
const JEDA_SIKLUS_MS = 30 * 60 * 1000;

/** Status tiket yang masih dapat ditutup otomatis setelah diam 24 jam. */
const STATUS_AKTIF_ATAU_RESOLVED: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.RESOLVED,
];

export interface HasilPenutupan {
  diperiksa: number;
  ditutup: number;
  dilewatiKarenaPesananAktif: number;
  idYangDitutup: string[];
}

/**
 * Menutup satu putaran tiket manual (`bookingId == null`) yang sudah tidak aktif
 * selama minimal 24 jam.
 */
export async function tutupTiketKedaluwarsa(
  sekarang: Date = new Date(),
): Promise<HasilPenutupan> {
  const batas = new Date(sekarang.getTime() - BATAS_DIAM_MS);

  const kandidat = await db.supportTicket.findMany({
    where: {
      bookingId: null,
      status: { in: STATUS_AKTIF_ATAU_RESOLVED },
      lastActivityAt: { lte: batas },
    },
    select: {
      id: true,
      ticketNumber: true,
      customerId: true,
      status: true,
      lastActivityAt: true,
      messages: {
        orderBy: { sequence: 'desc' },
        take: 1,
        select: { isCustomer: true },
      },
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

  const idYangDitutup: string[] = [];

  for (const tiket of kandidat) {
    const terakhirDariPelanggan = tiket.messages[0]?.isCustomer === true;
    const catatan = terakhirDariPelanggan
      ? 'Tiket ditutup otomatis karena tidak ada balasan selama 24 jam. Pesan terakhir Anda belum sempat dijawab petugas; tulis lagi di tiket ini bila masih perlu dibantu.'
      : 'Tiket ditutup otomatis karena tidak ada aktivitas selama 24 jam. Tulis lagi di tiket ini bila masih perlu dibantu.';

    const hasil = await db.$transaction(async (tx) => {
      if (tiket.status !== TicketStatus.RESOLVED) {
        const pesanTerakhir = await tx.ticketMessage.aggregate({
          where: { ticketId: tiket.id },
          _max: { sequence: true },
        });
        const urutanBerikut = (pesanTerakhir._max.sequence ?? 0) + 1;

        await tx.ticketMessage.create({
          data: {
            ticketId: tiket.id,
            body: catatan,
            isCustomer: false,
            isAi: true,
            sequence: urutanBerikut,
          },
        });
      }

      return tx.supportTicket.updateMany({
        where: {
          id: tiket.id,
          bookingId: null,
          status: { in: STATUS_AKTIF_ATAU_RESOLVED },
        },
        data: {
          status: TicketStatus.CLOSED,
          closedBySystem: true,
          closedAt: sekarang,
          lastActivityAt: sekarang,
        },
      });
    });

    if (hasil.count > 0) {
      idYangDitutup.push(tiket.id);
      publishTicketEvent({
        jenis: 'status',
        ticketId: tiket.id,
        status: TicketStatus.CLOSED,
        versi: sekarang.toISOString(),
      });
    }
  }

  return {
    diperiksa: kandidat.length,
    ditutup: idYangDitutup.length,
    dilewatiKarenaPesananAktif: 0,
    idYangDitutup,
  };
}

let penjadwal: NodeJS.Timeout | null = null;

/**
 * Menyalakan penjadwal tunggal penutupan tiket. Aman dipanggil berkali-kali:
 * kalau sudah menyala, panggilan berikutnya tidak membuat penjadwal kedua.
 */
export function mulaiPenjadwalTiket(intervalMs: number = JEDA_SIKLUS_MS): { stop: () => void } {
  if (!penjadwal) {
    const jalankan = async () => {
      try {
        const hasil = await tutupTiketKedaluwarsa();
        if (hasil.ditutup > 0) {
          logger.info(
            {
              ditutup: hasil.ditutup,
              diperiksa: hasil.diperiksa,
            },
            'Penutupan otomatis tiket selesai',
          );
        }
      } catch (error) {
        logger.error({ error }, 'Penutupan otomatis tiket gagal');
      }
    };

    void jalankan();
    penjadwal = setInterval(jalankan, intervalMs);
    penjadwal.unref?.();
  }

  return {
    stop: hentikanPenjadwalTiket,
  };
}

/** Mematikan penjadwal. Dipakai pengujian supaya proses bisa berhenti bersih. */
export function hentikanPenjadwalTiket(): void {
  if (!penjadwal) return;
  clearInterval(penjadwal);
  penjadwal = null;
}
