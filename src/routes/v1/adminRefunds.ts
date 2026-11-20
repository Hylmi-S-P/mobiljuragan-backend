import { Router } from 'express';
import { UserRole } from '../../generated/prisma/client.js';
import { adminRefundController } from '../../controller/adminRefundController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

/**
 * Antrean pengembalian dana: /api/v1/admin/refunds/*
 *
 * Admin dan staf operasional dapat melihat antrean maupun memproses pengembalian dana.
 */
export const adminRefundRouter: Router = Router();

adminRefundRouter.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.STAFF));

adminRefundRouter.get('/', adminRefundController.list);
adminRefundRouter.get('/summary', adminRefundController.summary);
adminRefundRouter.patch('/:id', adminRefundController.update);
