import { Router } from 'express';
import { adminNavCountsController } from '../../controller/adminNavCountsController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

export const adminNavCountsRouter: Router = Router();

adminNavCountsRouter.use(requireAuth);
adminNavCountsRouter.use(requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN));

adminNavCountsRouter.get('/', adminNavCountsController.getCounts);
