import { Router } from 'express';
import {
  adminUserController,
  createAdminSchema,
  updateAdminSchema,
} from '../../controller/adminUserController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Manajemen akun admin & super admin: /api/v1/admin/users/*
 *
 * Rute ini sengaja dibatasi SUPER_ADMIN saja. Sebelumnya ADMIN operasional ikut
 * diizinkan, padahal manajemen akun bisa mengganti sandi maupun hak akses akun lain.
 */
export const adminUserRouter: Router = Router();

adminUserRouter.use(requireAuth);
adminUserRouter.use(requireRole(UserRole.SUPER_ADMIN));

adminUserRouter.get('/', adminUserController.list);
adminUserRouter.get('/:id', adminUserController.detail);
adminUserRouter.post('/', validateBody(createAdminSchema), adminUserController.create);
adminUserRouter.patch('/:id', validateBody(updateAdminSchema), adminUserController.update);
adminUserRouter.delete('/:id', adminUserController.remove);
