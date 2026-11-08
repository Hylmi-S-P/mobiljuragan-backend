import type { Request } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';

/**
 * Jejak perubahan identitas akun.
 *
 * Semua penulisan identitas (nama, nomor, kata sandi) wajib melewati modul ini.
 * Tujuannya satu: pertanyaan "siapa mengubah apa, kapan, dari mana" harus selalu
 * bisa dijawab. Insiden 8 November 2026 terjadi justru karena tidak ada catatan
 * sama sekali saat nama seorang pelanggan diganti.
 */

export type ActorType = 'SELF' | 'ADMIN' | 'SYSTEM';

export type ActionIdentitas =
  | 'PROFILE_NAME_CHANGED'
  | 'PROFILE_PHONE_CHANGED'
  | 'PASSWORD_SET'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_LOGIN_SUCCESS'
  | 'PASSWORD_LOGIN_FAILED'
  | 'SESSIONS_REVOKED';

export interface KonteksPermintaan {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Mengambil alamat IP dan user agent dari permintaan Express. */
export function konteksDari(req: Request): KonteksPermintaan {
  return {
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}

export interface CatatIdentitasInput {
  userId: string;
  actorType: ActorType;
  actorId?: string | null;
  action: ActionIdentitas;
  field: string;
  before?: string | null;
  after?: string | null;
  reason?: string | null;
  konteks?: KonteksPermintaan;
}

/**
 * Menulis satu baris audit.
 *
 * Kegagalan menulis audit **tidak** boleh menggagalkan aksi utama yang sudah
 * berhasil; ia dicatat ke log agar bisa ditindaklanjuti. Untuk perubahan
 * identitas, pemanggil tetap menyelesaikan operasinya di dalam transaksi yang
 * sama bila konsistensi ketat dibutuhkan.
 */
export async function catatIdentitas(input: CatatIdentitasInput): Promise<void> {
  try {
    await db.identityAudit.create({
      data: {
        userId: input.userId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        field: input.field,
        before: input.before ?? null,
        after: input.after ?? null,
        reason: input.reason ?? null,
        ipAddress: input.konteks?.ipAddress ?? null,
        userAgent: input.konteks?.userAgent ?? null,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, userId: input.userId, action: input.action, field: input.field },
      '[AUDIT IDENTITAS] Gagal menulis jejak perubahan identitas.',
    );
  }
}

/** Riwayat perubahan identitas satu akun, terbaru lebih dulu. */
export function riwayatIdentitas(userId: string, limit = 50) {
  return db.identityAudit.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      actorType: true,
      actorId: true,
      action: true,
      field: true,
      before: true,
      after: true,
      reason: true,
      ipAddress: true,
      createdAt: true,
    },
  });
}
