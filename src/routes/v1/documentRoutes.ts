import { Router } from 'express';
import { documentController } from '../../controller/documentController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

export const documentRouter = Router();

/*
 * Template kosong boleh publik: isinya formulir belum terisi dan tidak memuat
 * data siapa pun. Pelanggan perlu mengunduhnya sebelum punya sesi aktif.
 */
documentRouter.get(
  '/documents/template/surat-pernyataan-lepas-kunci.pdf',
  documentController.getStatementTemplatePdf,
);
documentRouter.get(
  '/documents/template/surat-pernyataan-lepas-kunci/text',
  documentController.getStatementTemplateText,
);

/*
 * Dokumen pemesanan memuat e-KTP, SIM, dan surat pernyataan bertanda tangan.
 * Itu data pribadi, jadi setiap rute wajib punya sesi, dan service memeriksa
 * apakah pelanggan yang meminta memang pemilik pemesanan tersebut.
 */
documentRouter.get('/bookings/:id/documents', requireAuth, documentController.getBookingDocuments);
documentRouter.post(
  '/bookings/:id/documents',
  requireAuth,
  documentController.uploadBookingDocuments,
);

// Verifikasi dokumen hanya untuk staf dan admin.
documentRouter.patch(
  '/admin/bookings/:id/documents/verify',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  documentController.adminVerifyDocuments,
);
