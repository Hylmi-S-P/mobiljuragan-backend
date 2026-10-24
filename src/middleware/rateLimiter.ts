import rateLimit from 'express-rate-limit';
import { sendError } from '../lib/response.js';

/**
 * Rate limiter untuk endpoint percakapan asisten AI pelanggan (/api/v1/ai/chat).
 * Membatasi 20 request per menit per alamat IP guna mencegah eksploitasi
 * dan pembengkakan kuota token LLM.
 */
export const aiChatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Terlalu banyak permintaan chat ke asisten AI. Silakan tunggu 1 menit sebelum mengirim pesan lagi.',
      429,
    );
  },
});

/**
 * Rate limiter untuk pengiriman pesan balasan tiket bantuan (/api/v1/tickets/:id/messages).
 * Membatasi 30 request per menit per alamat IP guna mencegah spamming thread tiket.
 */
export const ticketMessageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Terlalu banyak pesan terkirim dalam waktu singkat. Silakan tunggu beberapa saat.',
      429,
    );
  },
});
