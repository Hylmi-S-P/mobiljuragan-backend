import pino from 'pino';

/**
 * Logger konfigurasi Pino
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'mobiljuragan-api' },
  redact: [
    // Data sensitif yang di-redact
    'req.headers.authorization',
    'passwordHash',
    'otpHash',
  ],
});
