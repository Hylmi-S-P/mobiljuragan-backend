import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole, type Prisma } from '../generated/prisma/client.js';
import { userModel } from '../model/userModel.js';
import { AppError, sendSuccess } from '../lib/response.js';

/**
 * Controller manajemen akun admin dan super admin.
 *
 * Membaca request, menjalankan aturan bisnis, memanggil model, lalu mengirim respons.
 * Semua kegagalan diteruskan lewat `next(error)` agar ditangani errorHandler global
 * satu kali, bukan diulang di setiap blok catch.
 */

const usernameRegex = /^[a-z0-9._-]+$/i;

export const createAdminSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Nama lengkap minimal 3 karakter.')
    .max(60, 'Nama lengkap maksimal 60 karakter.'),
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter.')
    .max(30, 'Username maksimal 30 karakter.')
    .regex(
      usernameRegex,
      'Username hanya boleh berisi huruf, angka, titik, underscore, atau tanda hubung.',
    ),
  role: z.enum(['ADMIN', 'SUPER_ADMIN'], {
    error: 'Hak akses harus bernilai ADMIN atau SUPER_ADMIN.',
  }),
  password: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter.')
    .max(50, 'Kata sandi maksimal 50 karakter.'),
});

export const updateAdminSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Nama lengkap minimal 3 karakter.')
    .max(60, 'Nama lengkap maksimal 60 karakter.')
    .optional(),
  role: z.enum(['ADMIN', 'SUPER_ADMIN']).optional(),
  password: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter.')
    .max(50, 'Kata sandi maksimal 50 karakter.')
    .optional(),
  isActive: z.boolean().optional(),
});

export const adminUserController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userModel.listStaffAndAdmin();
      sendSuccess(res, users);
    } catch (error) {
      next(error);
    }
  },

  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userModel.findStaffOrAdminById(id);

      if (!user) {
        throw new AppError('USER_NOT_FOUND', `Akun dengan ID '${id}' tidak ditemukan.`, 404);
      }

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fullName, username: rawUsername, role, password } = req.body as {
        fullName: string;
        username: string;
        role: 'ADMIN' | 'SUPER_ADMIN';
        password: string;
      };
      const username = rawUsername.trim().toLowerCase();
      const actorUser = req.user!;

      const existing = await userModel.findByUsername(username);
      if (existing) {
        throw new AppError(
          'USERNAME_EXISTS',
          'Username ini sudah dipakai akun lain.',
          409,
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await userModel.createWithAudit(
        {
          fullName,
          username,
          phoneNumber: null,
          role: role as UserRole,
          passwordHash,
          isActive: true,
        },
        { actorId: actorUser.userId, action: 'CREATE_ADMIN_ACCOUNT' },
      );

      sendSuccess(res, newUser, 201);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { fullName, role, password, isActive } = req.body as {
        fullName?: string;
        role?: 'ADMIN' | 'SUPER_ADMIN';
        password?: string;
        isActive?: boolean;
      };
      const actorUser = req.user!;

      const existing = await userModel.findById(id);
      if (!existing) {
        throw new AppError('USER_NOT_FOUND', `Akun dengan ID '${id}' tidak ditemukan.`, 404);
      }

      // Akun yang sedang dipakai tidak boleh menurunkan perannya sendiri.
      // Tanpa penjagaan ini, seorang super admin bisa melepas hak aksesnya lalu terkunci
      // di luar portal tanpa jalur pemulihan lewat antarmuka.
      if (existing.id === actorUser.userId && role && role !== existing.role) {
        throw new AppError(
          'CANNOT_CHANGE_OWN_ROLE',
          'Peran akun yang sedang dipakai untuk masuk tidak dapat diubah sendiri.',
          409,
        );
      }

      // Akun yang sedang dipakai tidak boleh menonaktifkan dirinya sendiri.
      if (existing.id === actorUser.userId && isActive === false) {
        throw new AppError(
          'CANNOT_DEACTIVATE_SELF',
          'Akun yang sedang dipakai untuk masuk tidak dapat dinonaktifkan.',
          409,
        );
      }

      // Portal harus selalu menyisakan minimal satu super admin aktif. Pemeriksaan ini
      // menutup celah dua super admin yang saling menurunkan sampai tersisa nol super admin.
      const willStopBeingActiveSuperAdmin =
        existing.role === UserRole.SUPER_ADMIN &&
        existing.isActive &&
        ((role && role !== UserRole.SUPER_ADMIN) || isActive === false);

      if (willStopBeingActiveSuperAdmin) {
        const activeSuperAdminCount = await userModel.countActiveSuperAdmins();
        if (activeSuperAdminCount <= 1) {
          throw new AppError(
            'LAST_ADMIN_PROTECTED',
            'Akun super admin aktif terakhir tidak dapat diturunkan atau dinonaktifkan. Buat super admin lain lebih dulu.',
            409,
          );
        }
      }

      const updateData: Prisma.UserUpdateInput = {};
      if (fullName) updateData.fullName = fullName;
      if (role) updateData.role = role as UserRole;
      if (typeof isActive === 'boolean') updateData.isActive = isActive;
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      const perluCabutSesi =
        Boolean(password) ||
        (Boolean(role) && role !== existing.role) ||
        isActive === false;

      if (perluCabutSesi) {
        updateData.tokenVersion = { increment: 1 };
      }

      // Hash sandi tidak ikut dicatat; hanya nama kolom yang berubah.
      const changedFields = Object.keys(updateData).filter((k) => k !== 'passwordHash');

      const updated = await userModel.updateWithAudit(id, updateData, {
        actorId: actorUser.userId,
        action: 'UPDATE_ADMIN_ACCOUNT',
        entityType: 'User',
        entityId: id,
        metadata: { changes: changedFields },
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Menghapus akun admin/super admin.
   *
   * Batasan database yang menentukan penjagaan di bawah:
   * - `audit_logs.actorId` memakai ON DELETE SET NULL, jadi riwayat audit tetap utuh.
   * - `bookings.customerId`, `support_tickets.customerId`, `ticket_messages.senderId`,
   *   dan `otp_verifications.userId` memakai ON DELETE RESTRICT, sehingga MariaDB akan
   *   menolak penghapusan selama masih ada baris yang merujuk akun ini. Kondisi itu
   *   diperiksa lebih dulu supaya pengguna menerima pesan 409 yang jelas, bukan 500.
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const actorUser = req.user!;

      const existing = await userModel.findStaffOrAdminById(id);
      if (!existing) {
        throw new AppError('USER_NOT_FOUND', `Akun dengan ID '${id}' tidak ditemukan.`, 404);
      }

      // Menghapus akun sendiri akan memutus sesi yang sedang dipakai.
      if (existing.id === actorUser.userId) {
        throw new AppError(
          'CANNOT_DELETE_SELF',
          'Akun yang sedang dipakai untuk masuk tidak dapat dihapus.',
          400,
        );
      }

      // Portal harus selalu menyisakan minimal satu super admin aktif.
      if (existing.role === UserRole.SUPER_ADMIN) {
        const activeSuperAdminCount = await userModel.countActiveSuperAdmins();
        if (activeSuperAdminCount <= 1) {
          throw new AppError(
            'LAST_ADMIN_PROTECTED',
            'Akun super admin aktif terakhir tidak dapat dihapus. Buat super admin lain lebih dulu.',
            409,
          );
        }
      }

      const { bookingCount, ticketCount, messageCount, otpCount } =
        await userModel.countBlockingReferences(id);

      if (bookingCount + ticketCount + messageCount + otpCount > 0) {
        throw new AppError(
          'USER_HAS_REFERENCES',
          `Akun tidak dapat dihapus karena masih terhubung dengan ${bookingCount} pemesanan, ${ticketCount} tiket, dan ${messageCount} pesan. Nonaktifkan akun ini sebagai gantinya.`,
          409,
        );
      }

      await userModel.deleteWithAudit(id, {
        actorId: actorUser.userId,
        action: 'DELETE_ADMIN_ACCOUNT',
        entityType: 'User',
        entityId: id,
        metadata: {
          fullName: existing.fullName,
          username: existing.username,
          role: existing.role,
        },
      });

      sendSuccess(res, { id, fullName: existing.fullName });
    } catch (error) {
      next(error);
    }
  },
};
