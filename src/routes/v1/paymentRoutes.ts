import { Router } from 'express';
import { paymentController } from '../../controller/paymentController.js';
import { optionalAuth } from '../../middleware/auth.js';

/**
 * Rute Pemrosesan Pembayaran Pelanggan & Webhook: /api/v1/payments/*
 */
export const paymentRouter: Router = Router();

// 1. Webhook Mutasi Rekening (Publik, terproteksi header X-Webhook-Secret)
paymentRouter.post('/webhook/mutation', paymentController.handleWebhookMutation);

// 2. Simulasi Mutasi Rekening (Lokal & E2E Test)
paymentRouter.post('/simulate-mutation', paymentController.simulateMutation);

// 3. Pembuatan Tagihan Pembayaran
paymentRouter.post('/', optionalAuth, paymentController.createPayment);

// 4. Cek Status Pembayaran via Booking ID / Kode Booking
paymentRouter.get('/booking/:bookingId', optionalAuth, paymentController.getPaymentByBookingId);

// 5. Cek Detail Pembayaran via Payment ID
paymentRouter.get('/:id', optionalAuth, paymentController.getPaymentById);

// 6. Unggah Bukti Transfer Bank
paymentRouter.post('/:id/proof', optionalAuth, paymentController.uploadPaymentProof);
