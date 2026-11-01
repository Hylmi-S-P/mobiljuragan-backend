import { Router } from 'express';
import multer from 'multer';
import { documentController } from '../../controller/documentController.js';
import { requireAuth } from '../../middleware/auth.js';
import { MAX_UPLOAD_BYTES } from '../../services/upload/image-processing.js';

export const documentRouter = Router();

// Rute Publik & Unduhan Template Resmi
documentRouter.get(
  '/documents/template/surat-pernyataan-lepas-kunci.pdf',
  documentController.getStatementTemplatePdf,
);
documentRouter.get(
  '/documents/template/surat-pernyataan-lepas-kunci/text',
  documentController.getStatementTemplateText,
);

/* Unggahan multipart disimpan di memori: berkas langsung divalidasi isinya lalu
   dikonversi, sehingga tidak ada file mentah dari klien yang menyentuh disk. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 3 },
});

// Rute Dokumen Pemesanan Pelanggan
documentRouter.get('/bookings/:id/documents', documentController.getBookingDocuments);
documentRouter.post(
  '/bookings/:id/documents',
  upload.fields([
    { name: 'statementLetter', maxCount: 1 },
    { name: 'ktp', maxCount: 1 },
    { name: 'sim', maxCount: 1 },
  ]),
  documentController.uploadBookingDocuments,
);

// Pengambilan berkas dokumen (ber-otorisasi; bukan static publik).
documentRouter.get('/documents/file/:bookingId/:name', requireAuth, documentController.getStoredFile);
documentRouter.get('/bookings/:id/statement-pdf', documentController.getBookingStatementPdf);

// Rute Verifikasi Dokumen oleh Admin Portal
documentRouter.patch(
  '/admin/bookings/:id/documents/verify',
  documentController.adminVerifyDocuments,
);
