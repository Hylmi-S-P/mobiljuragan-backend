import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../generated/prisma/client.js';

/**
 * Mengambil rahasia wajib dari environment.
 *
 * Di production, nilai kosong atau terlalu pendek menghentikan proses saat mulai.
 * Sebelumnya ada fallback keras, sehingga server tetap menyala memakai secret yang
 * tertulis di kode dan token siapa pun bisa dipalsukan tanpa gejala yang terlihat.
 */
function ambilRahasia(nama: 'JWT_SECRET' | 'OTP_SALT', bawaanDev: string): string {
  const nilai = process.env[nama];

  if (process.env.NODE_ENV === 'production') {
    if (!nilai || nilai.length < 32) {
      throw new Error(
        `${nama} wajib diisi minimal 32 karakter saat NODE_ENV=production. ` +
          'Nilai bawaan hanya tersedia untuk pengembangan.',
      );
    }
    return nilai;
  }

  return nilai && nilai.length > 0 ? nilai : bawaanDev;
}

const JWT_SECRET = ambilRahasia('JWT_SECRET', 'mobiljuragan-dev-secret-key-change-in-production');
const OTP_SALT = ambilRahasia('OTP_SALT', 'mobiljuragan-otp-salt-key');

export interface AuthTokenPayload {
  userId: string;
  phoneNumber: string;
  role: UserRole;
}

/**
 * Menghasilkan 6-digit OTP acak.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Menghasilkan hash OTP menggunakan SHA-256 + salt.
 * Plaintext OTP tidak boleh disimpan di database!
 */
export function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', OTP_SALT).update(otp).digest('hex');
}

/**
 * Memverifikasi kecocokan OTP dengan hash yang tersimpan.
 */
export function verifyOtpHash(otp: string, storedHash: string): boolean {
  const computedHash = hashOtp(otp);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
}

/**
 * Biaya bcrypt untuk kata sandi pelanggan.
 *
 * Portal staf memakai 10. Untuk pelanggan dipilih **11**, bukan 12, berdasarkan
 * pengukuran pada mesin pengembangan (MySQL + backend + dashboard + emulator
 * berjalan bersamaan):
 *
 * | biaya | rata-rata 3 percobaan |
 * |-------|-----------------------|
 * | 10    | 128 ms                |
 * | 11    | 244 ms                |
 * | 12    | 489 ms                |
 *
 * 489 ms terasa lambat pada ponsel kelas bawah, sementara 244 ms masih dua kali
 * lebih berat daripada akun staf. Naikkan bila server produksi jelas lebih cepat:
 * cukup ubah angka ini, hash lama tetap sah karena biayanya tersimpan di dalam
 * nilai hash (`$2b$11$...`).
 */
export const BIAYA_BCRYPT_PELANGGAN = 11;

/**
 * Hash password untuk staf/admin menggunakan bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Hash kata sandi pelanggan dengan biaya lebih tinggi.
 *
 * Dipisah dari `hashPassword` supaya biaya kedua jenis akun bisa diukur dan
 * diubah sendiri tanpa menyentuh jalur login portal.
 */
export async function hashPasswordPelanggan(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BIAYA_BCRYPT_PELANGGAN);
  return bcrypt.hash(password, salt);
}

/**
 * Verifikasi password staf/admin.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Membuat token JWT autentikasi.
 */
export function signAuthToken(
  payload: AuthTokenPayload,
  expiresIn: string | number = '7d',
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

/**
 * Memverifikasi dan mendekode token JWT.
 */
export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
