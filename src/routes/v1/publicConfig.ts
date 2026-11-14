import { Router } from 'express';
import { getDriverDailyRate } from '../../lib/tariff.js';
import { sendSuccess } from '../../lib/response.js';

/**
 * Pengaturan publik yang dibutuhkan aplikasi pelanggan sebelum memesan:
 * `/api/v1/config`
 *
 * Tarif jasa supir berlaku global dan bisa diubah admin. Aplikasi perlu
 * membacanya supaya angka perkiraan di layar pelanggan tidak dikarang sendiri
 * dan tidak berbeda dengan tagihan yang dihitung server.
 */
export const publicConfigRouter: Router = Router();

publicConfigRouter.get('/', async (_req, res, next) => {
  try {
    const driverDailyRate = await getDriverDailyRate();

    sendSuccess(res, {
      driverDailyRate,
      serviceHours: {
        openMinute: 6 * 60,
        closeMinute: 22 * 60,
        timezone: 'Asia/Jayapura',
      },
    });
  } catch (error) {
    next(error);
  }
});
