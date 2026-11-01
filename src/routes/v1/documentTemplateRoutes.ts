import { Router } from 'express';
import { documentTemplateController } from '../../controller/documentTemplateController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Template dokumen resmi.
 *
 * Bagian publik hanya satu: unduhan formulir kosong. Sisanya pengelolaan isi
 * yang menyentuh dokumen legal perusahaan, jadi dikunci ke ADMIN saja. Staf
 * tidak diberi akses karena mengubah klausul pernyataan bukan tugas harian
 * operasional.
 */
export const documentTemplateRouter: Router = Router();

// Publik: formulir kosong untuk dicetak pelanggan.
documentTemplateRouter.get(
  '/documents/form-kesanggupan.pdf',
  documentTemplateController.unduhFormulirKosong,
);

// Pengelolaan template: khusus ADMIN.
documentTemplateRouter.get(
  '/admin/document-templates',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.daftar,
);

documentTemplateRouter.get(
  '/admin/document-templates/aktif',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.ambilAktif,
);

documentTemplateRouter.get(
  '/admin/document-templates/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.ambilSatu,
);

documentTemplateRouter.get(
  '/admin/document-templates/:id/preview.pdf',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.pratinjau,
);

documentTemplateRouter.post(
  '/admin/document-templates',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.simpan,
);

documentTemplateRouter.post(
  '/admin/document-templates/:id/aktifkan',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.aktifkan,
);
