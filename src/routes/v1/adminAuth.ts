import { Router } from 'express';
import { z } from 'zod';
import { adminAuthController } from '../../controller/adminAuthController.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Admin Auth: /api/v1/admin/auth/*
 */
export const adminAuthRouter: Router = Router();

const loginSchema = z
  .object({
    phoneNumber: z.string().optional(),
    username: z.string().optional(),
    password: z.string().min(6, 'Password minimal 6 karakter.'),
    rememberMe: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.phoneNumber || data.username), {
    message: 'Nomor telepon atau username wajib diisi.',
    path: ['phoneNumber'],
  });

// Login untuk staf dan admin MobilJuragan.
adminAuthRouter.post('/login', validateBody(loginSchema), adminAuthController.login);

// Mengambil informasi user staf/admin yang sedang login.
adminAuthRouter.get('/me', requireAuth, requireRole(UserRole.ADMIN, UserRole.STAFF), adminAuthController.me);