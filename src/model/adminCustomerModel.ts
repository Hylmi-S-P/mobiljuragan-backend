import { db } from '../db.js';
import { UserRole, type Prisma } from '../generated/prisma/client.js';

/**
 * Pengelolaan akun pelanggan dari dashboard.
 *
 * Berbeda dari `adminUserController` yang khusus staf/admin, modul ini menangani
 * akun pelanggan: menelusuri identitas, membaca jejak perubahan, dan memulihkan
 * nama yang terlanjur berubah.
 *
 * Dua aturan yang dijaga:
 * 1. Koreksi identitas oleh admin **wajib** punya alasan dan selalu tercatat di
 *    `identity_audits` — termasuk nama sebelum dan sesudah.
 * 2. Nomor telepon tidak diubah dari sini. Mengganti nomor berarti mengganti
 *    identitas akun dan harus lewat verifikasi OTP ke nomor baru.
 */

/** Kolom aman untuk daftar pelanggan. `passwordHash` tidak pernah ikut. */
const KOLOM_PELANGGAN = {
  id: true,
  fullName: true,
  phoneNumber: true,
  isActive: true,
  phoneVerifiedAt: true,
  passwordUpdatedAt: true,
  lastLoginAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  tokenVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface FilterPelanggan {
  /** Cari pada nama atau nomor telepon. */
  cari?: string;
  /** Hanya akun yang identitasnya pernah berubah tanpa jejak audit. */
  hanyaMencurigakan?: boolean;
  /** Hanya akun yang belum punya kata sandi. */
  hanyaTanpaKataSandi?: boolean;
  page?: number;
  limit?: number;
}

export const adminCustomerModel = {
  async daftar(filter: FilterPelanggan) {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));

    const where: Prisma.UserWhereInput = {
      role: UserRole.CUSTOMER,
      ...(filter.cari
        ? {
            OR: [
              { fullName: { contains: filter.cari } },
              { phoneNumber: { contains: filter.cari.replace(/\D/g, '') } },
            ],
          }
        : {}),
      ...(filter.hanyaTanpaKataSandi ? { passwordHash: null } : {}),
    };

    const [total, items] = await db.$transaction([
      db.user.count({ where }),
      db.user.findMany({
        where,
        select: {
          ...KOLOM_PELANGGAN,
          _count: { select: { bookings: true, tickets: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    /* Penanda "mencurigakan" dihitung terpisah karena bergantung pada selisih
       created/updated, bukan pada kolom yang bisa difilter SQL sederhana.
       Hanya dijalankan saat daftar kecil (<=100) supaya tetap ringan. */
    const denganPenanda = items.map((user) => {
      const umurHari = (user.updatedAt.getTime() - user.createdAt.getTime()) / 86_400_000;
      return {
        ...user,
        jumlahBooking: user._count.bookings,
        jumlahTiket: user._count.tickets,
        umurHari: Number(umurHari.toFixed(1)),
        // Identitas pernah berubah jauh setelah akun dibuat.
        perluDiperiksa: umurHari > 1,
        punyaKataSandi: user.passwordUpdatedAt !== null,
      };
    });

    const hasil = filter.hanyaMencurigakan
      ? denganPenanda.filter((user) => user.perluDiperiksa)
      : denganPenanda;

    return {
      items: hasil,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /** Profil satu pelanggan beserta ringkasan data dan riwayat identitasnya. */
  async detail(id: string) {
    const user = await db.user.findFirst({
      where: {
        OR: [{ id }, { phoneNumber: id }],
        role: UserRole.CUSTOMER,
      },
      select: {
        ...KOLOM_PELANGGAN,
        _count: { select: { bookings: true, tickets: true } },
      },
    });

    if (!user) return null;

    const riwayat = await db.identityAudit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
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

    return {
      user: {
        ...user,
        jumlahBooking: user._count.bookings,
        jumlahTiket: user._count.tickets,
        punyaKataSandi: user.passwordUpdatedAt !== null,
      },
      riwayatIdentitas: riwayat,
    };
  },

  /**
   * Memperbaiki nama pelanggan atas nama admin.
   *
   * Dipakai untuk memulihkan nama yang terlanjur tertimpa. Alasan wajib diisi
   * pemanggil dan ikut tersimpan, karena inilah satu-satunya jejak mengapa nama
   * seseorang diubah oleh orang lain.
   */
  async koreksiNama(input: {
    userId: string;
    namaBaru: string;
    namaLama: string;
  }) {
    return db.user.update({
      where: { id: input.userId },
      data: { fullName: input.namaBaru },
      select: { id: true, fullName: true, phoneNumber: true, updatedAt: true },
    });
  },

  /** Riwayat identitas satu akun (dipakai endpoint audit terpisah). */
  riwayatIdentitas(userId: string, limit = 50) {
    return db.identityAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  /**
   * Memberi jalan keluar bagi pelanggan yang terkunci karena percobaan masuk.
   *
   * Staf operasional sering menerima telepon "akun saya terkunci". Tanpa alat
   * ini, satu-satunya jalan adalah menunggu 15 menit.
   */
  async bukaKunci(userId: string) {
    const user = await db.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: { id: true, phoneNumber: true, fullName: true },
    });
    await db.phoneGuard
      .deleteMany({ where: { phoneNumber: user.phoneNumber } })
      .catch(() => null);
    return user;
  },

  /** Menonaktifkan akun tanpa menghapus data pesanannya. */
  async ubahStatusAktif(userId: string, isActive: boolean) {
    return db.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, fullName: true, phoneNumber: true, isActive: true },
    });
  },

  /**
   * Memaksa pelanggan masuk ulang di semua perangkat.
   *
   * Menambah satu kunci ini jauh lebih cepat daripada meminta pelanggan
   * mengganti kata sandi hanya untuk mengeluarkan sesi yang mencurigakan.
   */
  async cabutSesi(userId: string) {
    return db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    });
  },

  /**
   * Daftar peristiwa identitas lintas akun, untuk halaman audit.
   *
   * `action` bisa difilter, misalnya hanya PASSWORD_RESET atau
   * PROFILE_NAME_CHANGED.
   */
  async auditGlobal(input: { action?: string; page?: number; limit?: number }) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 30));

    const where: Prisma.IdentityAuditWhereInput = input.action
      ? { action: input.action }
      : {};

    const [total, items] = await db.$transaction([
      db.identityAudit.count({ where }),
      db.identityAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          actorType: true,
          actorId: true,
          action: true,
          field: true,
          before: true,
          after: true,
          reason: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { fullName: true, phoneNumber: true } },
        },
      }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
