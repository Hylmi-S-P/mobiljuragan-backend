import type { NextFunction, Request, Response } from 'express';
import { AppError, sendSuccess } from '../lib/response.js';
import { hashPasswordPelanggan, signAuthToken, verifyPassword } from '../lib/auth.js';
import { periksaKataSandi, ringkasanKegagalan } from '../lib/passwordPolicy.js';
import { catatIdentitas, konteksDari, riwayatIdentitas } from '../lib/identityAudit.js';
import { profilModel } from '../model/profilModel.js';
import { logger } from '../logger.js';
import { whatsappOtpService } from '../services/whatsappOtp.service.js';

/**
 * Profil pemilik sesi.
 *
 * Ini **satu-satunya** jalur yang boleh mengubah identitas pelanggan. Jalur
 * autentikasi (OTP) sengaja tidak menyentuh nama sama sekali.
 */

function ambilIdentitas(req: Request): { userId: string; phoneNumber: string; role: string } {
  const user = req.user;
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
  }
  return {
    userId: user.userId,
    phoneNumber: user.phoneNumber,
    role: String(user.role),
  };
}

/** Membentuk respons profil yang aman dikirim ke klien. */
function bentukProfil(user: {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  phoneVerifiedAt: Date | null;
  passwordUpdatedAt: Date | null;
  passwordHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
    phoneVerifiedAt: user.phoneVerifiedAt,
    passwordUpdatedAt: user.passwordUpdatedAt,
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const profilController = {
  /** GET /api/v1/me */
  async tampilkan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = ambilIdentitas(req);
      const user = await profilModel.ambilPublik(userId);

      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'Akun tidak ditemukan.', 404);
      }

      sendSuccess(res, { user: bentukProfil(user) });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/me
   *
   * Saat ini hanya `fullName`. Nomor telepon tidak bisa diubah di sini: mengganti
   * nomor berarti mengganti identitas, dan itu butuh verifikasi OTP ke nomor baru
   * (direncanakan terpisah).
   */
  async ubahNama(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = ambilIdentitas(req);
      const { fullName, expectedUpdatedAt } = req.body as {
        fullName: string;
        expectedUpdatedAt?: string;
      };

      const namaBaru = String(fullName).trim();
      if (namaBaru.length < 3) {
        throw new AppError('INVALID_INPUT', 'Nama lengkap minimal 3 karakter.', 400);
      }

      let updatedAtDiharapkan: Date | null = null;
      if (expectedUpdatedAt) {
        const tanggal = new Date(expectedUpdatedAt);
        if (Number.isNaN(tanggal.getTime())) {
          throw new AppError('INVALID_INPUT', 'Nilai expectedUpdatedAt tidak valid.', 400);
        }
        updatedAtDiharapkan = tanggal;
      }

      const hasil = await profilModel.ubahNama({
        userId,
        namaBaru,
        updatedAtDiharapkan,
      });

      if (!hasil.berubah) {
        /* Dua kemungkinan: data berubah di antara baca dan tulis, atau akunnya
           tidak ada. Keduanya dijawab dengan kode yang sama supaya klien cukup
           memuat ulang profil lalu mencoba lagi. */
        throw new AppError(
          'PROFILE_CONFLICT',
          'Data profil sudah berubah di tempat lain. Muat ulang lalu coba lagi.',
          412,
        );
      }

      if (hasil.sebelum !== namaBaru) {
        await catatIdentitas({
          userId,
          actorType: 'SELF',
          actorId: userId,
          action: 'PROFILE_NAME_CHANGED',
          field: 'fullName',
          before: hasil.sebelum,
          after: namaBaru,
          konteks: konteksDari(req),
        });

        /* Pemberitahuan ke pemilik nomor. Dikirim tanpa menunggu, karena
           kegagalan WhatsApp tidak boleh menggagalkan perubahan yang sudah sah. */
        const konteks = konteksDari(req);
        whatsappOtpService
          .sendIdentityChanged({
            phoneNumber: req.user!.phoneNumber,
            nama: namaBaru,
            perubahan: `Nama akun diubah dari "${hasil.sebelum ?? '-'}" menjadi "${namaBaru}"`,
            waktu: new Date(),
          })
          .catch((err) => {
            logger.error(
              { err, userId, ip: konteks.ipAddress },
              '[PROFIL] Gagal mengirim notifikasi perubahan nama.',
            );
          });
      }

      const user = await profilModel.ambilPublik(userId);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'Akun tidak ditemukan.', 404);
      }

      sendSuccess(res, {
        message:
          hasil.sebelum === namaBaru
            ? 'Nama tidak berubah.'
            : 'Nama berhasil diperbarui. Pemberitahuan dikirim ke WhatsApp Anda.',
        user: bentukProfil(user),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/me/password
   *
   * Dipakai dua keadaan:
   * - akun lama tanpa kata sandi (`passwordHash` null) → buat kata sandi pertama;
   * - akun yang sudah punya kata sandi → wajib menyertakan kata sandi lama.
   *
   * Versi token dinaikkan, jadi semua sesi lain langsung gugur. Token untuk
   * perangkat ini diterbitkan ulang agar pengguna tidak ikut ter-logout.
   */
  async ubahKataSandi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = ambilIdentitas(req);
      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword: string;
      };

      const user = await profilModel.ambilPublik(userId);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'Akun tidak ditemukan.', 404);
      }

      const sudahPunya = Boolean(user.passwordHash);

      if (sudahPunya) {
        if (!currentPassword) {
          throw new AppError(
            'CURRENT_PASSWORD_REQUIRED',
            'Masukkan kata sandi saat ini untuk menggantinya.',
            400,
          );
        }
        const cocok = await verifyPassword(currentPassword, user.passwordHash!);
        if (!cocok) {
          await catatIdentitas({
            userId,
            actorType: 'SELF',
            actorId: userId,
            action: 'PASSWORD_LOGIN_FAILED',
            field: 'passwordHash',
            reason: 'Kata sandi saat ini salah pada PATCH /me/password',
            konteks: konteksDari(req),
          });
          throw new AppError(
            'INVALID_CREDENTIALS',
            'Kata sandi saat ini tidak sesuai.',
            401,
          );
        }
      }

      const pelanggaran = periksaKataSandi(newPassword);
      if (pelanggaran.length > 0) {
        const ringkasan = ringkasanKegagalan(pelanggaran);
        throw new AppError('PASSWORD_POLICY', ringkasan.message, 400, {
          rules: ringkasan.rules,
        });
      }

      if (sudahPunya && currentPassword === newPassword) {
        throw new AppError(
          'PASSWORD_UNCHANGED',
          'Kata sandi baru harus berbeda dari yang sekarang.',
          400,
        );
      }

      const { tokenVersion } = await profilModel.simpanKataSandi({
        userId,
        passwordHash: await hashPasswordPelanggan(newPassword),
      });

      await catatIdentitas({
        userId,
        actorType: 'SELF',
        actorId: userId,
        action: sudahPunya ? 'PASSWORD_CHANGED' : 'PASSWORD_SET',
        field: 'passwordHash',
        reason: 'Diubah sendiri lewat halaman profil',
        konteks: konteksDari(req),
      });

      /* Semua sesi lama gugur karena tokenVersion naik. Perangkat ini mendapat
         token baru supaya pengguna tidak perlu memasukkan ulang kata sandinya. */
      const tokenBaru = signAuthToken({
        userId: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role as never,
        ver: tokenVersion,
      });

      sendSuccess(res, {
        message: sudahPunya
          ? 'Kata sandi berhasil diganti. Perangkat lain telah dikeluarkan.'
          : 'Kata sandi berhasil dibuat.',
        token: tokenBaru,
        tokenVersion,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/me/logout-all
   *
   * Menaikkan versi token sehingga seluruh token yang beredar — termasuk milik
   * perangkat ini — tidak berlaku lagi. Pemanggil harus masuk ulang.
   */
  async keluarkanSemuaPerangkat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = ambilIdentitas(req);

      const { tokenVersion } = await profilModel.cabutSemuaSesi(userId);

      await catatIdentitas({
        userId,
        actorType: 'SELF',
        actorId: userId,
        action: 'SESSIONS_REVOKED',
        field: 'tokenVersion',
        after: String(tokenVersion),
        reason: 'Logout dari semua perangkat',
        konteks: konteksDari(req),
      });

      sendSuccess(res, {
        message: 'Semua perangkat telah dikeluarkan. Silakan masuk kembali.',
        tokenVersion,
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/v1/me/identity-history — jejak perubahan identitas milik sendiri. */
  async riwayat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = ambilIdentitas(req);
      const riwayat = await riwayatIdentitas(userId, 50);
      sendSuccess(res, { items: riwayat });
    } catch (error) {
      next(error);
    }
  },
};
