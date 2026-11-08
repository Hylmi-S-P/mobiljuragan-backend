/**
 * Kebijakan kata sandi pelanggan.
 *
 * Satu-satunya sumber aturan di sisi server. Klien punya salinan aturan yang
 * sama di `mobiljuragan-mobile/lib/core/validators/password_policy.dart`; kalau
 * salah satu diubah, ubah keduanya. Rujukan lengkap ada di
 * `docs/analisis-akun-tertimpa-otp.md` §6.5.
 *
 * Aturan 1-5 ditampilkan sebagai checklist di aplikasi. Aturan 6-8 sengaja
 * tidak ditampilkan: itu pengaman teknis yang tidak perlu dibebankan ke
 * pengguna sebagai tebakan.
 */

/** Panjang minimum yang diminta produk. */
export const PANJANG_MINIMAL = 8;

/**
 * Batas atas dalam byte UTF-8.
 *
 * bcrypt hanya memakai 72 byte pertama; tanpa batas ini dua kata sandi berbeda
 * bisa dianggap sama. Dihitung dalam byte, bukan karakter, karena emoji dan
 * aksara non-Latin memakai lebih dari satu byte.
 */
export const BATAS_BYTE = 72;

/** Panjang yang membuat kata sandi dianggap kuat tanpa aturan simbol. */
export const PANJANG_PASSPHRASE = 16;

export type KodeAturan =
  | 'PANJANG_MINIMAL'
  | 'HURUF_BESAR'
  | 'HURUF_KECIL'
  | 'ANGKA'
  | 'SIMBOL'
  | 'BATAS_BYTE'
  | 'MENGANDUNG_IDENTITAS'
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
    kode: 'MENGANDUNG_IDENTITAS',
    pesan: 'Jangan memakai nama atau nomor sendiri',
    tampilSebagaiChecklist: false,
  },
  {
    kode: 'TERLALU_UMUM',
    pesan: 'Kata sandi terlalu umum',
    tampilSebagaiChecklist: false,
  },
];

/**
 * Kata sandi yang paling sering muncul di daftar bocoran.
 *
 * Daftar pendek ini menahan kasus paling nyata tanpa menambah dependensi.
 * Untuk cakupan penuh, ganti dengan pemeriksaan ke basis data kebocoran
 * (mis. Have I Been Pwned k-anonymity) pada fase berikutnya.
 */
const KATA_SANDI_UMUM = new Set([
  'password',
  'password1',
  'password123',
  'password1234',
  'passw0rd',
  'p@ssw0rd',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  '12345678',
  '123456789',
  '1234567890',
  'iloveyou',
  'admin123',
  'administrator',
  'letmein123',
  'welcome1',
  'welcome123',
  'abc12345',
  'abcd1234',
  'monkey123',
  'dragon123',
  'sunshine1',
  'princess1',
  'football1',
  'baseball1',
  'superman1',
  'batman123',
  'mobiljuragan',
  'juragan123',
  'merauke123',
]);

/** Simbol yang dihitung sebagai "ada simbol". */
const POLA_SIMBOL = /[^A-Za-z0-9]/;

/** Deret yang mudah ditebak: 1234, abcd, qwer, dan kebalikannya. */
const DERET_MUDAH = ['1234', '2345', '3456', '4567', '5678', '6789', 'abcd', 'bcde', 'qwer', 'asdf'];

export interface KonteksKataSandi {
  /** Nama pemilik akun, untuk menolak kata sandi yang memuat namanya. */
  fullName?: string | null;
  /** Nomor telepon, dalam bentuk apa pun; dinormalkan sebelum dibandingkan. */
  phoneNumber?: string | null;
}

/** Mengambil hanya angka dari nomor telepon agar "0812-4800-2910" ikut terdeteksi. */
function digitSaja(nilai: string): string {
  return nilai.replace(/\D/g, '');
}

function normalisasiTeks(nilai: string): string {
  return nilai.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Memeriksa kata sandi dan mengembalikan daftar aturan yang GAGAL.
 *
 * Daftar kosong berarti kata sandi lolos. Fungsi ini tidak menyentuh database.
 */
export function periksaKataSandi(
  kataSandi: string,
  konteks: KonteksKataSandi = {},
): KodeAturan[] {
  const gagal: KodeAturan[] = [];

  if (kataSandi.length < PANJANG_MINIMAL) gagal.push('PANJANG_MINIMAL');
  if (!/[A-Z]/.test(kataSandi)) gagal.push('HURUF_BESAR');
  if (!/[a-z]/.test(kataSandi)) gagal.push('HURUF_KECIL');
  if (!/[0-9]/.test(kataSandi)) gagal.push('ANGKA');
  if (!POLA_SIMBOL.test(kataSandi)) gagal.push('SIMBOL');

  if (Buffer.byteLength(kataSandi, 'utf8') > BATAS_BYTE) gagal.push('BATAS_BYTE');

  const polos = normalisasiTeks(kataSandi);
  const kandidatIdentitas: string[] = [];

  if (konteks.fullName) {
    for (const bagian of konteks.fullName.split(/\s+/)) {
      const bersih = normalisasiTeks(bagian);
      // Nama satu-dua huruf terlalu umum untuk dijadikan larangan.
      if (bersih.length >= 3) kandidatIdentitas.push(bersih);
    }
  }

  if (konteks.phoneNumber) {
    const digit = digitSaja(konteks.phoneNumber);
    if (digit.length >= 6) {
      kandidatIdentitas.push(digit);
      // Bentuk lokal tanpa awalan 0 / 62 ikut diperiksa.
      kandidatIdentitas.push(digit.replace(/^62/, '').replace(/^0/, ''));
      kandidatIdentitas.push(digit.replace(/^62/, ''));
    }
  }

  if (
    kandidatIdentitas.some(
      (kandidat) => kandidat.length >= 4 && (polos.includes(kandidat) || digitSaja(kataSandi).includes(kandidat)),
    )
  ) {
    gagal.push('MENGANDUNG_IDENTITAS');
  }

  const hurufKecil = kataSandi.toLowerCase();
  const terlaluUmum =
    KATA_SANDI_UMUM.has(hurufKecil) ||
    KATA_SANDI_UMUM.has(polos) ||
    DERET_MUDAH.some((deret) => hurufKecil.includes(deret));
  if (terlaluUmum) gagal.push('TERLALU_UMUM');

  return gagal;
}

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
