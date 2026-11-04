import { Router } from 'express';
import multer from 'multer';
import { documentController } from '../../controller/documentController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';
import { MAX_UPLOAD_BYTES } from '../../services/upload/image-processing.js';

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
 * Unggahan multipart disimpan di memori: berkas langsung divalidasi isinya lalu
 * dikonversi, sehingga tidak ada file mentah dari klien yang menyentuh disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 3 },
});

/*
 * Dokumen pemesanan memuat e-KTP, SIM, dan surat pernyataan bertanda tangan.
 * Itu data pribadi, jadi setiap rute wajib punya sesi, dan service memeriksa
 * apakah pelanggan yang meminta memang pemilik pemesanan tersebut.
 *
 * Unggahan menerima multipart/form-data (klien baru). Bentuk JSON Base64 lama
 * tetap diterima controller-nya supaya APK yang sudah beredar tidak rusak.
 */
documentRouter.get('/bookings/:id/documents', requireAuth, documentController.getBookingDocuments);
documentRouter.post(
  '/bookings/:id/documents',
  requireAuth,
  upload.fields([
    { name: 'statementLetter', maxCount: 1 },
    { name: 'ktp', maxCount: 1 },
    { name: 'sim', maxCount: 1 },
  ]),
  documentController.uploadBookingDocuments,
);

// Pengambilan berkas dokumen (ber-otorisasi; bukan static publik).
documentRouter.get('/documents/file/:bookingId/:name', requireAuth, documentController.getStoredFile);

// Verifikasi dokumen hanya untuk staf dan admin.
documentRouter.patch(
  '/admin/bookings/:id/documents/verify',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  documentController.adminVerifyDocuments,
);
