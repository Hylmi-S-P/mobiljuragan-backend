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

/**
 * Pembatas percobaan login panel staf dan admin.
 *
 * Dua lapis, karena masing-masing menutup celah yang berbeda:
 *
 * 1. Per alamat IP, untuk menahan satu penyerang yang menebak banyak akun
 *    sekaligus dari satu mesin.
 * 2. Per akun, di dalam controller, untuk menahan penebakan satu akun dari
 *    banyak IP sekaligus.
 *
 * `skipSuccessfulRequests` membuat hitungan hanya bertambah saat login gagal,
 * sehingga pengguna sah yang sering login tidak pernah terkena batas.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: process.env.NODE_ENV === 'test' ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    sendError(
      res,
      'LOGIN_RATE_LIMITED',
      'Terlalu banyak percobaan login gagal dari jaringan ini. Coba lagi dalam 15 menit.',
      429,
    );
  },
});

/**
 * Pembatas permintaan kode verifikasi.
 *
 * Lapisan pertama pertahanan brute force & spam kirim WhatsApp. Pembatas per
 * nomor (cooldown 60 detik, kuota 5/jam) ada di `authModel.catatPengiriman`;
 * limiter ini menjaga agar satu alamat IP tidak membanjiri server.
 */
export const otpRequestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(
      res,
      'OTP_RATE_LIMITED',
      'Terlalu banyak permintaan kode verifikasi dari jaringan ini. Coba lagi dalam 1 menit.',
      429,
    );
  },
});

/**
 * Pembatas percobaan verifikasi kode.
 *
 * Batas per nomor tetap ditegakkan di controller (5 salah → kunci 15 menit);
 * limiter ini mencegah penebakan masif dari satu alamat IP.
 */
export const otpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    sendError(
      res,
      'OTP_RATE_LIMITED',
      'Terlalu banyak percobaan verifikasi dari jaringan ini. Coba lagi dalam 15 menit.',
      429,
    );
  },
});
