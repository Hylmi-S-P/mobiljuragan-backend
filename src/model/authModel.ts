import { db } from '../db.js';
import { UserRole } from '../generated/prisma/client.js';

/**
 * Lapisan model untuk autentikasi customer (OTP + kata sandi).
 *
 * Sesuai pemisahan tanggung jawab, hanya lapisan ini yang berbicara ke database.
 * Controller memanggil fungsi di sini dan tidak pernah menyusun query sendiri.
 *
 * Aturan penting yang dijaga di sini:
 * 1. Permintaan OTP **tidak pernah** menulis ke tabel `users`. Akun baru hanya
 *    lahir setelah kode diverifikasi, lengkap dengan `phoneVerifiedAt`.
 * 2. Nama tidak pernah diubah oleh jalur autentikasi. Satu-satunya jalan
 *    mengubahnya adalah `PATCH /me` yang terautentikasi (fase berikutnya).
 * 3. Batas percobaan disimpan per nomor telepon (tabel `phone_guards`), bukan
 *    per baris OTP, supaya meminta kode baru tidak mengembalikan jatah tebakan.
 */

/** Batas percobaan verifikasi sebelum nomor diblokir sementara. */
export const OTP_MAX_ATTEMPTS = 5;

/** Lama blokir setelah percobaan habis. */
export const OTP_BLOCK_MINUTES = 15;

/** Jeda minimum antar pengiriman kode ke nomor yang sama. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Kuota pengiriman per jendela waktu. */
export const OTP_SEND_QUOTA = 5;
export const OTP_SEND_WINDOW_MINUTES = 60;

/** Masa berlaku satu kode. */
export const OTP_TTL_MINUTES = 5;

/** Batas maksimum kode aktif yang disimpan untuk satu nomor (jejak audit). */
const MAKS_KODE_TERSIMPAN = 20;

export const authModel = {
  findUserByPhoneNumber(phoneNumber: string) {
    return db.user.findUnique({ where: { phoneNumber } });
  },

  /** Kolom aman untuk dikirim ke klien; `passwordHash` tidak pernah ikut. */
  findPublicUserById(id: string) {
    return db.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        phoneVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /**
   * Membuat pelanggan baru **setelah** nomor terbukti.
   *
   * `phoneVerifiedAt` wajib diisi pemanggil. Fungsi ini tidak dipakai oleh jalur
   * permintaan OTP sama sekali.
   */
  createVerifiedCustomer(input: {
    phoneNumber: string;
    fullName: string;
    passwordHash: string;
    phoneVerifiedAt: Date;
  }) {
    return db.user.create({
      data: {
        phoneNumber: input.phoneNumber,
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        phoneVerifiedAt: input.phoneVerifiedAt,
        role: UserRole.CUSTOMER,
        lastLoginAt: new Date(),
      },
    });
  },

  // ── OTP ────────────────────────────────────────────────────────────────────

  /**
   * Menyimpan kode baru, lebih dulu mencabut kode lama untuk nomor + tujuan yang
   * sama. Dengan begitu hanya ada satu kode yang sah pada satu waktu.
   */
  async simpanKodeBaru(input: {
    userId: string | null;
    phoneNumber: string;
    otpHash: string;
    purpose: string;
    expiresAt: Date;
  }) {
    return db.$transaction(async (tx) => {
      await tx.otpVerification.updateMany({
        where: {
          phoneNumber: input.phoneNumber,
          purpose: input.purpose,
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      const dibuat = await tx.otpVerification.create({ data: input });

      /* Simpan jejak terbatas. Baris lama dipangkas supaya tabel tidak tumbuh
         tanpa batas pada nomor yang sering meminta kode. */
      const lama = await tx.otpVerification.findMany({
        where: { phoneNumber: input.phoneNumber, purpose: input.purpose },
        orderBy: { createdAt: 'desc' },
        skip: MAKS_KODE_TERSIMPAN,
        select: { id: true },
      });
      if (lama.length > 0) {
        await tx.otpVerification.deleteMany({
          where: { id: { in: lama.map((row) => row.id) } },
        });
      }

      return dibuat;
    });
  },

  /** Kode aktif terakhir untuk nomor + tujuan; hanya yang belum dipakai/dicabut. */
  findKodeAktif(phoneNumber: string, purpose: string) {
    return db.otpVerification.findFirst({
      where: {
        phoneNumber,
        purpose,
        consumedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  },

  tandaiKodeTerpakai(id: string) {
    return db.otpVerification.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },

  tambahPercobaanKode(id: string) {
    return db.otpVerification.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  },

  /** Mencabut seluruh kode aktif satu nomor, dipakai setelah berhasil masuk. */
  cabutSemuaKode(phoneNumber: string) {
    return db.otpVerification.updateMany({
      where: { phoneNumber, consumedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // ── Pembatas per nomor ─────────────────────────────────────────────────────

  ambilGuard(phoneNumber: string) {
    return db.phoneGuard.findUnique({ where: { phoneNumber } });
  },

  /**
   * Mencatat satu pengiriman dan mengembalikan keputusan boleh/tidak.
   *
   * Cooldown dan kuota diperiksa di dalam satu transaksi supaya dua permintaan
   * yang datang bersamaan tidak sama-sama lolos.
   */
  async catatPengiriman(
    phoneNumber: string,
    sekarang: Date,
  ): Promise<{ boleh: boolean; alasan?: 'COOLDOWN' | 'KUOTA'; tungguDetik?: number }> {
    return db.$transaction(async (tx) => {
      const guard = await tx.phoneGuard.findUnique({ where: { phoneNumber } });

      if (guard?.blockedUntil && guard.blockedUntil.getTime() > sekarang.getTime()) {
        return {
          boleh: false as const,
          alasan: 'COOLDOWN' as const,
          tungguDetik: Math.ceil((guard.blockedUntil.getTime() - sekarang.getTime()) / 1000),
        };
      }

      const jendelaKedaluwarsa = new Date(
        sekarang.getTime() - OTP_SEND_WINDOW_MINUTES * 60_000,
      );
      const jendelaBaru =
        !guard?.sendWindowStartedAt || guard.sendWindowStartedAt < jendelaKedaluwarsa;
      const hitungan = jendelaBaru ? 0 : guard?.sendCount ?? 0;

      if (hitungan >= OTP_SEND_QUOTA) {
        return { boleh: false as const, alasan: 'KUOTA' as const };
      }

      if (guard?.lastSentAt) {
        const sejakKirim = (sekarang.getTime() - guard.lastSentAt.getTime()) / 1000;
        if (sejakKirim < OTP_RESEND_COOLDOWN_SECONDS) {
          return {
            boleh: false as const,
            alasan: 'COOLDOWN' as const,
            tungguDetik: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - sejakKirim),
          };
        }
      }

      await tx.phoneGuard.upsert({
        where: { phoneNumber },
        create: {
          phoneNumber,
          sendCount: 1,
          sendWindowStartedAt: sekarang,
          lastSentAt: sekarang,
        },
        update: {
          sendCount: jendelaBaru ? 1 : hitungan + 1,
          sendWindowStartedAt: jendelaBaru ? sekarang : undefined,
          lastSentAt: sekarang,
        },
      });

      return { boleh: true as const };
    });
  },

  /** Menambah satu kegagalan verifikasi; memblokir nomor bila batas terlampaui. */
  async catatKegagalanVerifikasi(phoneNumber: string, sekarang: Date) {
    const guard = await db.phoneGuard.upsert({
      where: { phoneNumber },
      create: { phoneNumber, verifyFailures: 1 },
      update: { verifyFailures: { increment: 1 } },
    });

    if (guard.verifyFailures >= OTP_MAX_ATTEMPTS) {
      const blokirSampai = new Date(sekarang.getTime() + OTP_BLOCK_MINUTES * 60_000);
      await db.phoneGuard.update({
        where: { phoneNumber },
        data: { blockedUntil: blokirSampai, verifyFailures: 0 },
      });
      return { terkunciSampai: blokirSampai, sisaPercobaan: 0 };
    }

    return {
      terkunciSampai: null as Date | null,
      sisaPercobaan: Math.max(0, OTP_MAX_ATTEMPTS - guard.verifyFailures),
    };
  },

  /** Mengosongkan hitungan gagal setelah verifikasi berhasil. */
  resetGuard(phoneNumber: string) {
    return db.phoneGuard
      .update({
        where: { phoneNumber },
        data: { verifyFailures: 0, blockedUntil: null },
      })
      .catch(() => null);
  },

  catatLoginBerhasil(userId: string) {
    return db.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
  },
};
