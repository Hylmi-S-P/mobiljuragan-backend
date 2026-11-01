import type { NextFunction, Request, Response } from 'express';
import { AppError, sendSuccess } from '../lib/response.js';
import { mediaStorage } from '../lib/mediaStorage.js';
import {
  ambilMedia,
  kategoriValid,
  mediaPublik,
  simpanMedia,
  tautanMedia,
  tautanSah,
  type KategoriMedia,
} from '../lib/mediaService.js';

export const mediaController = {
  /**
   * POST /api/v1/media
   *
   * Menerima satu berkas gambar lewat multipart, menormalkannya dengan sharp,
   * lalu menyimpannya. Balasannya berisi pengenal dan tautan siap pakai.
   */
  async unggah(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
      }

      const kategoriMentah = String(req.body?.kategori ?? '').toUpperCase();
      if (!kategoriValid(kategoriMentah)) {
        throw new AppError(
          'MEDIA_CATEGORY_INVALID',
          `Kategori media tidak dikenal. Pilihan yang sah: ${Object.keys({
            FLEET_PHOTO: 1,
            PAYMENT_PROOF: 1,
            KTP: 1,
            SIM: 1,
            STATEMENT_LETTER: 1,
            DRIVER_LICENSE: 1,
          }).join(', ')}.`,
          400,
        );
      }

      const file = req.file;
      if (!file) {
        throw new AppError(
          'FILE_REQUIRED',
          'Berkas gambar wajib disertakan pada field "file".',
          400,
        );
      }

      const media = await simpanMedia({
        file,
        kategori: kategoriMentah as KategoriMedia,
        ownerUserId: user.userId,
      });

      sendSuccess(
        res,
        {
          id: media.id,
          url: tautanMedia(media.id, media.kategori),
          kategori: media.kategori,
          mimeType: media.mimeType,
          byteSize: media.byteSize,
          width: media.width,
          height: media.height,
        },
        201,
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/media/:id
   *
   * Menyajikan isi berkas. Kategori publik boleh diakses siapa pun. Kategori
   * pribadi mensyaratkan tautan bertanda tangan yang sah, atau sesi staf/admin.
   */
  async sajikan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const media = await ambilMedia(id);

      if (!mediaPublik(media.kategori)) {
        const lewatTandaTangan = tautanSah({
          mediaId: media.id,
          exp: req.query.exp ? Number(req.query.exp) : undefined,
          sig: typeof req.query.sig === 'string' ? req.query.sig : undefined,
        });

        if (!lewatTandaTangan) {
          const user = req.user;
          const staf = user && (user.role === 'ADMIN' || user.role === 'STAFF');
          const pemilik = user && media.ownerUserId === user.userId;

          if (!staf && !pemilik) {
            throw new AppError(
              'FORBIDDEN',
              'Media ini bersifat pribadi. Gunakan tautan bertanda tangan yang sah.',
              403,
            );
          }
        }
      }

      const aliran = mediaStorage.aliran(media.objectKey);

      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Content-Length', media.byteSize);
      /* Berkas diberi nama dari hash, jadi isinya tidak akan berubah. */
      res.setHeader(
        'Cache-Control',
        mediaPublik(media.kategori) ? 'public, max-age=86400' : 'private, no-store',
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');

      aliran.on('error', () => {
        if (!res.headersSent) {
          next(
            new AppError('MEDIA_NOT_FOUND', 'Berkas media tidak ditemukan di penyimpanan.', 404),
          );
        } else {
          res.end();
        }
      });

      aliran.pipe(res);
    } catch (error) {
      next(error);
    }
  },
};
