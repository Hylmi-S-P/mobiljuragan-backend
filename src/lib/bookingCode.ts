import { randomInt } from 'node:crypto';

/**
 * Alfabet kode booking: 0-9 dan A-Z, 36 simbol.
 *
 * Ditulis eksplisit supaya ruang kemungkinan terbaca langsung dari kode:
 * 36^4 = 1.679.616 kode berbeda per tanggal.
 */
const ALFABET_KODE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Panjang bagian acak pada kode booking. */
const PANJANG_ACAK = 4;

/**
 * Tanggal pada kode booking memakai kalender Merauke (WIT, UTC+9), bukan UTC.
 *
 * Alasannya bukan teknis: staf mencocokkan kode dengan tanggal di kalender
 * dinding. Dengan UTC, pesanan yang masuk pukul 00.00-08.59 WIT akan bertanggal
 * kemarin. Waktu itu sendiri tetap disimpan sebagai UTC; hanya label tanggal
 * pada kode yang memakai zona kantor.
 *
 * `en-CA` menghasilkan bentuk YYYY-MM-DD, jadi tidak perlu menyusun ulang.
 */
function tanggalJayapura(sekarang: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jayapura',
  })
    .format(sekarang)
    .replace(/-/g, '');
}

/**
 * Membentuk kode booking berformat MJ-YYYYMMDD-XXXX.
 *
 * Bagian acak diambil dari `crypto.randomInt`, bukan `Math.random`: kode ini
 * dipakai sebagai pengenal yang tidak boleh ditebak orang lain, dan `randomInt`
 * tidak membocorkan keadaan internalnya seperti PRNG biasa.
 *
 * `sekarang` bisa diisi supaya perilaku di sekitar tengah malam WIT bisa diuji
 * tanpa menunggu jam dinding.
 */
export function generateBookingCode(sekarang: Date = new Date()): string {
  const bagianAcak = Array.from({ length: PANJANG_ACAK }, () => ALFABET_KODE[randomInt(ALFABET_KODE.length)]).join('');
  return `MJ-${tanggalJayapura(sekarang)}-${bagianAcak}`;
}
