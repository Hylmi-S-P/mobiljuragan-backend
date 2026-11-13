import rateLimit from 'express-rate-limit';
import { sendError } from '../lib/response.js';
import { db } from '../db.js';

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
 * Pembatas pembuatan pesanan baru (/api/v1/bookings).
 *
 * Dihitung per nomor telepon, bukan per alamat IP: batas pesanan aktif sudah
 * dijaga per nomor, sehingga penyerang yang membuat banyak akun dari satu
 * perangkat tetap harus melewati pembatas ini per akun. Lima pesanan per jam
 * cukup longgar untuk pemakaian wajar (salah tanggal, ganti armada) tetapi
 * menghentikan pembuatan pesanan beruntun secara otomatis.
 */
export const bookingCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.phoneNumber || req.ip || 'tanpa-identitas',
  handler: (req, res) => {
    sendError(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Terlalu banyak pembuatan pesanan dalam waktu singkat. Silakan tunggu satu jam sebelum memesan lagi.',
      429,
    );
  },
});

/**
 * Pembatas unggahan berkas (dokumen sewa dan media umum).
 *
 * Setiap unggahan memaksa sharp mendekode gambar dan menulis hasilnya ke
 * penyimpanan, jadi biayanya jauh lebih besar daripada satu permintaan JSON
 * biasa. Dihitung per akun: satu akun yang mengunggah puluhan berkas beruntun
 * pasti bukan pemakaian wajar, sementara beberapa teman di satu jaringan kantor
 * tetap boleh mengunggah masing-masing.
 *
 * Batasnya longgar karena alur normal memang mengunggah beberapa berkas: tiga
 * dokumen sewa sekaligus, lalu bukti transfer, lalu foto armada oleh staf.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 menit
  /* Bisa diturunkan lewat env supaya batasnya bisa diuji tanpa mengunggah
     dua puluh berkas lebih dulu. */
  max: Number(process.env.UPLOAD_RATE_MAX ?? (process.env.NODE_ENV === 'test' ? 1000 : 20)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip || 'tanpa-identitas',
  handler: (req, res) => {
    /* Dicatat supaya pemblokiran bisa ditelusuri: tanpa catatan, "terlalu banyak"
       tidak bisa dibedakan dari gangguan jaringan biasa. Penulisan audit sengaja
       tidak ditunggu — respons 429 tetap harus cepat, dan kegagalan menulis log
       tidak boleh mengubah jawaban server. */
    void db.auditLog
      .create({
        data: {
          actorId: req.user?.userId ?? null,
          action: 'UPLOAD_RATE_LIMITED',
          entityType: 'Upload',
          metadata: {
            ip: req.ip || req.socket.remoteAddress || null,
            path: req.originalUrl,
          },
        },
      })
      .catch(() => undefined);

    sendError(
      res,
      'UPLOAD_RATE_LIMITED',
      'Terlalu banyak unggahan berkas dalam waktu singkat. Coba lagi beberapa menit lagi.',
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
