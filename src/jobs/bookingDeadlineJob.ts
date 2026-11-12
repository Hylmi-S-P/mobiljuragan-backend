import { bookingModel } from '../model/bookingModel.js';

/**
 * Penjadwal tenggat unggah dokumen.
 *
 * Pesanan yang berkasnya tidak kunjung diunggah sampai batas waktu dibatalkan
 * otomatis, supaya armada tidak terus-terusan tersembunyi dari katalog oleh
 * pesanan yang ditinggalkan.
 *
 * Interval 5 menit dipilih karena tenggatnya dihitung dalam jam: selisih paling
 * jauh 5 menit tidak berarti bagi pelanggan, tetapi cukup rapat untuk membuat
 * katalog cepat pulih.
 */
export function startBookingDeadlineJob(intervalMs = 5 * 60 * 1000) {
  const runSweep = async () => {
    try {
      const dibatalkan = await bookingModel.expireOverdueDocumentDeadlines();
      if (dibatalkan > 0) {
        // eslint-disable-next-line no-console
        console.log(`[BookingDeadlineJob] Dibatalkan otomatis: ${dibatalkan} pesanan.`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BookingDeadlineJob] Gagal menyapu tenggat dokumen:', error);
    }
  };

  // Jalankan sekali saat startup supaya pesanan yang kedaluwarsa selama server mati ikut dibereskan.
  runSweep();

  const timer = setInterval(runSweep, intervalMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
