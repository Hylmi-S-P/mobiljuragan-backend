import { mulaiPenjadwalTiket } from '../lib/autoCloseTickets.js';

/**
 * Worker periodik tunggal untuk menutup otomatis tiket manual (`bookingId == null`)
 * yang tidak aktif selama 24 jam. Dilebur ke dalam `autoCloseTickets.ts` agar tidak
 * ada dua penjadwal terpisah yang saling berpacu.
 */
export function startTicketCleanupJob(intervalMs = 30 * 60 * 1000) {
  return mulaiPenjadwalTiket(intervalMs);
}
