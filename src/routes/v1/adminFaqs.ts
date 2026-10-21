import { Router } from 'express';
import { faqController } from '../../controller/faqController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { UserRole } from '../../generated/prisma/client.js';
import {
  createFaqSchema,
  listFaqQuerySchema,
  updateFaqSchema,
} from '../../validators/faqSchemas.js';

/**
 * Endpoint admin FAQ untuk manajemen portal:
 * /api/v1/admin/faqs/*
 */
export const adminFaqRouter: Router = Router();

adminFaqRouter.use(requireAuth);
adminFaqRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminFaqRouter.get('/', validateQuery(listFaqQuerySchema), faqController.listAdmin);
adminFaqRouter.post('/', validateBody(createFaqSchema), faqController.create);
adminFaqRouter.get('/:id', faqController.detail);
adminFaqRouter.put('/:id', validateBody(updateFaqSchema), faqController.update);
adminFaqRouter.patch('/:id', validateBody(updateFaqSchema), faqController.update);
adminFaqRouter.patch('/:id/toggle', faqController.toggle);
adminFaqRouter.delete('/:id', faqController.delete);
