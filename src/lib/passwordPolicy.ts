/**
 * Kebijakan kata sandi pelanggan.
 *
 * Satu-satunya sumber aturan di sisi server. Klien punya salinan yang sama di
 * `mobiljuragan-mobile/lib/core/validators/password_policy.dart`; kalau salah
 * satu diubah, ubah keduanya. Rujukan: `docs/analisis-akun-tertimpa-otp.md` §6.5.
 *
 * Aturan yang ditegakkan sengaja dibatasi pada bentuk kata sandi saja:
 * panjang minimum, huruf besar, huruf kecil, angka, dan simbol. Penilaian
 * "kata sandi terlalu umum" atau "memuat nama sendiri" tidak dipakai karena
 * sifatnya menebak-nebak dan menolak kata sandi yang sah tanpa alasan yang bisa
 * diprediksi pengguna.
 */

import { z } from 'zod';

/** Panjang minimum yang diminta produk. */
export const PANJANG_MINIMAL = 8;

/**
 * Batas atas dalam byte UTF-8.
 *
 * Bukan aturan gaya, melainkan batas teknis: bcrypt hanya memakai 72 byte
 * pertama, sehingga tanpa batas ini dua kata sandi berbeda bisa dianggap sama.
 * Dihitung dalam byte karena emoji dan aksara non-Latin memakai lebih dari satu
 * byte per karakter. Batas 72 byte juga memenuhi rekomendasi OWASP ASVS 2.1.2
 * (minimal 64 karakter).
 */
export const BATAS_BYTE = 72;

/**
 * Daftar ringkas kata sandi yang terlalu umum atau sering dipakai sebagai bawaan
 * (OWASP ASVS 2.1.7). Pemeriksaan hanya dijalankan saat buat/ubah/reset sandi,
 * tidak pernah saat login agar akun lama tetap bisa masuk untuk mengganti sandinya.
 */
const KATA_SANDI_UMUM = new Set([
  'admin123!',
  'admin1234!',
  'admin@123',
  'superadmin123!',
  'password1!',
  'password123!',
  'password@123',
  'qwerty123!',
  'qwerty@123',
  'welcome1!',
  'welcome123!',
  'mobiljuragan123!',
  'juragan123!',
  'merauke123!',
  'rahasia123!',
  '12345678a!',
  'aa123456!',
]);

export type KodeAturan =
  | 'PANJANG_MINIMAL'
  | 'HURUF_BESAR'
  | 'HURUF_KECIL'
  | 'ANGKA'
  | 'SIMBOL'
  | 'BATAS_BYTE'
  | 'TERLALU_UMUM';

export interface AturanKataSandi {
  kode: KodeAturan;
  /** Pesan siap tampil; sama bunyinya dengan versi klien. */
  pesan: string;
  /** true = aturan ini tampil sebagai checklist di aplikasi. */
  tampilSebagaiChecklist: boolean;
}

export const ATURAN_KATA_SANDI: AturanKataSandi[] = [
  {
    kode: 'PANJANG_MINIMAL',
    pesan: `Minimal ${PANJANG_MINIMAL} karakter`,
    tampilSebagaiChecklist: true,
  },
  { kode: 'HURUF_BESAR', pesan: 'Ada huruf besar', tampilSebagaiChecklist: true },
  { kode: 'HURUF_KECIL', pesan: 'Ada huruf kecil', tampilSebagaiChecklist: true },
  { kode: 'ANGKA', pesan: 'Ada angka', tampilSebagaiChecklist: true },
  { kode: 'SIMBOL', pesan: 'Ada simbol', tampilSebagaiChecklist: true },
  {
    kode: 'BATAS_BYTE',
    pesan: `Maksimal ${BATAS_BYTE} byte`,
    tampilSebagaiChecklist: false,
  },
  {
    kode: 'TERLALU_UMUM',
    pesan: 'Kata sandi terlalu umum dan mudah ditebak',
    tampilSebagaiChecklist: false,
  },
];

/** Apa pun yang bukan huruf atau angka dihitung sebagai simbol. */
const POLA_SIMBOL = /[^A-Za-z0-9]/;

export function apakahKataSandiUmum(kataSandi: string): boolean {
  return KATA_SANDI_UMUM.has(kataSandi.trim().toLowerCase());
}

/**
 * Memeriksa kata sandi dan mengembalikan daftar aturan yang GAGAL.
 *
 * Daftar kosong berarti kata sandi lolos. Fungsi ini tidak menyentuh database
 * dan tidak membutuhkan data lain dari pengguna.
 */
export function periksaKataSandi(kataSandi: string): KodeAturan[] {
  const gagal: KodeAturan[] = [];

  if (kataSandi.length < PANJANG_MINIMAL) gagal.push('PANJANG_MINIMAL');
  if (!/[A-Z]/.test(kataSandi)) gagal.push('HURUF_BESAR');
  if (!/[a-z]/.test(kataSandi)) gagal.push('HURUF_KECIL');
  if (!/[0-9]/.test(kataSandi)) gagal.push('ANGKA');
  if (!POLA_SIMBOL.test(kataSandi)) gagal.push('SIMBOL');

  if (Buffer.byteLength(kataSandi, 'utf8') > BATAS_BYTE) gagal.push('BATAS_BYTE');
  if (apakahKataSandiUmum(kataSandi)) gagal.push('TERLALU_UMUM');

  return gagal;
}

/**
 * Skema Zod tunggal untuk validasi kata sandi baru (pelanggan maupun admin/super admin).
 * Tidak memakai `.trim()` sesuai OWASP ASVS 2.1.4 agar spasi dalam passphrase tetap sah.
 */
export const passwordPolicyZodSchema = z
  .string({
    error: 'Kata sandi wajib diisi.',
  })
  .min(PANJANG_MINIMAL, `Kata sandi minimal ${PANJANG_MINIMAL} karakter.`)
  .refine((val) => Buffer.byteLength(val, 'utf8') <= BATAS_BYTE, {
    message: `Kata sandi maksimal ${BATAS_BYTE} byte.`,
  })
  .refine((val) => /[A-Z]/.test(val), { message: 'Kata sandi harus memuat huruf besar.' })
  .refine((val) => /[a-z]/.test(val), { message: 'Kata sandi harus memuat huruf kecil.' })
  .refine((val) => /[0-9]/.test(val), { message: 'Kata sandi harus memuat angka.' })
  .refine((val) => POLA_SIMBOL.test(val), { message: 'Kata sandi harus memuat simbol.' })
  .refine((val) => !apakahKataSandiUmum(val), {
    message: 'Kata sandi terlalu umum. Gunakan kombinasi lain yang lebih unik.',
  });

/**
 * Username admin/super admin: 3-30 karakter, diawali dan diakhiri huruf/angka,
 * hanya boleh memuat huruf, angka, titik, underscore, atau tanda hubung tanpa tanda baca berurutan.
 */
const ADMIN_USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/i;

export const adminUsernameZodSchema = z
  .string()
  .trim()
  .min(3, 'Username minimal 3 karakter.')
  .max(30, 'Username maksimal 30 karakter.')
  .regex(
    ADMIN_USERNAME_REGEX,
    'Username harus diawali dan diakhiri huruf/angka, serta hanya boleh berisi huruf, angka, titik, underscore, atau tanda hubung.',
  )
  .refine((val) => !/[._-]{2}/.test(val), {
    message: 'Username tidak boleh memuat tanda baca berurutan (seperti .. atau --).',
  });

/** Pesan untuk satu kode aturan. */
export function pesanAturan(kode: KodeAturan): string {
  return ATURAN_KATA_SANDI.find((aturan) => aturan.kode === kode)?.pesan ?? kode;
}

/**
 * Ringkasan untuk respons galat.
 *
 * `details.rules` memakai kode yang sama dengan checklist klien, sehingga
 * aplikasi bisa menyorot baris yang salah tanpa mencocokkan teks.
 */
export function ringkasanKegagalan(kode: KodeAturan[]): {
  message: string;
  rules: { code: KodeAturan; message: string }[];
} {
  return {
    message: `Kata sandi belum memenuhi syarat: ${kode.map(pesanAturan).join(', ')}.`,
    rules: kode.map((k) => ({ code: k, message: pesanAturan(k) })),
  };
}
