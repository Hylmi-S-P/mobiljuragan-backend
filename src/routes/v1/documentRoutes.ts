import { Router } from 'express';
import { documentController } from '../../controller/documentController.js';

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

// Rute Dokumen Pemesanan Pelanggan
documentRouter.get('/bookings/:id/documents', documentController.getBookingDocuments);
documentRouter.post('/bookings/:id/documents', documentController.uploadBookingDocuments);

// Rute Verifikasi Dokumen oleh Admin Portal
documentRouter.patch(
  '/admin/bookings/:id/documents/verify',
  documentController.adminVerifyDocuments,
);
