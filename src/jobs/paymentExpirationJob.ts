import { paymentService } from '../services/payment.service.js';

/**
 * Worker periodik untuk membatalkan otomatis tagihan UNPAID yang telah melewati
 * batas waktu pembayaran 12 jam (expiresAt) serta membatalkan pesanan sewa terkait.
 */
export function startPaymentExpirationJob(intervalMs = 5 * 60 * 1000) {
  const runCleanup = async () => {
    try {
      const expiredCount = await paymentService.expireOverduePayments();
      if (expiredCount > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[PaymentExpirationJob] Auto-cancelled ${expiredCount} overdue payments (> 12 hours).`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[PaymentExpirationJob] Error checking expired payments:', error);
    }
  };

  // Jalankan sekali saat startup
  runCleanup();

  // Jalankan berulang secara periodik
  const timer = setInterval(runCleanup, intervalMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
