import type { Response } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(code: string, message: string, statusCode = 400, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Format standar respons sukses:
 * { "status": "ok", "data": { ... } }
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({
    status: 'ok',
    data,
  });
}

/**
 * Format standar respons error:
 * { "error": { "code": string, "message": string, "details": object } }
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details: Record<string, unknown> = {}
): Response {
  return res.status(statusCode).json({
    error: {
      code,
      message,
      details,
    },
  });
}
