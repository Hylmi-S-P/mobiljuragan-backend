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

  /* Kesalahan multer: ukuran/jumlah berkas. Tanpa pemetaan ini, unggahan yang
     terlalu besar berakhir sebagai 500 dan pesannya tidak berguna bagi pengguna. */
  if (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'MulterError'
  ) {
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      sendError(res, 'FILE_TOO_LARGE', 'Ukuran berkas maksimal 5 MB.', 413);
      return;
    }
    if (code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE') {
      sendError(res, 'TOO_MANY_FILES', 'Maksimal 3 berkas: surat pernyataan, KTP, dan SIM.', 400);
      return;
    }
    sendError(res, 'UPLOAD_FAILED', 'Berkas tidak dapat diproses. Coba lagi.', 400);
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
