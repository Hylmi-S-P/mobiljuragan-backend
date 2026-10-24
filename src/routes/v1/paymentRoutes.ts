import { Router } from 'express';
import { paymentController } from '../../controller/paymentController.js';
import { optionalAuth } from '../../middleware/auth.js';

/**
 * Rute Pemrosesan Pembayaran Pelanggan: /api/v1/payments/*
 *
 * Verifikasi dana masuk TIDAK ditangani sistem. Webhook mutasi dan simulasi
 * mutasi sudah dicabut: satu-satunya jalur yang boleh menandai pembayaran
 * lunas adalah admin lewat PATCH /api/v1/admin/payments/:id/verify.
 */
export const paymentRouter: Router = Router();

// 1. Pembuatan Tagihan Pembayaran
paymentRouter.post('/', optionalAuth, paymentController.createPayment);

// 2. Cek Status Pembayaran via Booking ID / Kode Booking
paymentRouter.get('/booking/:bookingId', optionalAuth, paymentController.getPaymentByBookingId);

// 3. Cek Detail Pembayaran via Payment ID
paymentRouter.get('/:id', optionalAuth, paymentController.getPaymentById);

// 4. Unggah Bukti Transfer Bank
paymentRouter.post('/:id/proof', optionalAuth, paymentController.uploadPaymentProof);
