import { Router } from 'express';
import { z } from 'zod';
import { adminAuthController } from '../../controller/adminAuthController.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { loginRateLimiter } from '../../middleware/rateLimiter.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Autentikasi staf & admin: /api/v1/admin/auth/*
 */
export const adminAuthRouter: Router = Router();

const loginSchema = z
  .object({
    phoneNumber: z.string().optional(),
    username: z.string().optional(),
    password: z.string().min(1, 'Password wajib diisi.'),
    rememberMe: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.phoneNumber || data.username), {
    message: 'Nomor telepon atau username wajib diisi.',
    path: ['phoneNumber'],
  });

/*
 * Login untuk staf dan admin MobilJuragan.
 *
 * `loginRateLimiter` hanya menghitung permintaan yang gagal, sehingga pengguna
 * sah tidak pernah terkena batas walaupun sering login. Batas panjang password
 * di sini sengaja hanya "wajib diisi": aturan panjang minimum saat login justru
 * membocorkan kebijakan password ke penyerang.
 */
adminAuthRouter.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  adminAuthController.login,
);

// Mengambil informasi user staf/admin yang sedang login.
adminAuthRouter.get(
  '/me',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  adminAuthController.me,
);
