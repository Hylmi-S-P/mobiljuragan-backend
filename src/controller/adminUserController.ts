import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole, type Prisma } from '../generated/prisma/client.js';
import { userModel } from '../model/userModel.js';
import { AppError, sendSuccess } from '../utils/response.js';

/**
 * Controller manajemen akun staf dan admin.
 *
 * Membaca request, menjalankan aturan bisnis, memanggil model, lalu mengirim respons.
 * Semua kegagalan diteruskan lewat `next(error)` agar ditangani errorHandler global
 * satu kali, bukan diulang di setiap blok catch.
 */

/** Menyeragamkan nomor telepon ke format lokal 08xxxx. */
function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.trim().replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  } else if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

export const createAdminSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.'),
  phoneNumber: z.string().trim().min(8, 'Nomor telepon/kontak minimal 8 digit.'),
  role: z.enum(['ADMIN', 'STAFF'], {
    errorMap: () => ({ message: 'Peran harus bernilai ADMIN atau STAFF.' }),
  }),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
});

export const updateAdminSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').optional(),
  phoneNumber: z.string().trim().min(8, 'Nomor telepon/kontak minimal 8 digit.').optional(),
  role: z.enum(['ADMIN', 'STAFF']).optional(),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.').optional(),
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
      const { fullName, phoneNumber: rawPhone, role, password } = req.body;
      const phoneNumber = normalizePhoneNumber(rawPhone);
      const actorUser = req.user!;

      const existing = await userModel.findByPhoneNumber(phoneNumber);
      if (existing) {
        throw new AppError(
          'PHONE_NUMBER_EXISTS',
          'Nomor telepon ini sudah terdaftar pada sistem.',
          409
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await userModel.createWithAudit(
        {
          fullName,
          phoneNumber,
          role: role as UserRole,
          passwordHash,
          isActive: true,
        },
        { actorId: actorUser.userId, action: 'CREATE_ADMIN_ACCOUNT' }
      );

      sendSuccess(res, newUser, 201);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { fullName, phoneNumber: rawPhone, role, password, isActive } = req.body;
      const actorUser = req.user!;

      const existing = await userModel.findById(id);
      if (!existing) {
        throw new AppError('USER_NOT_FOUND', `Akun dengan ID '${id}' tidak ditemukan.`, 404);
      }

      const updateData: Prisma.UserUpdateInput = {};
      if (fullName) updateData.fullName = fullName;
      if (role) updateData.role = role as UserRole;
      if (typeof isActive === 'boolean') updateData.isActive = isActive;
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      if (rawPhone) {
        const phoneNumber = normalizePhoneNumber(rawPhone);
        if (phoneNumber !== existing.phoneNumber) {
          const phoneCheck = await userModel.findByPhoneNumber(phoneNumber);
          if (phoneCheck) {
            throw new AppError(
              'PHONE_NUMBER_EXISTS',
              'Nomor telepon ini sudah dipakai akun lain.',
              409
            );
          }
          updateData.phoneNumber = phoneNumber;
        }
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
   * Menghapus akun staf/admin.
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
          400
        );
      }

      // Portal harus selalu menyisakan minimal satu admin aktif.
      if (existing.role === UserRole.ADMIN) {
        const activeAdminCount = await userModel.countActiveAdmins();
        if (activeAdminCount <= 1) {
          throw new AppError(
            'LAST_ADMIN_PROTECTED',
            'Akun admin aktif terakhir tidak dapat dihapus. Buat admin lain lebih dulu.',
            409
          );
        }
      }

      const { bookingCount, ticketCount, messageCount, otpCount } =
        await userModel.countBlockingReferences(id);

      if (bookingCount + ticketCount + messageCount + otpCount > 0) {
        throw new AppError(
          'USER_HAS_REFERENCES',
          `Akun tidak dapat dihapus karena masih terhubung dengan ${bookingCount} pemesanan, ${ticketCount} tiket, dan ${messageCount} pesan. Nonaktifkan akun ini sebagai gantinya.`,
          409
        );
      }

      await userModel.deleteWithAudit(id, {
        actorId: actorUser.userId,
        action: 'DELETE_ADMIN_ACCOUNT',
        entityType: 'User',
        entityId: id,
        metadata: {
          fullName: existing.fullName,
          phoneNumber: existing.phoneNumber,
          role: existing.role,
        },
      });

      sendSuccess(res, { id, fullName: existing.fullName });
    } catch (error) {
      next(error);
    }
  },
};
