import { Router } from 'express';
import { paymentController } from '../../controller/paymentController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Rute Manajemen Pembayaran Admin Portal: /api/v1/admin/payments/*
 */
export const adminPaymentRouter: Router = Router();

// Seluruh endpoint admin pembayaran dibatasi khusus role STAFF dan ADMIN
adminPaymentRouter.use(requireAuth);
adminPaymentRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

// 1. Antrean Verifikasi Pembayaran (Tabs: ALL, PENDING_VERIFICATION, PAID, FAILED)
adminPaymentRouter.get('/', paymentController.adminListPayments);

// 2. Verifikasi Pembayaran (Persetujuan / Penolakan)
adminPaymentRouter.patch('/:id/verify', paymentController.adminVerifyPayment);

// 3. Shortcut Penolakan Pembayaran
adminPaymentRouter.patch('/:id/reject', paymentController.adminRejectPayment);
