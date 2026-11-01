import { Router } from 'express';
import { documentTemplateController } from '../../controller/documentTemplateController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';
import { unggahSatuDokumen } from '../../lib/documentTemplateBerkas.js';

/**
 * Template dokumen resmi.
 *
 * Bagian publik hanya unduhan dokumen, karena pelanggan perlu mengambilnya
 * tanpa akun. Sisanya pengelolaan dokumen legal perusahaan, jadi dikunci ke
 * ADMIN saja. Staf tidak diberi akses karena mengganti dokumen resmi bukan
 * tugas harian operasional.
 */
export const documentTemplateRouter: Router = Router();

/*
 * Unduhan publik. Dua jalur menuju berkas yang sama: yang pertama jalur resmi,
 * yang kedua dipertahankan karena aplikasi mobile yang sudah beredar memakai
 * alamat itu. Keduanya menyajikan dokumen aktif apa adanya, termasuk bila
 * admin mengunggah berkas Word.
 */
documentTemplateRouter.get(
  '/documents/form-kesanggupan',
  documentTemplateController.unduhFormulirKosong,
);

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
  '/admin/document-templates/:id/berkas',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.berkasVersi,
);

documentTemplateRouter.get(
  '/admin/document-templates/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.ambilSatu,
);

documentTemplateRouter.post(
  '/admin/document-templates',
  requireAuth,
  requireRole(UserRole.ADMIN),
  unggahSatuDokumen('berkas'),
  documentTemplateController.unggah,
);

documentTemplateRouter.post(
  '/admin/document-templates/:id/aktifkan',
  requireAuth,
  requireRole(UserRole.ADMIN),
  documentTemplateController.aktifkan,
);
