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
 * Manajemen akun staf & admin: /api/v1/admin/users/*
 *
 * Rute ini sengaja dibatasi ADMIN saja. Sebelumnya STAFF ikut diizinkan, sehingga
 * staf operasional dapat mengganti sandi maupun peran akun admin lain — termasuk
 * menurunkan seluruh admin aktif. Staf tetap dapat mengelola FAQ, armada, supir,
 * dan tiket lewat router masing-masing.
 */
export const adminUserRouter: Router = Router();

adminUserRouter.use(requireAuth);
adminUserRouter.use(requireRole(UserRole.ADMIN));

adminUserRouter.get('/', adminUserController.list);
adminUserRouter.get('/:id', adminUserController.detail);
adminUserRouter.post('/', validateBody(createAdminSchema), adminUserController.create);
adminUserRouter.patch('/:id', validateBody(updateAdminSchema), adminUserController.update);
adminUserRouter.delete('/:id', adminUserController.remove);
