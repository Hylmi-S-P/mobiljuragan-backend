import type { NextFunction, Request, Response } from 'express';
import { documentService } from '../services/document.service.js';
import { sendSuccess, AppError } from '../lib/response.js';

export const documentController = {
  /**
   * Mengunduh berkas template surat pernyataan resmi dalam format PDF standar.
   * GET /api/v1/documents/template/surat-pernyataan-lepas-kunci.pdf
   */
  async getStatementTemplatePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pdfBuffer = documentService.getStatementTemplatePdfBuffer();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="Surat_Pernyataan_Sewa_Lepas_Kunci_MobilJuragan.pdf"',
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mengunduh berkas surat pernyataan yang sudah terisi otomatis data reservasi pemesan.
   * GET /api/v1/bookings/:id/statement-pdf
   */
  async getBookingStatementPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { buffer, bookingCode } = await documentService.getBookingStatementPdfBuffer(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="Surat_Pernyataan_Lepas_Kunci_${bookingCode}.pdf"`,
      );
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mengambil struktur teks pernyataan untuk pratinjau in-app pada mobile app.
   * GET /api/v1/documents/template/surat-pernyataan-lepas-kunci/text
   */
  async getStatementTemplateText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = documentService.getStatementTemplateText();
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mengambil dokumen yang terikat pada suatu booking.
   * GET /api/v1/bookings/:id/documents
   */
  async getBookingDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = await documentService.getBookingDocuments(id);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Pelanggan mengunggah dokumen persyaratan lepas kunci.
   * POST /api/v1/bookings/:id/documents
   */
  async uploadBookingDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { statementLetterUrl, ktpUrl, simUrl } = req.body;

      if (!statementLetterUrl && !ktpUrl && !simUrl) {
        throw new AppError(
          'INVALID_INPUT',
          'Setidaknya salah satu dokumen (surat pernyataan, KTP, atau SIM) harus disertakan.',
          400,
        );
      }

      const result = await documentService.uploadBookingDocuments(id, {
        statementLetterUrl,
        ktpUrl,
        simUrl,
      });

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin portal memverifikasi kelayakan dokumen sewa lepas kunci.
   * PATCH /api/v1/admin/bookings/:id/documents/verify
   */
  async adminVerifyDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { action, rejectionReason } = req.body;

      if (action !== 'APPROVE' && action !== 'REJECT') {
        throw new AppError(
          'INVALID_ACTION',
          'Aksi verifikasi harus bernilai APPROVE atau REJECT.',
          400,
        );
      }

      const verifierName = req.user?.fullName || 'Admin MobilJuragan';
      const result = await documentService.adminVerifyDocuments(id, {
        action,
        rejectionReason,
        verifierName,
      });

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },
};
