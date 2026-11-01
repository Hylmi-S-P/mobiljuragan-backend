import type { NextFunction, Request, Response } from 'express';
import { AppError, sendSuccess } from '../lib/response.js';
import { documentTemplateService } from '../lib/documentTemplateService.js';
import { KODE_FORM_KESANGGUPAN } from '../lib/documentTemplateDefault.js';

/** Nama berkas unduhan yang aman dipakai di semua sistem operasi. */
function namaBerkas(judul: string, versi: number, ekstensi: string): string {
  const bersih = judul
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return `${bersih || 'Dokumen'}_v${versi}.${ekstensi}`;
}

function kirimPdf(
  res: Response,
  buffer: Buffer,
  judul: string,
  versi: number,
  unduh: boolean,
): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${unduh ? 'attachment' : 'inline'}; filename="${namaBerkas(judul, versi, 'pdf')}"`,
  );
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

export const documentTemplateController = {
  /**
   * GET /api/v1/documents/form-kesanggupan.pdf
   *
   * Formulir kosong untuk diunduh pelanggan. Publik karena isinya belum memuat
   * data siapa pun, dan pelanggan perlu mencetaknya sebelum punya sesi.
   */
  async unduhFormulirKosong(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { buffer, judul, versi } = await documentTemplateService.buatPdf({});
      const unduh = req.query.unduh === '1' || req.query.unduh === 'true';
      kirimPdf(res, buffer, judul, versi, unduh);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/document-templates
   *
   * Daftar seluruh versi template untuk dashboard.
   */
  async daftar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kode = typeof req.query.kode === 'string' ? req.query.kode : KODE_FORM_KESANGGUPAN;
      const items = await documentTemplateService.daftarVersi(kode);
      sendSuccess(res, { items });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/document-templates/aktif
   *
   * Isi template yang sedang aktif, dipakai editor di dashboard.
   */
  async ambilAktif(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kode = typeof req.query.kode === 'string' ? req.query.kode : KODE_FORM_KESANGGUPAN;
      const template = await documentTemplateService.ambilAktif(kode);
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/document-templates/:id
   */
  async ambilSatu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await documentTemplateService.ambilSatu(req.params.id);
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/admin/document-templates
   *
   * Menyimpan isi sebagai versi baru dan langsung mengaktifkannya.
   */
  async simpan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
      }

      const { kode, judul, isi, catatan } = req.body as {
        kode?: string;
        judul?: string;
        isi: unknown;
        catatan?: string;
      };

      const template = await documentTemplateService.simpanVersiBaru({
        kode,
        judul,
        isi,
        catatan,
        oleh: user.fullName || user.userId,
      });

      sendSuccess(res, template, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/admin/document-templates/:id/aktifkan
   *
   * Mengembalikan versi lama menjadi aktif tanpa membuat versi baru.
   */
  async aktifkan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
      }

      const template = await documentTemplateService.aktifkanVersi(
        req.params.id,
        user.fullName || user.userId,
      );
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/document-templates/:id/preview.pdf
   *
   * Pratinjau PDF dari versi tertentu, supaya admin bisa memeriksa hasil cetak
   * sebelum mengaktifkannya.
   */
  async pratinjau(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { buffer, judul, versi } = await documentTemplateService.buatPdfVersi(req.params.id);
      kirimPdf(res, buffer, judul, versi, false);
    } catch (error) {
      next(error);
    }
  },
};
