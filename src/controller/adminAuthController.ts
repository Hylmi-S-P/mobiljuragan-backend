import type { NextFunction, Request, Response } from 'express';
import { userModel } from '../model/userModel.js';
import { verifyPassword, signAuthToken } from '../lib/auth.js';
import { AppError, sendSuccess } from '../lib/response.js';
import { normalizePhoneNumber } from '../lib/phone.js';
import { logger } from '../logger.js';
import { UserRole } from '../generated/prisma/client.js';
import { db } from '../db.js';

/**
 * Controller autentikasi staf dan admin.
 *
 * Menangani login portal dan pengambilan sesi yang sedang aktif.
 * Semua kegagalan diteruskan lewat `next(error)` supaya ditangani satu kali
 * oleh errorHandler global.
 *
 * Model yang dipakai adalah `userModel` yang sama dengan modul akun staf,
 * karena tabelnya memang satu; tidak ada model terpisah hanya untuk login.
 */

/** Percobaan gagal sebelum akun dikunci sementara. */
const BATAS_PERCOBAAN = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);

/** Lama penguncian akun, dalam menit. */
const MENIT_KUNCI = Number(process.env.LOGIN_LOCK_MINUTES ?? 15);

/**
 * Hash tiruan untuk menyamakan waktu proses saat akun tidak ditemukan.
 *
 * Tanpa ini, permintaan dengan nomor tidak terdaftar dijawab jauh lebih cepat
 * daripada nomor terdaftar dengan password salah, sehingga penyerang bisa
 * memetakan nomor mana yang punya akun hanya dari lama respons.
 */
const HASH_TIRUAN = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8DrsdOSTGjSTZSXBzHiQvNnCz1r7Ie';

async function samakanWaktu(password: string): Promise<void> {
  await verifyPassword(password, HASH_TIRUAN).catch(() => false);
}

/** Pesan yang sama untuk semua kegagalan, supaya tidak membocorkan penyebabnya. */
const PESAN_GAGAL = 'Nomor telepon/username atau password salah.';

export const adminAuthController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, username: rawUsername, password, rememberMe } = req.body;
      const identifier = (rawPhone || rawUsername || '').trim();

      let user = null;
      // Dianggap nomor telepon kalau isinya hanya angka dan pemisah umum
      // (spasi, tanda hubung, tanda plus), lalu punya cukup digit.
      // Bentuk `+62 812-3456-7890` ikut tertangkap, bukan jatuh ke pencarian nama.
      const digitCount = identifier.replace(/\D/g, '').length;
      const looksLikePhone = /^[0-9+\-\s()]+$/.test(identifier) && digitCount >= 8;
      if (looksLikePhone) {
        const phoneNumber = normalizePhoneNumber(identifier);
        user = await userModel.findByPhoneNumber(phoneNumber);
      } else {
        // Alias username standar atau pencarian berdasarkan nama staf
        const lower = identifier.toLowerCase();
        if (lower === 'admin' || lower === 'admin.mobiljuragan') {
          user = await userModel.findByPhoneNumber('081234567890');
        } else if (lower === 'staf' || lower === 'staf.operasional') {
          user = await userModel.findByPhoneNumber('081234567899');
        } else {
          user = await userModel.findFirstByNameOrPhone(identifier);
        }
      }

      // Validasi user, status aktif, dan role
      if (
        !user ||
        !user.isActive ||
        (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF)
      ) {
        // Tetap jalankan pemeriksaan hash supaya waktu respons setara.
        await samakanWaktu(password);
        throw new AppError('INVALID_CREDENTIALS', PESAN_GAGAL, 401);
      }

      /*
       * Akun yang sedang terkunci ditolak sebelum password diperiksa. Pesannya
       * menyebut sisa waktu supaya pengguna sah tahu harus menunggu, bukan
       * mengira passwordnya berubah.
       */
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const sisaMenit = Math.max(
          1,
          Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000),
        );

        await userModel.createAuditLog({
          actorId: user.id,
          action: 'ADMIN_LOGIN_LOCKED',
          entityType: 'User',
          entityId: user.id,
          metadata: {
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            sisaMenit,
          },
        });

        throw new AppError(
          'ACCOUNT_LOCKED',
          `Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${sisaMenit} menit.`,
          423,
        );
      }

      if (!user.passwordHash) {
        await samakanWaktu(password);
        throw new AppError('INVALID_CREDENTIALS', PESAN_GAGAL, 401);
      }

      const isPasswordMatch = await verifyPassword(password, user.passwordHash);

      if (!isPasswordMatch) {
        await catatGagalLogin(user.id, user.failedLoginAttempts, req);
        throw new AppError('INVALID_CREDENTIALS', PESAN_GAGAL, 401);
      }

      // Login berhasil: bersihkan hitungan gagal dan catat waktu login.
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      });

      // Rekam riwayat login ke AuditLog
      await userModel.createAuditLog({
        actorId: user.id,
        action: 'ADMIN_LOGIN',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          loginAt: new Date().toISOString(),
        },
      });

      const token = signAuthToken(
        {
          userId: user.id,
          phoneNumber: user.phoneNumber,
          role: user.role,
          ver: user.tokenVersion ?? 0,
        },
        rememberMe ? '7d' : '1h',
      );

      logger.info(
        { userId: user.id, role: user.role },
        `[ADMIN LOGIN] ${user.role} ${user.fullName} berhasil login.`,
      );

      sendSuccess(
        res,
        {
          token,
          user: {
            id: user.id,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            role: user.role,
          },
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(
        res,
        {
          user: req.user,
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  },
};

/**
 * Menaikkan hitungan gagal login dan mengunci akun bila sudah melewati batas.
 *
 * Setiap kegagalan juga ditulis ke audit log, supaya serangan penebakan password
 * bisa terlihat di kemudian hari dan bukan hanya menghilang sebagai galat 401.
 */
async function catatGagalLogin(
  userId: string,
  percobaanSebelumnya: number,
  req: Request,
): Promise<void> {
  const percobaan = percobaanSebelumnya + 1;
  const akanDikunci = percobaan >= BATAS_PERCOBAAN;
  const lockedUntil = akanDikunci ? new Date(Date.now() + MENIT_KUNCI * 60_000) : null;

  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: percobaan,
      ...(akanDikunci ? { lockedUntil } : {}),
    },
  });

  await userModel.createAuditLog({
    actorId: userId,
    action: akanDikunci ? 'ADMIN_LOGIN_LOCKOUT' : 'ADMIN_LOGIN_FAILED',
    entityType: 'User',
    entityId: userId,
    metadata: {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      percobaan,
      batas: BATAS_PERCOBAAN,
      ...(akanDikunci ? { terkunciSampai: lockedUntil?.toISOString() } : {}),
    },
  });
}
