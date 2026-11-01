import type { NextFunction, Request, Response } from 'express';
import { documentService } from '../services/document.service.js';
import { sendSuccess, AppError } from '../lib/response.js';
import { documentTemplateService } from '../lib/documentTemplateService.js';
import type { UserRole } from '../generated/prisma/client.js';

/** Identitas pemanggil setelah `requireAuth` lolos. */
type Actor = { userId: string; role: UserRole };

function actorOf(req: Request): Actor {
  const user = req.user;
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
  }
  return { userId: user.userId, role: user.role };
}

export const documentController = {
  /**
   * Mengunduh berkas template surat pernyataan resmi dalam format PDF standar.
   * GET /api/v1/documents/template/surat-pernyataan-lepas-kunci.pdf
   *
   * Alamat lama dipertahankan supaya APK yang sudah beredar tidak langsung
   * rusak. Isinya sekarang diambil dari template aktif di database.
   */
  async getStatementTemplatePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { buffer, judul, versi } = await documentTemplateService.buatPdf({});

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Form_Kesanggupan_v${versi}.pdf"`);
      res.setHeader('X-Document-Title', encodeURIComponent(judul));
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
      const data = await documentService.getStatementTemplateText();
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mengambil dokumen yang terikat pada suatu booking.
   * GET /api/v1/bookings/:id/documents
   *
   * Pemilik pemesanan atau staf/admin. Pelanggan lain ditolak 403.
   */
  async getBookingDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = await documentService.getBookingDocuments(id, actorOf(req));
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

      const result = await documentService.uploadBookingDocuments(
        id,
        {
          statementLetterUrl,
          ktpUrl,
          simUrl,
        },
        actorOf(req),
      );

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
