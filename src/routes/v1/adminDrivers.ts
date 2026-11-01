import { Router } from 'express';
import { adminDriverController } from '../../controller/adminDriverController.js';
import { unggahSatuGambar } from '../../lib/imagePipeline.js';
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
 * Roster supir: /api/v1/admin/drivers/*
 */
export const adminDriverRouter: Router = Router();

adminDriverRouter.use(requireAuth);
adminDriverRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminDriverRouter.get('/', validateQuery(listQuerySchema), adminDriverController.list);
adminDriverRouter.post('/', validateBody(createDriverSchema), adminDriverController.create);
adminDriverRouter.get('/:id', adminDriverController.detail);
adminDriverRouter.patch('/:id', validateBody(updateDriverSchema), adminDriverController.update);

/**
 * Unggah foto SIM sebagai berkas, bukan Base64 di dalam JSON.
 *
 * Field-nya `file`, sama seperti unggah foto armada. Middleware multer menolak
 * berkas di atas 8 MB dan selain JPEG/PNG/WebP sebelum isinya menyentuh sharp,
 * jadi permintaan yang jelas salah tidak perlu di-decode lebih dulu.
 *
 * Didaftarkan SEBELUM `/:id` yang lebih umum tidak diperlukan karena metode dan
 * jalurnya berbeda, tetapi urutannya tetap dijaga agar tidak tertukar dengan
 * rute lain yang memakai pola serupa.
 */
adminDriverRouter.post(
  '/:id/photo',
  unggahSatuGambar('file'),
  adminDriverController.unggahFotoSim,
);

adminDriverRouter.patch(
  '/:id/readiness',
  validateBody(readinessSchema),
  adminDriverController.updateReadiness,
);
adminDriverRouter.delete('/:id', adminDriverController.deactivate);
