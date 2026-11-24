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

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
  rememberMe: z.boolean().optional(),
});

/*
 * Login untuk admin dan super admin MobilJuragan.
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

// Mengambil informasi user admin/super admin yang sedang login.
adminAuthRouter.get(
  '/me',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  adminAuthController.me,
);
