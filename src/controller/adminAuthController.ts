import type { NextFunction, Request, Response } from 'express';
import { userModel } from '../model/userModel.js';
import { verifyPassword, signAuthToken } from '../lib/auth.js';
import { AppError, sendSuccess } from '../lib/response.js';
import { normalizePhoneNumber } from '../lib/phone.js';
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
        throw new AppError(
          'INVALID_CREDENTIALS',
          'Nomor telepon/username atau password salah.',
          401,
        );
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
