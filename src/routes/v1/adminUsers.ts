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
 */
export const adminUserRouter: Router = Router();

// Seluruh rute manajemen admin membutuhkan autentikasi staf/admin
adminUserRouter.use(requireAuth);
adminUserRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminUserRouter.get('/', adminUserController.list);
adminUserRouter.get('/:id', adminUserController.detail);
adminUserRouter.post('/', validateBody(createAdminSchema), adminUserController.create);
adminUserRouter.patch('/:id', validateBody(updateAdminSchema), adminUserController.update);
adminUserRouter.delete('/:id', adminUserController.remove);