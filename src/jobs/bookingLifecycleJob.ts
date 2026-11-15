import { bookingModel } from '../model/bookingModel.js';
import { driverModel } from '../model/driverModel.js';

/**
 * Penjadwal siklus hidup pesanan.
 *
 * Dua hal yang tidak bisa ditunggu admin:
 * - Pesanan yang dokumennya tidak kunjung diunggah harus dibatalkan, supaya
 *   armadanya tidak terus tersembunyi dari katalog.
 * - Sewa yang jadwalnya sudah lewat harus ditutup, supaya armadanya masuk masa
 *   pemeriksaan dan laporan tidak menahan pesanan di kolom "sewa berjalan".
 * - Tagihan yang lewat batas waktu bayar harus dibatalkan, supaya pesanan tidak
 *   menggantung di status CONFIRMED tanpa pembayaran.
 * - Armada yang tertinggal di status BOOKED tanpa pesanan aktif harus dilepas,
 *   supaya unit tidak menghilang dari katalog karena status yang tidak pernah
 *   diturunkan.
 *
 * Interval 5 menit dipilih karena semua tenggatnya dihitung dalam jam: selisih
 * paling jauh 5 menit tidak berarti bagi pelanggan, tetapi cukup rapat untuk
 * membuat katalog dan laporan cepat pulih.
 */
export function startBookingLifecycleJob(intervalMs = 5 * 60 * 1000) {
  const runSweep = async () => {
    try {
      const dibatalkan = await bookingModel.expireOverdueDocumentDeadlines();
      if (dibatalkan > 0) {
        // eslint-disable-next-line no-console
        console.log(`[BookingLifecycleJob] Dibatalkan otomatis: ${dibatalkan} pesanan.`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BookingLifecycleJob] Gagal menyapu tenggat dokumen:', error);
    }

    try {
      const tagihanKedaluwarsa = await bookingModel.expireOverduePayments();
      if (tagihanKedaluwarsa > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[BookingLifecycleJob] Tagihan kedaluwarsa dibatalkan: ${tagihanKedaluwarsa}.`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BookingLifecycleJob] Gagal menyapu tagihan kedaluwarsa:', error);
    }

    try {
      const tanpaTarif = await bookingModel.expireUnconfirmedBookings();
      if (tanpaTarif > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[BookingLifecycleJob] Permintaan tanpa tarif dibatalkan: ${tanpaTarif}.`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BookingLifecycleJob] Gagal menyapu permintaan tanpa tarif:', error);
    }

    try {
      const diselesaikan = await bookingModel.autoCompleteFinishedRentals();
      if (diselesaikan > 0) {
        // eslint-disable-next-line no-console
        console.log(`[BookingLifecycleJob] Diselesaikan otomatis: ${diselesaikan} pesanan.`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BookingLifecycleJob] Gagal menyelesaikan sewa yang lewat:', error);
    }

    try {
      const dilepas = await bookingModel.releaseOrphanedBookedVehicles();
      if (dilepas > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[BookingLifecycleJob] Armada tertahan BOOKED tanpa pesanan dilepas: ${dilepas} unit.`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BookingLifecycleJob] Gagal melepas armada BOOKED yatim:', error);
    }

    try {
      const supirDilepas = await driverModel.releaseOrphanedBusyDrivers();
      if (supirDilepas > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[BookingLifecycleJob] Supir tertahan SEDANG_TUGAS tanpa pesanan dilepas: ${supirDilepas} orang.`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[BookingLifecycleJob] Gagal melepas supir SEDANG_TUGAS yatim:', error);
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
