import { db } from '../db.js';
import { UserRole } from '../generated/prisma/client.js';

/**
 * Profil pemilik sesi: baca, ubah nama, dan ubah kata sandi.
 *
 * Tiga aturan yang dijaga di sini:
 *
 * 1. **Hanya pemilik yang boleh mengubah namanya**, lewat sesi terautentikasi.
 *    Tidak ada jalur lain — dulu `POST /auth/otp/request` bisa mengganti nama
 *    siapa pun hanya dengan mengetik nama berbeda.
 * 2. **Perubahan dicatat** di `identity_audits`, termasuk nilai sebelum/sesudah,
 *    pelaku, IP, dan user agent.
 * 3. **Perubahan kredensial memutus sesi lain** dengan menaikkan `tokenVersion`.
 */

/** Kolom aman untuk dikirim ke klien. */
const PROFIL_PUBLIK = {
  id: true,
  fullName: true,
  phoneNumber: true,
  role: true,
  isActive: true,
  phoneVerifiedAt: true,
  passwordUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const profilModel = {
  ambilPublik(userId: string) {
    return db.user.findUnique({
      where: { id: userId },
      select: {
        ...PROFIL_PUBLIK,
        // Hanya untuk menentukan apakah tombol "buat kata sandi" perlu muncul.
        passwordHash: true,
      },
    });
  },

  /**
   * Mengubah nama dengan **konkurensi optimistik**.
   *
   * `updatedAt` yang dikirim klien harus sama dengan nilai di database. Kalau
   * berbeda, ada perubahan lain di antara waktu baca dan tulis; permintaan
   * ditolak (`null`) daripada menimpa perubahan tersebut diam-diam.
   *
   * Implementasinya memakai `updateMany` bersyarat agar pemeriksaan dan
   * penulisan terjadi dalam satu pernyataan SQL, bukan baca-lalu-tulis.
   */
  async ubahNama(input: {
    userId: string;
    namaBaru: string;
    updatedAtDiharapkan: Date | null;
  }): Promise<{ berubah: boolean; sebelum: string | null; sesudah: string }> {
    return db.$transaction(async (tx) => {
      const sebelum = await tx.user.findUnique({
        where: { id: input.userId },
        select: { fullName: true },
      });

      const hasil = await tx.user.updateMany({
        where: {
          id: input.userId,
          ...(input.updatedAtDiharapkan ? { updatedAt: input.updatedAtDiharapkan } : {}),
        },
        data: { fullName: input.namaBaru },
      });

      return {
        berubah: hasil.count > 0,
        sebelum: sebelum?.fullName ?? null,
        sesudah: input.namaBaru,
      };
    });
  },

  /** Menyimpan kata sandi baru dan menaikkan versi token (semua sesi lain gugur). */
  async simpanKataSandi(input: {
    userId: string;
    passwordHash: string;
  }): Promise<{ tokenVersion: number }> {
    const hasil = await db.user.update({
      where: { id: input.userId },
      data: {
        passwordHash: input.passwordHash,
        passwordUpdatedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    });
    return hasil;
  },

  /** Menaikkan versi token tanpa mengubah kata sandi (mis. logout semua perangkat). */
  async cabutSemuaSesi(userId: string): Promise<{ tokenVersion: number }> {
    return db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
  },

  ambilRingkasUntukLogin(phoneNumber: string) {
    return db.user.findUnique({
      where: { phoneNumber },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        passwordHash: true,
        tokenVersion: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        phoneVerifiedAt: true,
        passwordUpdatedAt: true,
      },
    });
  },

  /**
   * Mencatat kegagalan masuk kata sandi dan mengunci akun bila batas terlampaui.
   *
   * Memakai kolom yang sama dengan portal staf (`failedLoginAttempts`,
   * `lockedUntil`) supaya hanya ada satu mekanisme penguncian di seluruh sistem.
   */
  async catatGagalMasuk(
    userId: string,
    batas: number,
    menitKunci: number,
  ): Promise<{ terkunciSampai: Date | null; sisaPercobaan: number }> {
    const user = await db.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    }).catch(() => ({ failedLoginAttempts: 0 }));

    if (user.failedLoginAttempts >= batas) {
      const terkunciSampai = new Date(Date.now() + menitKunci * 60_000);
      await db.user.update({
        where: { id: userId },
        data: { lockedUntil: terkunciSampai, failedLoginAttempts: 0 },
      });
      return { terkunciSampai, sisaPercobaan: 0 };
    }

    return {
      terkunciSampai: null,
      sisaPercobaan: Math.max(0, batas - user.failedLoginAttempts),
    };
  },

  catatMasukBerhasil(userId: string) {
    return db.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        // Akun lama yang belum punya jejak verifikasi nomor menjadi terverifikasi
        // setelah berhasil masuk lewat OTP/kata sandi.
        phoneVerifiedAt: new Date(),
      },
    });
  },

  /** Peran pelanggan saja: pemulihan kata sandi tidak berlaku untuk staf/admin. */
  async ambilPelanggan(phoneNumber: string) {
    const user = await db.user.findUnique({
      where: { phoneNumber },
      select: { id: true, fullName: true, role: true, isActive: true },
    });
    if (!user || user.role !== UserRole.CUSTOMER) return null;
    return user;
  },
};
