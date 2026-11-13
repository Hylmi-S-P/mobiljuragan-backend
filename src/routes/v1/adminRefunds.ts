import { Router } from 'express';
import { UserRole } from '../../generated/prisma/client.js';
import { adminRefundController } from '../../controller/adminRefundController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

/**
 * Antrean pengembalian dana: /api/v1/admin/refunds/*
 *
 * Staf boleh melihat antrean supaya bisa menerima data rekening dari pelanggan,
 * tetapi hanya admin yang boleh mengubah nominal dan menutup barisnya.
 */
export const adminRefundRouter: Router = Router();

adminRefundRouter.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.STAFF));

adminRefundRouter.get('/', adminRefundController.list);
adminRefundRouter.get('/summary', adminRefundController.summary);
adminRefundRouter.patch('/:id', requireRole(UserRole.ADMIN), adminRefundController.update);
