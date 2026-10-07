import type { NextFunction, Request, Response } from 'express';
import { userModel } from '../model/userModel.js';
import { verifyPassword, signAuthToken } from '../utils/auth.js';
import { AppError, sendSuccess } from '../utils/response.js';
import { logger } from '../logger.js';
import { UserRole } from '../generated/prisma/client.js';

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

/** Nomor lokal dinormalkan supaya cocok dengan format yang tersimpan. */
function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.trim().replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  } else if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

export const adminAuthController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber: rawPhone, username: rawUsername, password, rememberMe } = req.body;
      const identifier = (rawPhone || rawUsername || '').trim();

      let user = null;
      if (/^[0-9+]+$/.test(identifier) || identifier.startsWith('0') || identifier.startsWith('62')) {
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
      if (!user || !user.isActive || (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF)) {
        throw new AppError('INVALID_CREDENTIALS', 'Nomor telepon/username atau password salah.', 401);
      }

      if (!user.passwordHash) {
        throw new AppError('INVALID_CREDENTIALS', 'Akun belum memiliki password terdaftar.', 401);
      }

      const isPasswordMatch = await verifyPassword(password, user.passwordHash);
      if (!isPasswordMatch) {
        throw new AppError('INVALID_CREDENTIALS', 'Nomor telepon atau password salah.', 401);
      }

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
        },
        rememberMe ? '7d' : '1h'
      );

      logger.info({ userId: user.id, role: user.role }, `[ADMIN LOGIN] ${user.role} ${user.fullName} berhasil login.`);

      sendSuccess(res, {
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      }, 200);
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, {
        user: req.user,
      }, 200);
    } catch (error) {
      next(error);
    }
  },
};
