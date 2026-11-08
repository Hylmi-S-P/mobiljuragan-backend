import type { NextFunction, Request, Response } from 'express';
import { AppError, sendSuccess } from '../lib/response.js';
import { catatIdentitas, konteksDari } from '../lib/identityAudit.js';
import { adminCustomerModel } from '../model/adminCustomerModel.js';
import { logger } from '../logger.js';
import { whatsappOtpService } from '../services/whatsappOtp.service.js';

/**
 * Pengelolaan akun pelanggan dari dashboard.
 *
 * Fokus modul ini bukan "mengedit akun", melainkan **menelusuri dan memulihkan**
 * identitas. Latar belakangnya insiden 8 November 2026: nama seorang pelanggan
 * berubah menjadi nama orang lain tanpa jejak, dan tidak ada alat untuk
 * mengembalikannya.
 */

function aktor(req: Request): { id: string; nama: string } {
  const user = req.user;
  if (!user) throw new AppError('UNAUTHORIZED', 'Autentikasi diperlukan.', 401);
  return { id: user.userId, nama: user.fullName };
}

export const adminCustomerController = {
  /**
   * GET /api/v1/admin/customers
   *
   * `curiga=true` menampilkan akun yang `updatedAt`-nya jauh setelah `createdAt`
   * — ciri akun yang identitasnya pernah berubah tanpa tercatat.
   */
  async daftar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cari, curiga, tanpaSandi, page, limit } = req.query as Record<string, string>;

      const hasil = await adminCustomerModel.daftar({
        cari: cari?.trim() || undefined,
        hanyaMencurigakan: curiga === 'true',
        hanyaTanpaKataSandi: tanpaSandi === 'true',
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      sendSuccess(res, hasil);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/v1/admin/customers/:id — profil + riwayat identitas. */
  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hasil = await adminCustomerModel.detail(req.params.id);
      if (!hasil) {
        throw new AppError('CUSTOMER_NOT_FOUND', 'Akun pelanggan tidak ditemukan.', 404);
      }
      sendSuccess(res, hasil);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/customers/:id/name
   *
   * Koreksi nama oleh admin. Alasan wajib, karena inilah satu-satunya keterangan
   * mengapa identitas seseorang diubah oleh orang lain.
   */
  async koreksiNama(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { fullName, reason } = req.body as { fullName: string; reason: string };
      const admin = aktor(req);

      const namaBaru = String(fullName).trim();
      if (namaBaru.length < 3) {
        throw new AppError('INVALID_INPUT', 'Nama lengkap minimal 3 karakter.', 400);
      }

      const alasan = String(reason ?? '').trim();
      if (alasan.length < 10) {
        throw new AppError(
          'REASON_REQUIRED',
          'Alasan koreksi wajib diisi minimal 10 karakter agar jejaknya bisa ditelusuri.',
          400,
        );
      }

      const sebelum = await adminCustomerModel.detail(id);
      if (!sebelum) {
        throw new AppError('CUSTOMER_NOT_FOUND', 'Akun pelanggan tidak ditemukan.', 404);
      }

      if (sebelum.user.fullName === namaBaru) {
        sendSuccess(res, {
          message: 'Nama tidak berubah.',
          user: sebelum.user,
        });
        return;
      }

      const sesudah = await adminCustomerModel.koreksiNama({
        userId: sebelum.user.id,
        namaBaru,
        namaLama: sebelum.user.fullName,
      });

      await catatIdentitas({
        userId: sebelum.user.id,
        actorType: 'ADMIN',
        actorId: admin.id,
        action: 'PROFILE_NAME_CHANGED',
        field: 'fullName',
        before: sebelum.user.fullName,
        after: namaBaru,
        reason: `Koreksi admin (${admin.nama}): ${alasan}`,
        konteks: konteksDari(req),
      });

      /* Pemilik nomor diberi tahu. Kalau koreksi ini justru tidak diharapkan,
         pesan inilah cara ia mengetahuinya. */
      whatsappOtpService
        .sendIdentityChanged({
          phoneNumber: sesudah.phoneNumber,
          nama: namaBaru,
          perubahan: `Nama akun dikoreksi oleh admin menjadi "${namaBaru}". Alasan: ${alasan}`,
          waktu: new Date(),
        })
        .catch((err) => {
          logger.error({ err, userId: sebelum.user.id }, '[ADMIN] Gagal kirim notifikasi koreksi nama.');
        });

      logger.info(
        { adminId: admin.id, userId: sebelum.user.id, dari: sebelum.user.fullName, ke: namaBaru },
        '[ADMIN] Nama pelanggan dikoreksi.',
      );

      sendSuccess(res, {
        message: `Nama diperbarui dari "${sebelum.user.fullName}" menjadi "${namaBaru}".`,
        user: sesudah,
      });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/v1/admin/customers/:id/unlock — buka penguncian akun. */
  async bukaKunci(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const admin = aktor(req);
      const { reason } = req.body as { reason?: string };

      const hasil = await adminCustomerModel.bukaKunci(id);
      if (!hasil) {
        throw new AppError('CUSTOMER_NOT_FOUND', 'Akun pelanggan tidak ditemukan.', 404);
      }

      await catatIdentitas({
        userId: hasil.id,
        actorType: 'ADMIN',
        actorId: admin.id,
        action: 'SESSIONS_REVOKED',
        field: 'lockedUntil',
        before: 'terkunci',
        after: 'terbuka',
        reason: `Buka kunci oleh admin (${admin.nama})${reason ? `: ${reason}` : ''}`,
        konteks: konteksDari(req),
      });

      sendSuccess(res, {
        message: `Penguncian akun ${hasil.fullName} dibuka.`,
        user: hasil,
      });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/v1/admin/customers/:id/revoke-sessions — paksa masuk ulang. */
  async cabutSesi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const admin = aktor(req);
      const { reason } = req.body as { reason?: string };

      const hasil = await adminCustomerModel.cabutSesi(id);

      await catatIdentitas({
        userId: hasil.id,
        actorType: 'ADMIN',
        actorId: admin.id,
        action: 'SESSIONS_REVOKED',
        field: 'tokenVersion',
        after: String(hasil.tokenVersion),
        reason: `Dicabut admin (${admin.nama})${reason ? `: ${reason}` : ''}`,
        konteks: konteksDari(req),
      });

      sendSuccess(res, {
        message: 'Semua sesi pelanggan dicabut. Ia harus masuk kembali.',
        tokenVersion: hasil.tokenVersion,
      });
    } catch (error) {
      next(error);
    }
  },

  /** PATCH /api/v1/admin/customers/:id/active — aktif/nonaktifkan akun. */
  async ubahAktif(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive, reason } = req.body as { isActive: boolean; reason?: string };
      const admin = aktor(req);

      const hasil = await adminCustomerModel.ubahStatusAktif(id, isActive);

      await catatIdentitas({
        userId: hasil.id,
        actorType: 'ADMIN',
        actorId: admin.id,
        action: isActive ? 'PROFILE_NAME_CHANGED' : 'SESSIONS_REVOKED',
        field: 'isActive',
        before: String(!isActive),
        after: String(isActive),
        reason: `${isActive ? 'Aktifkan' : 'Nonaktifkan'} oleh admin (${admin.nama})${reason ? `: ${reason}` : ''}`,
        konteks: konteksDari(req),
      });

      sendSuccess(res, {
        message: isActive ? 'Akun diaktifkan kembali.' : 'Akun dinonaktifkan.',
        user: hasil,
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/v1/admin/identity-audit — peristiwa identitas lintas akun. */
  async audit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, page, limit } = req.query as Record<string, string>;
      const hasil = await adminCustomerModel.auditGlobal({
        action: action?.trim() || undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      sendSuccess(res, hasil);
    } catch (error) {
      next(error);
    }
  },
};
