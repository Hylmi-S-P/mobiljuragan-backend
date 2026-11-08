import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken, type AuthTokenPayload } from '../lib/auth.js';
import { sendError } from '../lib/response.js';
import { userModel } from '../model/userModel.js';
import type { UserRole } from '../generated/prisma/client.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload & { id: string; fullName: string };
    }
  }
}

/**
 * Memeriksa header Authorization: Bearer <token> dan memastikan akunnya masih aktif.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'UNAUTHORIZED', 'Header Authorization Bearer token diperlukan.', 401);
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    /*
     * Tidak ada lagi jalan pintas token.
     *
     * Versi sebelumnya menerima token berawalan `demo_jwt_token_` atau
     * `secure_session_` selama bukan produksi, lalu — bila belum ada — MEMBUAT
     * akun pelanggan bernomor tetap di database. Artinya siapa pun yang bisa
     * menulis nilai itu ke secure storage mendapat sesi sah atas akun tersebut,
     * dan akun itu muncul di aplikasi tanpa pernah didaftarkan lewat OTP.
     *
     * Satu-satunya token yang diterima sekarang adalah JWT yang ditandatangani
     * server.
     */
    const payload = verifyAuthToken(token);

    // Token yang masih berlaku tetap ditolak kalau akunnya sudah dinonaktifkan
    const user = await userModel.findActiveSessionUser(payload.userId);

    if (!user || !user.isActive) {
      sendError(res, 'ACCOUNT_INACTIVE', 'Akun tidak ditemukan atau tidak aktif.', 401);
      return;
    }

    /*
     * Token yang diterbitkan sebelum perubahan identitas/kredensial tidak lagi
     * berlaku. Inilah yang membuat "ganti kata sandi" benar-benar memutus sesi
     * lain — kalau tidak, penyerang yang sudah masuk tetap nyaman sampai tokennya
     * kedaluwarsa tujuh hari kemudian.
     */
    const versiToken = payload.ver ?? 0;
    if (versiToken !== user.tokenVersion) {
      sendError(
        res,
        'SESSION_REVOKED',
        'Sesi ini sudah tidak berlaku karena data keamanan akun berubah. Silakan masuk kembali.',
        401,
      );
      return;
    }

    req.user = {
      userId: user.id,
      id: user.id,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };

    next();
  } catch (_error) {
    sendError(res, 'INVALID_TOKEN', 'Token autentikasi tidak valid atau sudah kedaluwarsa.', 401);
  }
}

/**
 * Middleware untuk membatasi endpoint berdasarkan role pengguna.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 'FORBIDDEN', 'Anda tidak memiliki hak akses untuk resource ini.', 403);
      return;
    }

    next();
  };
}

/**
 * Middleware autentikasi opsional: mengecek Bearer token jika disediakan.
 * Jika tidak ada token atau token tidak valid, alur tetap berlanjut tanpa melempar 401.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAuthToken(token);
    const user = await userModel.findActiveSessionUser(payload.userId);

    if (user && user.isActive) {
      req.user = {
        userId: user.id,
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
      };
    }
  } catch {
    // Abaikan error token pada autentikasi opsional
  }

  next();
}

