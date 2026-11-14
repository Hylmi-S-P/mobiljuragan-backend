import type { NextFunction, Request, Response } from 'express';
import type { Readable } from 'node:stream';

import { AppError, sendSuccess } from '../lib/response.js';
import { documentTemplateService } from '../lib/documentTemplateService.js';

/**
 * Menyalurkan berkas ke klien sebagai aliran.
 *
 * Galat baca hanya bisa dijawab sebagai 404 selama header belum terkirim.
 * Setelah itu satu-satunya jalan adalah menutup respons dengan rapi, supaya
 * klien tidak menggantung menunggu sisa berkas yang tidak akan datang.
 */
function salurkanBerkas(aliran: Readable, res: Response, next: NextFunction): void {
  aliran.on('error', () => {
    if (!res.headersSent) {
      next(new AppError('DOCUMENT_NOT_FOUND', 'Berkas dokumen tidak ditemukan.', 404));
    } else {
      res.end();
    }
  });

  /* Unduhan yang dibatalkan klien tidak boleh meninggalkan aliran sumber
     terbuka sampai seluruh berkas terkirim ke klien yang sudah pergi. */
  res.on('close', () => {
    if (!aliran.destroyed) aliran.destroy();
  });

  aliran.pipe(res);
}

/**
 * Controller template dokumen.
 *
 * Admin mengunggah berkas dokumen resmi (PDF atau Word), lalu pelanggan
 * mengunduh berkas yang sedang aktif. Tidak ada penyusunan isi di sisi
 * aplikasi: yang diunggah admin adalah yang dicetak dan ditandatangani.
 */
export const documentTemplateController = {
  /**
   * GET /api/v1/documents/form-kesanggupan
   *
   * Unduhan publik untuk pelanggan. Nama berkas mengikuti berkas asli dari
   * admin, supaya pelanggan menerima dokumen dengan nama yang dikenali.
   */
  async unduhFormulirKosong(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { template, aliran } = await documentTemplateService.aliranBerkasAktif();

      res.setHeader('Content-Type', template.berkasMime);
      res.setHeader('Content-Length', String(template.berkasByte));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${template.berkasNama}"; filename*=UTF-8''${encodeURIComponent(template.berkasNama)}`,
      );
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      /* Versi dokumen ikut dikirim supaya bisa ditelusuri dari sisi klien. */
      res.setHeader('X-Document-Version', String(template.versi));

      salurkanBerkas(aliran, res, next);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/document-templates/:id/berkas
   *
   * Berkas versi tertentu untuk dipratinjau admin. Dikirim `inline` supaya PDF
   * terbuka langsung di peramban, bukan terunduh.
   */
  async berkasVersi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { template, aliran } = await documentTemplateService.aliranBerkas(req.params.id);

      res.setHeader('Content-Type', template.berkasMime);
      res.setHeader('Content-Length', String(template.berkasByte));
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${template.berkasNama}"; filename*=UTF-8''${encodeURIComponent(template.berkasNama)}`,
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      salurkanBerkas(aliran, res, next);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/v1/admin/document-templates */
  async daftar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kode = typeof req.query.kode === 'string' ? req.query.kode : undefined;
      const items = await documentTemplateService.daftarVersi(kode);
      sendSuccess(res, { items, total: items.length });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/v1/admin/document-templates/aktif */
  async ambilAktif(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const aktif = await documentTemplateService.ambilAktif();
      sendSuccess(res, {
        id: aktif.id,
        kode: aktif.kode,
        judul: aktif.judul,
        versi: aktif.versi,
        berkasNama: aktif.berkasNama,
        berkasMime: aktif.berkasMime,
        berkasByte: aktif.berkasByte,
        catatan: aktif.catatan,
        dibuatOleh: aktif.dibuatOleh,
        createdAt: aktif.createdAt,
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/v1/admin/document-templates/:id */
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
   * Menerima unggahan multipart berisi `berkas` (wajib), `judul` dan `catatan`
   * (opsional). Berkas langsung menjadi versi baru yang aktif.
   */
  async unggah(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const berkas = req.file;

      if (!berkas) {
        throw new AppError(
          'DOCUMENT_REQUIRED',
          'Berkas dokumen wajib disertakan pada field "berkas".',
          400,
        );
      }

      const judul = typeof req.body?.judul === 'string' ? req.body.judul : undefined;
      const catatan = typeof req.body?.catatan === 'string' ? req.body.catatan : undefined;

      const tersimpan = await documentTemplateService.simpanVersiBaru({
        buffer: berkas.buffer,
        namaAsli: berkas.originalname,
        judul,
        catatan,
        aktor: req.user?.fullName ?? req.user?.userId,
      });

      sendSuccess(
        res,
        {
          id: tersimpan.id,
          judul: tersimpan.judul,
          versi: tersimpan.versi,
          berkasNama: tersimpan.berkasNama,
          berkasMime: tersimpan.berkasMime,
          berkasByte: tersimpan.berkasByte,
          isActive: tersimpan.isActive,
        },
        201,
      );
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/v1/admin/document-templates/:id/aktifkan */
  async aktifkan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await documentTemplateService.aktifkanVersi(
        req.params.id,
        req.user?.fullName ?? undefined,
      );

      sendSuccess(res, {
        id: template.id,
        judul: template.judul,
        versi: template.versi,
        berkasNama: template.berkasNama,
        isActive: template.isActive,
      });
    } catch (error) {
      next(error);
    }
  },
};
