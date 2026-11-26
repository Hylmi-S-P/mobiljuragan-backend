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

  /*
   * Kesalahan multer / unggahan berkas (ukuran, jumlah, atau field tidak sesuai).
   * Disatukan agar pesan batas ukuran membedakan rute template dokumen (15 MB)
   * dengan rute gambar/dokumen umum (5 MB), termasuk saat err.name === 'MulterError',
   * sekaligus mempertahankan pesan jumlah berkas per rute (multi-berkas vs tunggal).
   */
  const isMulterError =
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'MulterError';
  const uploadErrorCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: string }).code
      : undefined;

  if (
    isMulterError ||
    uploadErrorCode === 'LIMIT_FILE_SIZE' ||
    uploadErrorCode === 'LIMIT_FILE_COUNT' ||
    uploadErrorCode === 'LIMIT_UNEXPECTED_FILE'
  ) {
    if (uploadErrorCode === 'LIMIT_FILE_SIZE') {
      const batasDokumen = req.path.includes('/document-templates');
      sendError(
        res,
        'FILE_TOO_LARGE',
        batasDokumen
          ? 'Ukuran dokumen melebihi batas 15 MB.'
          : 'Ukuran berkas maksimal 5 MB.',
        413,
      );
      return;
    }

    if (uploadErrorCode === 'LIMIT_FILE_COUNT' || uploadErrorCode === 'LIMIT_UNEXPECTED_FILE') {
      const isBookingDocuments = /\/bookings\/[^/]+\/documents/.test(req.path);
      if (isBookingDocuments) {
        sendError(res, 'TOO_MANY_FILES', 'Maksimal 3 berkas: surat pernyataan, KTP, dan SIM.', 400);
      } else {
        sendError(res, 'FILE_NOT_ALLOWED', 'Hanya satu berkas yang boleh diunggah.', 400);
      }
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
      requestId: req.requestId,
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
