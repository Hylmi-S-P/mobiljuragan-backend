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

const loginSchema = z
  .object({
    phoneNumber: z.string().optional(),
    username: z.string().optional(),
    password: z.string().min(6, 'Password minimal 6 karakter.'),
  })
  .refine((data) => Boolean(data.phoneNumber || data.username), {
    message: 'Nomor telepon atau username wajib diisi.',
    path: ['phoneNumber'],
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
  try {
    const { phoneNumber: rawPhone, username: rawUsername, password } = req.body;
    const identifier = (rawPhone || rawUsername || '').trim();

    let user = null;
    if (/^[0-9+]+$/.test(identifier) || identifier.startsWith('0') || identifier.startsWith('62')) {
      const phoneNumber = normalizePhoneNumber(identifier);
      user = await db.user.findUnique({
        where: { phoneNumber },
      });
    } else {
      // Alias username standar atau pencarian berdasarkan nama staf
      const lower = identifier.toLowerCase();
      if (lower === 'admin' || lower === 'admin.mobiljuragan') {
        user = await db.user.findUnique({ where: { phoneNumber: '081234567890' } });
      } else if (lower === 'staf' || lower === 'staf.operasional') {
        user = await db.user.findUnique({ where: { phoneNumber: '081234567899' } });
      } else {
        user = await db.user.findFirst({
          where: {
            OR: [
              { phoneNumber: identifier },
              { fullName: { contains: identifier } },
            ],
          },
        });
      }
    }

    // Validasi user, status aktif, dan role
    if (!user || !user.isActive || (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF)) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Nomor telepon/username atau password salah.', 401);
    }

    if (!user.passwordHash) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Akun belum memiliki password terdaftar.', 401);
    }

    const isPasswordMatch = await verifyPassword(password, user.passwordHash);
    if (!isPasswordMatch) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Nomor telepon atau password salah.', 401);
    }

    // Rekam riwayat login ke AuditLog
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
  } catch (error) {
    // Express 4 tidak menampung promise yang ditolak dari handler async,
    // jadi kegagalan database di sini harus dibalas sendiri sebagai 500.
    return sendError(res, 'ADMIN_LOGIN_ERROR', 'Gagal memproses login. Coba lagi nanti.', 500);
  }
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
