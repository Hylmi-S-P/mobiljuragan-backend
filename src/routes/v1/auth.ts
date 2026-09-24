import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { validateBody } from '../../middleware/validate.js';
import { generateOtp, hashOtp, verifyOtpHash, signAuthToken } from '../../utils/auth.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../logger.js';
import { UserRole } from '../../generated/prisma/client.js';

export const authRouter: Router = Router();

const indonesianPhoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;

function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.trim().replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  } else if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

const otpRequestSchema = z.object({
  phoneNumber: z.string().regex(indonesianPhoneRegex, 'Format nomor telepon tidak valid (contoh: 081234567890).'),
  fullName: z.string().min(2, 'Nama minimal 2 karakter.').max(100).optional(),
  purpose: z.string().default('CUSTOMER_LOGIN'),
});

const otpVerifySchema = z.object({
  phoneNumber: z.string().regex(indonesianPhoneRegex, 'Format nomor telepon tidak valid.'),
  otp: z.string().length(6, 'Kode OTP harus berupa 6 digit angka.').regex(/^\d+$/, 'Kode OTP harus berupa angka.'),
  purpose: z.string().default('CUSTOMER_LOGIN'),
});

/**
 * POST /api/v1/auth/otp/request
 * Meminta kode OTP untuk login/registrasi customer.
 */
authRouter.post('/otp/request', validateBody(otpRequestSchema), async (req: Request, res: Response) => {
  const { phoneNumber: rawPhone, fullName, purpose } = req.body;
  const phoneNumber = normalizePhoneNumber(rawPhone);

  // 1. Cari atau buat customer
  let user = await db.user.findUnique({
    where: { phoneNumber },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        phoneNumber,
        fullName: fullName || 'Pelanggan MobilJuragan',
        role: UserRole.CUSTOMER,
      },
    });
  } else if (fullName && user.fullName !== fullName) {
    user = await db.user.update({
      where: { id: user.id },
      data: { fullName },
    });
  }

  // 2. Generate 6 digit OTP & hash
  const plainOtp = generateOtp();
  const hashed = hashOtp(plainOtp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

  // 3. Simpan ke tabel otp_verifications (hanya hash!)
  await db.otpVerification.create({
    data: {
      userId: user.id,
      phoneNumber,
      otpHash: hashed,
      purpose,
      expiresAt,
    },
  });

  logger.info({ phoneNumber, purpose }, `[OTP REQUEST] Kode OTP dibuat untuk ${phoneNumber}`);

  // Pada mode dev, sertakan mockOtp agar mempermudah testing tim & frontend
  const isDev = process.env.NODE_ENV !== 'production';

  return sendSuccess(res, {
    message: 'Kode verifikasi OTP telah dikirim.',
    phoneNumber,
    expiresInSeconds: 300,
    ...(isDev ? { devMockOtp: plainOtp } : {}),
  }, 200);
});

/**
 * POST /api/v1/auth/otp/verify
 * Memverifikasi kode OTP customer.
 */
authRouter.post('/otp/verify', validateBody(otpVerifySchema), async (req: Request, res: Response) => {
  const { phoneNumber: rawPhone, otp, purpose } = req.body;
  const phoneNumber = normalizePhoneNumber(rawPhone);

  // Cari OTP verification aktif terakhir
  const latestOtp = await db.otpVerification.findFirst({
    where: {
      phoneNumber,
      purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  if (!latestOtp) {
    return sendError(res, 'OTP_NOT_FOUND', 'Tidak ada permintaan OTP aktif untuk nomor ini. Silakan minta kode baru.', 400);
  }

  // Cek batas percobaan
  if (latestOtp.attemptCount >= 5) {
    return sendError(
      res,
      'OTP_TOO_MANY_ATTEMPTS',
      'Terlalu banyak percobaan yang salah. Permintaan dibatalkan demi keamanan. Silakan minta kode baru.',
      429
    );
  }

  // Cek kedaluwarsa
  if (latestOtp.expiresAt < new Date()) {
    return sendError(res, 'OTP_EXPIRED', 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.', 400);
  }

  // Update attempt count
  await db.otpVerification.update({
    where: { id: latestOtp.id },
    data: { attemptCount: { increment: 1 } },
  });

  // Verifikasi kecocokan hash
  const isValid = verifyOtpHash(otp, latestOtp.otpHash);
  if (!isValid) {
    const remainingAttempts = 4 - latestOtp.attemptCount;
    return sendError(
      res,
      'OTP_INVALID',
      `Kode OTP yang Anda masukkan salah. Sisa kesempatan: ${Math.max(0, remainingAttempts)} kali.`,
      400,
      { remainingAttempts: Math.max(0, remainingAttempts) }
    );
  }

  // Tandai consumed
  await db.otpVerification.update({
    where: { id: latestOtp.id },
    data: { consumedAt: new Date() },
  });

  // Terbitkan token autentikasi
  const token = signAuthToken({
    userId: latestOtp.user.id,
    phoneNumber: latestOtp.user.phoneNumber,
    role: latestOtp.user.role,
  });

  logger.info({ userId: latestOtp.user.id, phoneNumber }, `[OTP VERIFY] Customer ${phoneNumber} berhasil login.`);

  return sendSuccess(res, {
    token,
    user: {
      id: latestOtp.user.id,
      fullName: latestOtp.user.fullName,
      phoneNumber: latestOtp.user.phoneNumber,
      role: latestOtp.user.role,
    },
  }, 200);
});
