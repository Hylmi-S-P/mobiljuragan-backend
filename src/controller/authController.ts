import type { NextFunction, Request, Response } from 'express';
import { authModel, OTP_MAX_ATTEMPTS } from '../model/authModel.js';
import { generateOtp, hashOtp, verifyOtpHash, signAuthToken } from '../lib/auth.js';
import { AppError, sendSuccess } from '../lib/response.js';
import { normalizePhoneNumber } from '../lib/phone.js';
import { logger } from '../logger.js';

/**
 * Controller autentikasi customer berbasis OTP.
 *
 * Menangani permintaan dan verifikasi kode OTP. Semua kegagalan diteruskan
 * lewat `next(error)` supaya ditangani satu kali oleh errorHandler global.
 */

export const authController = {
  async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, fullName, purpose } = req.body;
      const phoneNumber = normalizePhoneNumber(rawPhone);

      // Cari pelanggan yang sudah terdaftar, atau daftarkan kalau belum ada
      let user = await authModel.findUserByPhoneNumber(phoneNumber);

      if (!user) {
        user = await authModel.createCustomer(phoneNumber, fullName || 'Pelanggan MobilJuragan');
      } else if (fullName && user.fullName !== fullName) {
        user = await authModel.updateFullName(user.id, fullName);
      }

      // Generate OTP 6 digit
      const plainOtp = generateOtp();
      const hashed = hashOtp(plainOtp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

      // Simpan hash OTP
      await authModel.createOtpVerification({
        userId: user.id,
        phoneNumber,
        otpHash: hashed,
        purpose,
        expiresAt,
      });

      logger.info({ phoneNumber, purpose }, `[OTP REQUEST] Kode OTP dibuat untuk ${phoneNumber}`);

      // Pada mode dev, sertakan mockOtp agar mempermudah testing tim & frontend
      const isDev = process.env.NODE_ENV !== 'production';

      sendSuccess(
        res,
        {
          message: 'Kode verifikasi OTP telah dikirim.',
          phoneNumber,
          expiresInSeconds: 300,
          ...(isDev ? { devMockOtp: plainOtp } : {}),
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, otp, purpose } = req.body;
      const phoneNumber = normalizePhoneNumber(rawPhone);

      // Cari OTP verification aktif terakhir
      const latestOtp = await authModel.findLatestActiveOtp(phoneNumber, purpose);

      if (!latestOtp) {
        throw new AppError(
          'OTP_NOT_FOUND',
          'Tidak ada permintaan OTP aktif untuk nomor ini. Silakan minta kode baru.',
          400,
        );
      }

      // Cek batas percobaan
      if (latestOtp.attemptCount >= OTP_MAX_ATTEMPTS) {
        throw new AppError(
          'OTP_TOO_MANY_ATTEMPTS',
          'Terlalu banyak percobaan yang salah. Permintaan dibatalkan demi keamanan. Silakan minta kode baru.',
          429,
        );
      }

      // Cek kedaluwarsa
      if (latestOtp.expiresAt < new Date()) {
        throw new AppError(
          'OTP_EXPIRED',
          'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.',
          400,
        );
      }

      // Tambah jumlah percobaan, termasuk saat kode yang dimasukkan salah
      await authModel.incrementAttemptCount(latestOtp.id);

      // Verifikasi kecocokan hash
      const isValid = verifyOtpHash(otp, latestOtp.otpHash);
      if (!isValid) {
        const remainingAttempts = Math.max(0, OTP_MAX_ATTEMPTS - 1 - latestOtp.attemptCount);
        throw new AppError(
          'OTP_INVALID',
          `Kode OTP yang Anda masukkan salah. Sisa kesempatan: ${remainingAttempts} kali.`,
          400,
          { remainingAttempts },
        );
      }

      // Tandai OTP sudah terpakai supaya tidak bisa dipakai dua kali
      await authModel.markConsumed(latestOtp.id);

      // Terbitkan token autentikasi
      const token = signAuthToken({
        userId: latestOtp.user.id,
        phoneNumber: latestOtp.user.phoneNumber,
        role: latestOtp.user.role,
      });

      logger.info(
        { userId: latestOtp.user.id, phoneNumber },
        `[OTP VERIFY] Customer ${phoneNumber} berhasil login.`,
      );

      sendSuccess(
        res,
        {
          token,
          user: {
            id: latestOtp.user.id,
            fullName: latestOtp.user.fullName,
            phoneNumber: latestOtp.user.phoneNumber,
            role: latestOtp.user.role,
          },
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  },
};
