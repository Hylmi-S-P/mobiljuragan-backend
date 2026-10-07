/**
 * Helper penyeragaman nomor telepon.
 *
 * Nomor pelanggan dan staf bisa masuk dalam tiga bentuk: `0812...`, `62812...`,
 * atau `+62 812-...`. Kalau bentuknya tidak diseragamkan lebih dulu, satu orang
 * bisa punya dua akun hanya karena cara menulis nomornya berbeda.
 *
 * Dua format yang dipakai di proyek ini sengaja dipisah:
 * - `normalizePhoneNumber` untuk menyimpan dan membandingkan di database (format lokal).
 * - `toInternationalPhone` untuk tautan WhatsApp, yang butuh kode negara tanpa tanda plus.
 */

/**
 * Menyeragamkan nomor telepon ke format lokal `08xxxxxxxxxx`.
 *
 * Dipakai sebelum menyimpan atau mencari user, supaya `+62`, `62`, dan `0`
 * menghasilkan baris yang sama.
 */
export function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.trim().replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  } else if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Mengubah nomor menjadi format internasional tanpa tanda plus, misalnya `6281234567890`.
 *
 * Dipakai untuk tautan `api.whatsapp.com`, yang menolak tanda plus dan spasi.
 */
export function toInternationalPhone(phone: string): string {
  let cleaned = phone.trim().replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}
