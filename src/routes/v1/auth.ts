import { Router } from 'express';
import { z } from 'zod';
import { authController } from '../../controller/authController.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
} from '../../middleware/rateLimiter.js';
import {
  ATURAN_KATA_SANDI,
  BATAS_BYTE,
  PANJANG_MINIMAL,
} from '../../lib/passwordPolicy.js';

/**
 * Autentikasi pelanggan: `/api/v1/auth/*`
 *
 * Dua jalur masuk (kode OTP dan kata sandi) memakai identitas yang sama, yaitu
 * nomor telepon yang sudah diverifikasi. Tidak ada endpoint di sini yang menerima
 * nama untuk akun yang sudah ada.
 */
export const authRouter: Router = Router();

const indonesianPhoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;

const phoneZodSchema = z
  .string()
  .transform((val) => val.replace(/[\s\-]/g, ''))
  .pipe(
    z
      .string()
      .regex(
        indonesianPhoneRegex,
        'Format nomor telepon tidak valid (contoh: 081234567890).',
      ),
  );

const otpRequestSchema = z.object({
  phoneNumber: phoneZodSchema,
  /**
   * Niat pemanggil. `login` tidak pernah membuat akun; `register` menolak nomor
   * yang sudah terdaftar. Nilai lain ditolak oleh z.enum.
   */
  intent: z.enum(['login', 'register'], {
    error: 'Niat permintaan harus "login" atau "register".',
  }),
});

const otpVerifySchema = z.object({
  phoneNumber: phoneZodSchema,
  otp: z
    .string()
    .length(6, 'Kode OTP harus 6 digit.')
    .regex(/^\d+$/, 'Kode OTP harus berupa angka.'),
});

/**
 * Validasi kata sandi di lapisan skema.
 *
 * Pemeriksaan aturan yang butuh konteks (nama dan nomor) dilakukan di controller
 * karena memerlukan data permintaan lain. Di sini hanya bentuk dasarnya, supaya
 * permintaan yang jelas salah tidak sampai menyentuh database.
 */
const passwordZodSchema = z
  .string({
    error: 'Kata sandi wajib diisi.',
  })
  .min(
    PANJANG_MINIMAL,
    `Kata sandi minimal ${PANJANG_MINIMAL} karakter.`,
  )
  .refine((val) => Buffer.byteLength(val, 'utf8') <= BATAS_BYTE, {
    message: `Kata sandi maksimal ${BATAS_BYTE} byte.`,
  })
  .refine((val) => /[A-Z]/.test(val), { message: 'Kata sandi harus memuat huruf besar.' })
  .refine((val) => /[a-z]/.test(val), { message: 'Kata sandi harus memuat huruf kecil.' })
  .refine((val) => /[0-9]/.test(val), { message: 'Kata sandi harus memuat angka.' })
  .refine((val) => /[^A-Za-z0-9]/.test(val), { message: 'Kata sandi harus memuat simbol.' });

const registerVerifySchema = z.object({
  phoneNumber: phoneZodSchema,
  otp: z
    .string()
    .length(6, 'Kode OTP harus 6 digit.')
    .regex(/^\d+$/, 'Kode OTP harus berupa angka.'),
  fullName: z
    .string()
    .trim()
    .min(3, 'Nama lengkap minimal 3 karakter.')
    .max(100, 'Nama lengkap maksimal 100 karakter.'),
  password: passwordZodSchema,
});

// Meminta kode verifikasi (tanpa membuat akun).
authRouter.post(
  '/otp/request',
  otpRequestRateLimiter,
  validateBody(otpRequestSchema),
  authController.requestOtp,
);

// Masuk memakai kode verifikasi.
authRouter.post(
  '/otp/verify',
  otpVerifyRateLimiter,
  validateBody(otpVerifySchema),
  authController.verifyLoginOtp,
);

// Pendaftaran: kode verifikasi + nama + kata sandi, dalam satu permintaan.
authRouter.post(
  '/register/verify',
  otpVerifyRateLimiter,
  validateBody(registerVerifySchema),
  authController.verifyRegisterOtp,
);

// Profil pemilik sesi; dipakai aplikasi memastikan tokennya masih sah.
authRouter.get('/me', requireAuth, authController.me);

/**
 * Daftar aturan kata sandi untuk klien.
 *
 * Dipakai aplikasi sebagai pembanding: kalau aturan server berubah, checklist di
 * perangkat bisa menyesuaikan tanpa menunggu rilis aplikasi.
 */
authRouter.get('/password-policy', (_req, res) => {
  res.json({
    status: 'ok',
    success: true,
    data: {
      minLength: PANJANG_MINIMAL,
      maxBytes: BATAS_BYTE,
      rules: ATURAN_KATA_SANDI,
    },
  });
});
