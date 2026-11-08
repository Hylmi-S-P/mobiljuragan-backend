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

/** Panjang minimum yang diminta produk. */
export const PANJANG_MINIMAL = 8;

/**
 * Batas atas dalam byte UTF-8.
 *
 * Bukan aturan gaya, melainkan batas teknis: bcrypt hanya memakai 72 byte
 * pertama, sehingga tanpa batas ini dua kata sandi berbeda bisa dianggap sama.
 * Dihitung dalam byte karena emoji dan aksara non-Latin memakai lebih dari satu
 * byte per karakter.
 */
export const BATAS_BYTE = 72;

export type KodeAturan =
  | 'PANJANG_MINIMAL'
  | 'HURUF_BESAR'
  | 'HURUF_KECIL'
  | 'ANGKA'
  | 'SIMBOL'
  | 'BATAS_BYTE';

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
];

/** Apa pun yang bukan huruf atau angka dihitung sebagai simbol. */
const POLA_SIMBOL = /[^A-Za-z0-9]/;

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
