import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { verifyPassword, signAuthToken } from '../../utils/auth.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../logger.js';
import { UserRole } from '../../generated/prisma/client.js';

export const adminAuthRouter: Router = Router();

const loginSchema = z.object({
  phoneNumber: z.string().min(8, 'Nomor telepon minimal 8 karakter.'),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
});

function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.trim().replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  } else if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * POST /api/v1/admin/auth/login
 * Login untuk staf dan admin MobilJuragan.
 */
adminAuthRouter.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  const { phoneNumber: rawPhone, password } = req.body;
  const phoneNumber = normalizePhoneNumber(rawPhone);

  const user = await db.user.findUnique({
    where: { phoneNumber },
  });

  // Validasi user, status aktif, dan role
  if (!user || !user.isActive || (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF)) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Nomor telepon atau password salah.', 401);
  }

  if (!user.passwordHash) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Akun belum memiliki password terdaftar.', 401);
  }

  const isPasswordMatch = await verifyPassword(password, user.passwordHash);
  if (!isPasswordMatch) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Nomor telepon atau password salah.', 401);
  }

  // Rekam ke AuditLog (roadmap §3 & §4)
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: 'ADMIN_LOGIN',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        loginAt: new Date().toISOString(),
      },
    },
  });

  const token = signAuthToken({
    userId: user.id,
    phoneNumber: user.phoneNumber,
    role: user.role,
  });

  logger.info({ userId: user.id, role: user.role }, `[ADMIN LOGIN] ${user.role} ${user.fullName} berhasil login.`);

  return sendSuccess(res, {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
    },
  }, 200);
});

/**
 * GET /api/v1/admin/auth/me
 * Mengambil informasi user staf/admin yang sedang login.
 */
adminAuthRouter.get('/me', requireAuth, requireRole(UserRole.ADMIN, UserRole.STAFF), async (req: Request, res: Response) => {
  return sendSuccess(res, {
    user: req.user,
  }, 200);
});
