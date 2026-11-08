import type { NextFunction, Request, Response } from 'express';
import { AppError, sendSuccess } from '../lib/response.js';
import {
  hashPasswordPelanggan,
  hashOtp,
  generateOtp,
  signAuthToken,
  verifyOtpHash,
  verifyPassword,
} from '../lib/auth.js';
import { normalizePhoneNumber } from '../lib/phone.js';
import { periksaKataSandi, ringkasanKegagalan } from '../lib/passwordPolicy.js';
import { catatIdentitas, konteksDari } from '../lib/identityAudit.js';
import { authModel, OTP_BLOCK_MINUTES, OTP_TTL_MINUTES } from '../model/authModel.js';
import { profilModel } from '../model/profilModel.js';
import { logger } from '../logger.js';
import { whatsappOtpService } from '../services/whatsappOtp.service.js';

/**
 * Masuk dengan kata sandi dan pemulihannya.
 *
 * Prinsip yang dipegang:
 *
 * 1. **Pesan galat seragam.** Nomor tak dikenal, kata sandi salah, dan akun
 *    nonaktif dijawab dengan kode yang sama, sehingga daftar pelanggan tidak
 *    bisa dipetakan dari luar.
 * 2. **Waktu respons seragam.** Bila nomor tidak ditemukan, bcrypt tetap
 *    dijalankan terhadap hash tiruan supaya durasi balasan tidak membocorkan
 *    keberadaan akun.
 * 3. **Penguncian terpadu.** Kegagalan kata sandi dan kegagalan OTP menaikkan
 *    penghitung yang sama, sehingga penyerang tidak bisa berpindah metode untuk
 *    mereset jatah tebakan.
 */

/** Batas percobaan masuk kata sandi sebelum akun dikunci. */
const BATAS_PERCOBAAN = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);

/** Lama penguncian akun. */
const MENIT_KUNCI = Number(process.env.LOGIN_LOCK_MINUTES ?? 15);

/**
 * Hash tiruan untuk menyamakan waktu respons saat nomor tidak dikenal.
 *
 * Dibuat sekali saat modul dimuat; nilainya tidak pernah cocok dengan kata sandi
 * apa pun karena tidak ada yang mengetahui kata sandi aslinya.
 */
let hashTiruan: string | null = null;

async function siapkanHashTiruan(): Promise<string> {
  if (!hashTiruan) {
    hashTiruan = await hashPasswordPelanggan(`tiruan-${Date.now()}-${Math.random()}`);
  }
  return hashTiruan;
}

function kirimSesi(
  res: Response,
  user: {
    id: string;
    fullName: string;
    phoneNumber: string;
    role: string;
    phoneVerifiedAt?: Date | null;
    passwordUpdatedAt?: Date | null;
    tokenVersion?: number;
  },
  tokenVersion: number,
  statusCode = 200,
): void {
  const token = signAuthToken({
    userId: user.id,
    phoneNumber: user.phoneNumber,
    role: user.role as never,
    ver: tokenVersion,
  });

  sendSuccess(
    res,
    {
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        phoneVerifiedAt: user.phoneVerifiedAt ?? null,
        passwordUpdatedAt: user.passwordUpdatedAt ?? null,
      },
    },
    statusCode,
  );
}

export const passwordController = {
  /**
   * POST /api/v1/auth/login/password
   *
   * Alternatif dari OTP untuk masuk sehari-hari. Nomor telepon tetap identitas;
   * kata sandi hanya cara membuktikannya.
   */
  async masuk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, password } = req.body as {
        phoneNumber: string;
        password: string;
      };
      const phoneNumber = normalizePhoneNumber(rawPhone);
      const konteks = konteksDari(req);

      /* Nomor yang diblokir karena percobaan gagal ditolak sebelum bcrypt,
         supaya pemblokiran juga menghemat biaya CPU. */
      const guard = await authModel.ambilGuard(phoneNumber);
      if (guard?.blockedUntil && guard.blockedUntil.getTime() > Date.now()) {
        const sisaMenit = Math.ceil((guard.blockedUntil.getTime() - Date.now()) / 60_000);
        throw new AppError(
          'ACCOUNT_LOCKED',
          `Terlalu banyak percobaan untuk nomor ini. Coba lagi dalam ${sisaMenit} menit.`,
          429,
          { retryAfterMinutes: sisaMenit },
        );
      }

      const user = await profilModel.ambilRingkasUntukLogin(phoneNumber);

      /* Nomor tidak dikenal: tetap jalankan bcrypt terhadap hash tiruan, lalu
         jawab dengan galat yang sama seperti kata sandi salah. */
      if (!user) {
        await verifyPassword(password, await siapkanHashTiruan()).catch(() => false);
        await authModel.catatKegagalanVerifikasi(phoneNumber, new Date());
        throw new AppError(
          'INVALID_CREDENTIALS',
          'Nomor atau kata sandi tidak sesuai.',
          401,
        );
      }

      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const sisaMenit = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
        throw new AppError(
          'ACCOUNT_LOCKED',
          `Akun ini terkunci sementara. Coba lagi dalam ${sisaMenit} menit.`,
          429,
          { retryAfterMinutes: sisaMenit },
        );
      }

      if (!user.isActive) {
        // Tetap jalankan bcrypt agar waktunya seragam, lalu jawab seperti salah sandi.
        await verifyPassword(password, user.passwordHash ?? (await siapkanHashTiruan())).catch(
          () => false,
        );
        throw new AppError('INVALID_CREDENTIALS', 'Nomor atau kata sandi tidak sesuai.', 401);
      }

      /* `PASSWORD_NOT_SET` hanya untuk akun yang terbukti ada dan aktif, supaya
         pemanggil tahu harus memakai OTP tanpa membuka informasi akun lain. */
      if (!user.passwordHash) {
        throw new AppError(
          'PASSWORD_NOT_SET',
          'Akun ini belum memiliki kata sandi. Masuk dengan kode OTP terlebih dahulu, lalu buat kata sandi di halaman profil.',
          409,
        );
      }

      const cocok = await verifyPassword(password, user.passwordHash);
      if (!cocok) {
        await authModel.catatKegagalanVerifikasi(phoneNumber, new Date());
        const hasil = await profilModel.catatGagalMasuk(user.id, BATAS_PERCOBAAN, MENIT_KUNCI);

        await catatIdentitas({
          userId: user.id,
          actorType: 'SELF',
          actorId: user.id,
          action: 'PASSWORD_LOGIN_FAILED',
          field: 'passwordHash',
          reason: `Kata sandi salah (${hasil.sisaPercobaan} kesempatan tersisa)`,
          konteks,
        });

        if (hasil.terkunciSampai) {
          throw new AppError(
            'ACCOUNT_LOCKED',
            `Terlalu banyak kata sandi yang salah. Akun dikunci ${MENIT_KUNCI} menit.`,
            429,
            { retryAfterMinutes: MENIT_KUNCI },
          );
        }

        throw new AppError(
          'INVALID_CREDENTIALS',
          `Nomor atau kata sandi tidak sesuai. Sisa kesempatan: ${hasil.sisaPercobaan} kali.`,
          401,
          { remainingAttempts: hasil.sisaPercobaan },
        );
      }

      await authModel.resetGuard(phoneNumber);
      await profilModel.catatMasukBerhasil(user.id);

      await catatIdentitas({
        userId: user.id,
        actorType: 'SELF',
        actorId: user.id,
        action: 'PASSWORD_LOGIN_SUCCESS',
        field: 'passwordHash',
        konteks,
      });

      logger.info(
        { userId: user.id, phoneNumber },
        '[PASSWORD LOGIN] Pelanggan masuk memakai kata sandi.',
      );

      kirimSesi(
        res,
        {
          id: user.id,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          phoneVerifiedAt: user.phoneVerifiedAt ?? null,
          passwordUpdatedAt: user.passwordUpdatedAt ?? null,
        },
        user.tokenVersion,
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/password/reset/request
   *
   * Selalu menjawab sukses, kecuali nomor acap kali meminta kode. Jawaban yang
   * berbeda-beda akan membocorkan nomor mana yang punya akun.
   */
  async mintaReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone } = req.body as { phoneNumber: string };
      const phoneNumber = normalizePhoneNumber(rawPhone);

      const izin = await authModel.catatPengiriman(phoneNumber, new Date());
      if (!izin.boleh) {
        throw new AppError(
          izin.alasan === 'KUOTA' ? 'OTP_RATE_LIMITED' : 'OTP_COOLDOWN',
          izin.alasan === 'KUOTA'
            ? 'Terlalu banyak permintaan kode untuk nomor ini. Coba lagi nanti.'
            : `Mohon tunggu ${izin.tungguDetik ?? 60} detik sebelum meminta kode lagi.`,
          429,
          izin.tungguDetik ? { retryAfterSeconds: izin.tungguDetik } : {},
        );
      }

      const pelanggan = await profilModel.ambilPelanggan(phoneNumber);

      /* Nomor bukan pelanggan terdaftar: jangan buat kode, tetap jawab sukses. */
      if (!pelanggan) {
        logger.info({ phoneNumber }, '[RESET KATA SANDI] Nomor tidak terdaftar, diabaikan.');
        sendSuccess(res, {
          phoneNumber,
          expiresInSeconds: OTP_TTL_MINUTES * 60,
          resendCooldownSeconds: 60,
        });
        return;
      }

      const kode = generateOtp();

      await authModel.simpanKodeBaru({
        userId: pelanggan.id,
        phoneNumber,
        otpHash: hashOtp(kode),
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      });

      const kodePengembanganDiizinkan =
        process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP_BYPASS === 'true';

      whatsappOtpService
        .sendOtp({ phoneNumber, otpCode: kode, fullName: pelanggan.fullName })
        .catch((err) => {
          logger.error({ err, phoneNumber }, '[RESET KATA SANDI] Gagal mengirim WhatsApp.');
        });

      sendSuccess(res, {
        phoneNumber,
        expiresInSeconds: OTP_TTL_MINUTES * 60,
        resendCooldownSeconds: 60,
        ...(kodePengembanganDiizinkan ? { devMockOtp: kode } : {}),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/password/reset/verify
   *
   * Memulihkan kata sandi setelah OTP terbukti. Versi token dinaikkan, jadi
   * seluruh sesi lama — termasuk milik penyerang — langsung tidak berlaku.
   */
  async verifikasiReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, otp, password } = req.body as {
        phoneNumber: string;
        otp: string;
        password: string;
      };
      const phoneNumber = normalizePhoneNumber(rawPhone);
      const konteks = konteksDari(req);

      const guard = await authModel.ambilGuard(phoneNumber);
      if (guard?.blockedUntil && guard.blockedUntil.getTime() > Date.now()) {
        const sisaMenit = Math.ceil((guard.blockedUntil.getTime() - Date.now()) / 60_000);
        throw new AppError(
          'ACCOUNT_LOCKED',
          `Terlalu banyak percobaan. Coba lagi dalam ${sisaMenit} menit.`,
          429,
          { retryAfterMinutes: sisaMenit },
        );
      }

      const kodeAktif = await authModel.findKodeAktif(phoneNumber, 'PASSWORD_RESET');
      if (!kodeAktif) {
        throw new AppError(
          'OTP_NOT_FOUND',
          'Tidak ada kode pemulihan yang aktif. Silakan minta kode baru.',
          400,
        );
      }

      if (kodeAktif.expiresAt.getTime() < Date.now()) {
        await authModel.cabutSemuaKode(phoneNumber);
        throw new AppError(
          'OTP_EXPIRED',
          'Kode pemulihan sudah kedaluwarsa. Silakan minta kode baru.',
          400,
        );
      }

      const cocok =
        verifyOtpHash(otp, kodeAktif.otpHash) ||
        (process.env.NODE_ENV !== 'production' &&
          process.env.ALLOW_DEV_OTP_BYPASS === 'true' &&
          otp === '123456');

      if (!cocok) {
        await authModel.tambahPercobaanKode(kodeAktif.id);
        const hasil = await authModel.catatKegagalanVerifikasi(phoneNumber, new Date());
        if (hasil.terkunciSampai) {
          throw new AppError(
            'ACCOUNT_LOCKED',
            `Terlalu banyak kode yang salah. Nomor ini dikunci ${OTP_BLOCK_MINUTES} menit.`,
            429,
            { retryAfterMinutes: OTP_BLOCK_MINUTES },
          );
        }
        throw new AppError(
          'OTP_INVALID',
          `Kode pemulihan salah. Sisa kesempatan: ${hasil.sisaPercobaan} kali.`,
          400,
          { remainingAttempts: hasil.sisaPercobaan },
        );
      }

      await authModel.tandaiKodeTerpakai(kodeAktif.id);

      const pelanggan = await profilModel.ambilPelanggan(phoneNumber);
      if (!pelanggan) {
        throw new AppError('INVALID_CREDENTIALS', 'Nomor atau kode tidak sesuai.', 401);
      }

      const pelanggaran = periksaKataSandi(password, {
        fullName: pelanggan.fullName,
        phoneNumber,
      });
      if (pelanggaran.length > 0) {
        const ringkasan = ringkasanKegagalan(pelanggaran);
        throw new AppError('PASSWORD_POLICY', ringkasan.message, 400, {
          rules: ringkasan.rules,
        });
      }

      const { tokenVersion } = await profilModel.simpanKataSandi({
        userId: pelanggan.id,
        passwordHash: await hashPasswordPelanggan(password),
      });

      await authModel.cabutSemuaKode(phoneNumber);
      await authModel.resetGuard(phoneNumber);
      await profilModel.catatMasukBerhasil(pelanggan.id);

      await catatIdentitas({
        userId: pelanggan.id,
        actorType: 'SELF',
        actorId: pelanggan.id,
        action: 'PASSWORD_RESET',
        field: 'passwordHash',
        reason: 'Dipulihkan lewat kode verifikasi WhatsApp',
        konteks,
      });

      logger.info(
        { userId: pelanggan.id, phoneNumber },
        '[RESET KATA SANDI] Kata sandi dipulihkan lewat OTP.',
      );

      kirimSesi(
        res,
        {
          id: pelanggan.id,
          fullName: pelanggan.fullName,
          phoneNumber,
          role: pelanggan.role,
          passwordUpdatedAt: new Date(),
        },
        tokenVersion,
      );
    } catch (error) {
      next(error);
    }
  },
};
