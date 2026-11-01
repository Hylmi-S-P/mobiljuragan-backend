import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, sendError } from '../lib/response.js';
import { logger } from '../logger.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'body';
      if (!details[key]) {
        details[key] = [];
      }
      details[key].push(issue.message);
    }
    sendError(res, 'VALIDATION_ERROR', 'Format data tidak valid.', 400, details);
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 'INVALID_JSON', 'Payload JSON tidak valid.', 400);
    return;
  }

  /* Body melebihi batas. Sebelumnya ini jatuh ke 500 "terjadi kesalahan pada
     server", padahal penyebabnya jelas: berkas yang dikirim terlalu besar.
     Tanpa penanganan ini, pengguna tidak tahu apa yang harus diperbaiki. */
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    sendError(
      res,
      'PAYLOAD_TOO_LARGE',
      'Berkas yang dikirim terlalu besar. Foto maksimal 5 MB.',
      413,
    );
    return;
  }

  /*
   * Batas ukuran dari multer. Tanpa penanganan ini, mengunggah berkas yang
   * terlalu besar berakhir sebagai 500 "terjadi kesalahan pada server", padahal
   * penyebabnya jelas dan bisa diperbaiki pengguna: berkasnya kebesaran.
   *
   * Pesannya menyebut batas yang berlaku untuk jalur yang sedang dipakai,
   * karena foto dan dokumen punya batas berbeda.
   */
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const kode = (err as { code?: string }).code;

    if (kode === 'LIMIT_FILE_SIZE') {
      const batasDokumen = req.path.includes('/document-templates');
      sendError(
        res,
        'FILE_TOO_LARGE',
        batasDokumen
          ? 'Ukuran dokumen melebihi batas 15 MB.'
          : 'Ukuran berkas melebihi batas yang diizinkan.',
        413,
      );
      return;
    }

    if (kode === 'LIMIT_FILE_COUNT' || kode === 'LIMIT_UNEXPECTED_FILE') {
      sendError(res, 'FILE_NOT_ALLOWED', 'Hanya satu berkas yang boleh diunggah.', 400);
      return;
    }
  }

  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
    },
    'Unhandled server error occurred',
  );

  sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.',
    500,
  );
}
