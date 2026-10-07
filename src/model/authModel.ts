import { db } from '../db.js';
import { UserRole } from '../generated/prisma/client.js';

/**
 * Lapisan model untuk autentikasi customer (OTP).
 *
 * Sesuai pemisahan tanggung jawab, hanya lapisan ini yang berbicara ke database.
 * Controller memanggil fungsi di sini dan tidak pernah menyusun query sendiri.
 *
 * OTP customer memakai tabel `users` yang sama dengan staf, jadi sengaja tidak
 * dibuat model terpisah: perbedaannya hanya peran CUSTOMER, bukan tabelnya.
 */

/** Batas percobaan salah sebelum permintaan OTP dibatalkan demi keamanan. */
export const OTP_MAX_ATTEMPTS = 5;

export const authModel = {
  findUserByPhoneNumber(phoneNumber: string) {
    return db.user.findUnique({ where: { phoneNumber } });
  },

  /** Nomor yang belum dikenal otomatis didaftarkan sebagai pelanggan baru. */
  createCustomer(phoneNumber: string, fullName: string) {
    return db.user.create({
      data: {
        phoneNumber,
        fullName,
        role: UserRole.CUSTOMER,
      },
    });
  },

  updateFullName(id: string, fullName: string) {
    return db.user.update({
      where: { id },
      data: { fullName },
    });
  },

  createOtpVerification(data: {
    userId: string;
    phoneNumber: string;
    otpHash: string;
    purpose: string;
    expiresAt: Date;
  }) {
    return db.otpVerification.create({ data });
  },

  /** Permintaan OTP aktif terakhir, sekaligus membawa data user untuk penerbitan token. */
  findLatestActiveOtp(phoneNumber: string, purpose: string) {
    return db.otpVerification.findFirst({
      where: {
        phoneNumber,
        purpose,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  },

  incrementAttemptCount(id: string) {
    return db.otpVerification.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  },

  markConsumed(id: string) {
    return db.otpVerification.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },
};
