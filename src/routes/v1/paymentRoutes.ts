import { Router } from 'express';
import { paymentController } from '../../controller/paymentController.js';
import { requireAuth } from '../../middleware/auth.js';

/**
 * Rute Pemrosesan Pembayaran Pelanggan: /api/v1/payments/*
 *
 * Verifikasi dana masuk TIDAK ditangani sistem. Webhook mutasi dan simulasi
 * mutasi sudah dicabut: satu-satunya jalur yang boleh menandai pembayaran
 * lunas adalah admin lewat PATCH /api/v1/admin/payments/:id/verify.
 *
 * Seluruh rute di sini menyentuh uang atau data rekening pelanggan, jadi wajib
 * punya sesi. Sebelumnya memakai `optionalAuth`, sehingga siapa pun yang tahu
 * ID pembayaran bisa membaca atau menimpa bukti transfer orang lain.
 */
export const paymentRouter: Router = Router();

/*
 * Penjaga dipasang per rute, bukan lewat `use()`, supaya path yang memang tidak
 * ada tetap menjawab 404 dan bukan 401. Kalau seluruh prefix dijaga, pemeriksaan
 * "endpoint sudah dicabut" jadi tidak bisa dibedakan dari "belum login".
 */

// 1. Pembuatan Tagihan Pembayaran
paymentRouter.post('/', requireAuth, paymentController.createPayment);

// 2. Cek Status Pembayaran via Booking ID / Kode Booking
paymentRouter.get('/booking/:bookingId', requireAuth, paymentController.getPaymentByBookingId);

// 3. Cek Detail Pembayaran via Payment ID
paymentRouter.get('/:id', requireAuth, paymentController.getPaymentById);

// 4. Unggah Bukti Transfer Bank
paymentRouter.post('/:id/proof', requireAuth, paymentController.uploadPaymentProof);
