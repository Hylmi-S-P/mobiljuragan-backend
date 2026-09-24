import pino from 'pino';

/**
 * Structured logging (roadmap §2 → pino).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'mobiljuragan-api' },
  redact: [
    // Jangan pernah log secret/sensitive (delivery gate: secret tidak masuk repo).
    'req.headers.authorization',
    'passwordHash',
    'otpHash',
  ],
});
