import { Router } from 'express';
import { adminDriverController } from '../../controller/adminDriverController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { UserRole } from '../../generated/prisma/client.js';
import {
  createDriverSchema,
  listQuerySchema,
  readinessSchema,
  updateDriverSchema,
} from '../../validators/driverSchemas.js';

/**
 * Admin Driver Roster: /api/v1/admin/drivers/*
 */
export const adminDriverRouter: Router = Router();

adminDriverRouter.use(requireAuth);
adminDriverRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminDriverRouter.get('/', validateQuery(listQuerySchema), adminDriverController.list);
adminDriverRouter.post('/', validateBody(createDriverSchema), adminDriverController.create);
adminDriverRouter.get('/:id', adminDriverController.detail);
adminDriverRouter.patch('/:id', validateBody(updateDriverSchema), adminDriverController.update);
adminDriverRouter.patch('/:id/readiness', validateBody(readinessSchema), adminDriverController.updateReadiness);
adminDriverRouter.delete('/:id', adminDriverController.deactivate);