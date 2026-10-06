import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess, sendError, AppError } from '../../utils/response.js';
import { UserRole } from '../../generated/prisma/client.js';

export const adminUserRouter: Router = Router();

// Seluruh rute manajemen admin membutuhkan autentikasi staf/admin
adminUserRouter.use(requireAuth);
adminUserRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.trim().replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  } else if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

const createAdminSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.'),
  phoneNumber: z.string().trim().min(8, 'Nomor telepon/kontak minimal 8 digit.'),
  role: z.enum(['ADMIN', 'STAFF'], {
    errorMap: () => ({ message: 'Peran harus bernilai ADMIN atau STAFF.' }),
  }),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
});

const updateAdminSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').optional(),
  phoneNumber: z.string().trim().min(8, 'Nomor telepon/kontak minimal 8 digit.').optional(),
  role: z.enum(['ADMIN', 'STAFF']).optional(),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.').optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/v1/admin/users
 * Mengambil daftar seluruh akun staf dan admin pengelola portal.
 */
adminUserRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await db.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.STAFF] },
      },
      orderBy: [
        { role: 'asc' },
        { fullName: 'asc' },
      ],
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    sendSuccess(res, users);
  } catch (error) {
    sendError(res, 'FETCH_ADMIN_USERS_ERROR', 'Gagal memuat daftar akun admin.', 500);
  }
});

/**
 * GET /api/v1/admin/users/:id
 * Mengambil detail satu akun staf/admin.
 */
adminUserRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await db.user.findFirst({
      where: {
        id,
        role: { in: [UserRole.ADMIN, UserRole.STAFF] },
      },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('USER_NOT_FOUND', `Akun dengan ID '${id}' tidak ditemukan.`, 404);
    }

    sendSuccess(res, user);
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }
    sendError(res, 'FETCH_ADMIN_USER_DETAIL_ERROR', 'Gagal memuat detail akun admin.', 500);
  }
});

/**
 * POST /api/v1/admin/users
 * Mendaftarkan akun admin atau staf operasional baru.
 */
adminUserRouter.post('/', validateBody(createAdminSchema), async (req: Request, res: Response) => {
  try {
    const { fullName, phoneNumber: rawPhone, role, password } = req.body;
    const phoneNumber = normalizePhoneNumber(rawPhone);
    const actorUser = req.user!;

    // Cek duplikasi nomor telepon
    const existing = await db.user.findUnique({
      where: { phoneNumber },
    });

    if (existing) {
      throw new AppError('PHONE_NUMBER_EXISTS', 'Nomor telepon ini sudah terdaftar pada sistem.', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName,
          phoneNumber,
          role: role as UserRole,
          passwordHash,
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUser.userId,
          action: 'CREATE_ADMIN_ACCOUNT',
          entityType: 'User',
          entityId: created.id,
          metadata: {
            fullName: created.fullName,
            phoneNumber: created.phoneNumber,
            role: created.role,
          },
        },
      });

      return created;
    });

    sendSuccess(res, newUser, 201);
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }
    sendError(res, 'CREATE_ADMIN_USER_ERROR', 'Gagal membuat akun admin baru.', 500);
  }
});

/**
 * PATCH /api/v1/admin/users/:id
 * Memperbarui data akun, peran, atau sandi staf/admin.
 */
adminUserRouter.patch('/:id', validateBody(updateAdminSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber: rawPhone, role, password, isActive } = req.body;
    const actorUser = req.user!;

    const existing = await db.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('USER_NOT_FOUND', `Akun dengan ID '${id}' tidak ditemukan.`, 404);
    }

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (role) updateData.role = role as UserRole;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (rawPhone) {
      const phoneNumber = normalizePhoneNumber(rawPhone);
      if (phoneNumber !== existing.phoneNumber) {
        const phoneCheck = await db.user.findUnique({ where: { phoneNumber } });
        if (phoneCheck) {
          throw new AppError('PHONE_NUMBER_EXISTS', 'Nomor telepon ini sudah dipakai akun lain.', 409);
        }
        updateData.phoneNumber = phoneNumber;
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const userResult = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUser.userId,
          action: 'UPDATE_ADMIN_ACCOUNT',
          entityType: 'User',
          entityId: id,
          metadata: {
            changes: Object.keys(updateData).filter((k) => k !== 'passwordHash'),
          },
        },
      });

      return userResult;
    });

    sendSuccess(res, updated);
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }
    sendError(res, 'UPDATE_ADMIN_USER_ERROR', 'Gagal memperbarui akun admin.', 500);
  }
});
