import { Router } from 'express';
import { faqController } from '../../controller/faqController.js';
import { validateQuery } from '../../middleware/validate.js';
import { listFaqQuerySchema } from '../../validators/faqSchemas.js';

/**
 * Endpoint publik FAQ untuk aplikasi mobile:
 * GET /api/v1/faqs
 */
export const faqRouter: Router = Router();

faqRouter.get('/', validateQuery(listFaqQuerySchema), faqController.listPublic);
