import type { NextFunction, Request, Response } from 'express';
import { documentService } from '../services/document.service.js';
import { fileStorage } from '../services/storage/local-storage.js';
import { decodeLegacyDataUrl, processAndStoreImage } from '../services/upload/image-processing.js';
import { sendSuccess, AppError } from '../lib/response.js';
import { documentTemplateService } from '../lib/documentTemplateService.js';
import {
  requestDocumentRevisionSchema,
  verifyDocumentsSchema,
} from '../validators/documentSchemas.js';
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
      const { template, isi } = await documentTemplateService.bacaBerkasAktif();

      res.setHeader('Content-Type', template.berkasMime);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${template.berkasNama}"; filename*=UTF-8''${encodeURIComponent(template.berkasNama)}`,
      );
      res.setHeader('X-Document-Title', encodeURIComponent(template.judul));
      res.setHeader('X-Document-Version', String(template.versi));
      res.setHeader('Content-Length', String(isi.length));
      res.end(isi);
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
      const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
      const body = (req.body ?? {}) as Record<string, string | undefined>;

      /* Dua bentuk diterima selama masa peralihan:
         1) multipart/form-data (klien baru) — field statementLetter, ktp, sim
         2) JSON data URL base64 (klien lama) — tetap diproses dan dikonversi,
            sehingga tidak ada unggahan yang hilang saat rilis bertahap. */
      const pickFile = (field: string): Buffer | null => {
        const uploaded = files[field]?.[0];
        if (uploaded?.buffer) return uploaded.buffer;
        const legacy = body[field];
        return legacy ? decodeLegacyDataUrl(legacy) ?? Buffer.from(legacy, 'base64') : null;
      };

      const statementLetter = pickFile('statementLetter');
      const ktp = pickFile('ktp');
      const sim = pickFile('sim');

      if (!statementLetter && !ktp && !sim) {
        throw new AppError(
          'INVALID_INPUT',
          'Setidaknya salah satu dokumen (surat pernyataan, KTP, atau SIM) harus disertakan.',
          400,
        );
      }

      /* Folder penyimpanan memakai id kanonik booking, bukan parameter mentah,
         supaya unggahan lewat kode (mobile) dan lewat id (portal) menuju folder
         yang sama. */
      const bookingRef = await documentService.resolveBookingRef(id);
      const prefix = bookingRef.id;

      /*
       * Diproses satu per satu, bukan Promise.all. Tiga gambar berukuran besar
       * yang di-decode bersamaan bisa memakan ratusan megabita RAM sekaligus;
       * berurutan membuat puncak memori hanya sebesar satu gambar.
       */
      let statementLetterUrl: string | undefined;
      let ktpUrl: string | undefined;
      let simUrl: string | undefined;

      if (statementLetter) {
        statementLetterUrl = await processAndStoreImage(statementLetter, { prefix });
      }
      if (ktp) {
        ktpUrl = await processAndStoreImage(ktp, { prefix });
      }
      if (sim) {
        simUrl = await processAndStoreImage(sim, { prefix });
      }

      const result = await documentService.uploadBookingDocuments(
        id,
        { statementLetterUrl, ktpUrl, simUrl },
        actorOf(req),
      );

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mengambil berkas dokumen yang tersimpan di storage.
   * GET /api/v1/documents/file/<key>
   *
   * Bukan static publik: dokumen memuat KTP/SIM, jadi akses diperiksa dulu.
   */
  async getStoredFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bookingFolder = req.params.bookingId;
      const name = req.params.name;
      const key = `${bookingFolder}/${name}`;

      if (!bookingFolder || !name || key.includes('..')) {
        throw new AppError('INVALID_FILE_PATH', 'Nama berkas tidak valid.', 400);
      }

      const user = req.user;
      if (!user) {
        throw new AppError('UNAUTHORIZED', 'Anda harus masuk untuk mengakses berkas ini.', 401);
      }

      /* Pelanggan hanya boleh membuka berkas miliknya sendiri; staf/admin bebas
         selama berkasnya ada. Kepemilikan diperiksa dari path yang memuat id
         booking, bukan dari parameter yang bisa dipalsukan klien. */
      if (user.role === 'CUSTOMER') {
        const owns = await documentService.isFileOwnedByCustomer(key, user.userId);
        if (!owns) {
          throw new AppError('FORBIDDEN', 'Berkas ini bukan milik pesanan Anda.', 403);
        }
      }

      /*
       * Disajikan sebagai aliran, bukan `get()` lalu `res.send(buffer)`.
       * Dokumen bisa berukuran beberapa megabita dan dibuka berulang oleh staf;
       * menyalin seluruh isi ke RAM untuk setiap permintaan tidak perlu.
       */
      const aliran = await fileStorage.getStream(key);
      res.setHeader('Content-Type', 'image/webp');
      /* Berkas selalu WebP hasil normalisasi server, jadi tidak ada HTML/SVG
         yang bisa dieksekusi. `nosniff` memastikan browser tidak menebak lain. */
      res.setHeader('X-Content-Type-Options', 'nosniff');
      /* `no-store`, bukan `max-age`. Dokumen ini KTP/SIM: kalau di-cache, orang
         berikutnya yang memakai komputer kantor yang sama bisa membukanya dari
         cache peramban tanpa melewati pemeriksaan sesi di server. */
      res.setHeader('Cache-Control', 'private, no-store');

      aliran.on('error', () => {
        if (!res.headersSent) {
          next(new AppError('FILE_NOT_FOUND', 'Berkas dokumen tidak ditemukan.', 404));
        } else {
          res.end();
        }
      });

      aliran.pipe(res);
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
      const { action, rejectionReason, targets } = verifyDocumentsSchema.parse(req.body);

      const verifierName = req.user?.fullName || 'Admin MobilJuragan';
      const result = await documentService.adminVerifyDocuments(id, {
        action,
        rejectionReason,
        targets,
        verifierName,
      });

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Meminta pelanggan mengunggah ulang berkas tertentu.
   *
   * POST /api/v1/admin/bookings/:id/documents/request-revision
   *
   * Endpoint terpisah dari verifikasi karena artinya berbeda bagi staf: di sini
   * staf tidak "menolak dokumen" sebagai keputusan akhir, melainkan menuliskan
   * apa yang harus diperbaiki. Bentuk masukannya memakai `catatan` (bukan
   * `rejectionReason`) supaya tidak ada kebingungan dengan aksi tolak.
   */
  async requestDocumentRevision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { catatan, targets, semuaBerkas } = requestDocumentRevisionSchema.parse(req.body);

      const verifierName = req.user?.fullName || 'Admin MobilJuragan';
      const result = await documentService.adminVerifyDocuments(id, {
        action: 'REJECT',
        rejectionReason: catatan,
        targets: semuaBerkas
          ? ['KTP', 'SIM', 'STATEMENT']
          : targets,
        verifierName,
      });

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },
};
