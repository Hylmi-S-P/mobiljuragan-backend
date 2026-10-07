import pino from 'pino';

/**
 * Logger Pino untuk seluruh aplikasi.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'mobiljuragan-api' },
  redact: [
    // Nilai sensitif yang tidak boleh ikut tercatat di log
    'req.headers.authorization',
    'passwordHash',
    'otpHash',
  ],
});
