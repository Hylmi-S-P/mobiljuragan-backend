import { Router } from 'express';
import { DEFAULT_PICKUP_POINT_ID, PICKUP_POINTS } from '../../lib/pickupPoints.js';
import { sendSuccess } from '../../lib/response.js';

/**
 * Titik serah terima resmi: /api/v1/pickup-points
 *
 * Dipakai mobile (pilihan titik jemput) dan dashboard (label pesanan), supaya
 * keduanya membaca daftar yang sama dan tidak ada label yang dikarang klien.
 */
export const pickupPointRouter: Router = Router();

pickupPointRouter.get('/', (_req, res) => {
  sendSuccess(res, {
    defaultId: DEFAULT_PICKUP_POINT_ID,
    items: PICKUP_POINTS,
  });
});
