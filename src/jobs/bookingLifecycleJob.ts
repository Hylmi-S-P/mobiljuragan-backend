import { bookingModel } from '../model/bookingModel.js';
import { driverModel } from '../model/driverModel.js';
import { logger } from '../logger.js';

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
  let isRunning = false;

  const runSweep = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      try {
        const dibatalkan = await bookingModel.expireOverdueDocumentDeadlines();
        if (dibatalkan > 0) {
          logger.info({ dibatalkan }, '[BookingLifecycleJob] Dibatalkan otomatis');
        }
      } catch (error) {
        logger.error({ error }, '[BookingLifecycleJob] Gagal menyapu tenggat dokumen');
      }

      try {
        const tagihanKedaluwarsa = await bookingModel.expireOverduePayments();
        if (tagihanKedaluwarsa > 0) {
          logger.info({ tagihanKedaluwarsa }, '[BookingLifecycleJob] Tagihan kedaluwarsa dibatalkan');
        }
      } catch (error) {
        logger.error({ error }, '[BookingLifecycleJob] Gagal menyapu tagihan kedaluwarsa');
      }

      try {
        const tanpaTarif = await bookingModel.expireUnconfirmedBookings();
        if (tanpaTarif > 0) {
          logger.info({ tanpaTarif }, '[BookingLifecycleJob] Permintaan tanpa tarif dibatalkan');
        }
      } catch (error) {
        logger.error({ error }, '[BookingLifecycleJob] Gagal menyapu permintaan tanpa tarif');
      }

      try {
        const diselesaikan = await bookingModel.autoCompleteFinishedRentals();
        if (diselesaikan > 0) {
          logger.info({ diselesaikan }, '[BookingLifecycleJob] Diselesaikan otomatis');
        }
      } catch (error) {
        logger.error({ error }, '[BookingLifecycleJob] Gagal menyelesaikan sewa yang lewat');
      }

      try {
        const dilepas = await bookingModel.releaseOrphanedBookedVehicles();
        if (dilepas > 0) {
          logger.info({ dilepas }, '[BookingLifecycleJob] Armada tertahan BOOKED tanpa pesanan dilepas');
        }
      } catch (error) {
        logger.error({ error }, '[BookingLifecycleJob] Gagal melepas armada BOOKED yatim');
      }

      try {
        const supirDilepas = await driverModel.releaseOrphanedBusyDrivers();
        if (supirDilepas > 0) {
          logger.info({ supirDilepas }, '[BookingLifecycleJob] Supir tertahan SEDANG_TUGAS tanpa pesanan dilepas');
        }
      } catch (error) {
        logger.error({ error }, '[BookingLifecycleJob] Gagal melepas supir SEDANG_TUGAS yatim');
      }
    } finally {
      isRunning = false;
    }
  };

  // Tunda sapuan pertama 20 detik agar boot server & koneksi awal tidak langsung terbebani.
  let initialTimer: NodeJS.Timeout | null = setTimeout(() => {
    initialTimer = null;
    void runSweep();
  }, 20_000);
  initialTimer.unref?.();

  const timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  timer.unref?.();

  return {
    stop() {
      if (initialTimer) {
        clearTimeout(initialTimer);
        initialTimer = null;
      }
      clearInterval(timer);
    },
  };
}
