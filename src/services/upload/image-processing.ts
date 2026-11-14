import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/response.js';
import {
  PRESET_GAMBAR,
  normalisasiGambar,
} from '../../lib/imageNormalisasi.js';
import { fileStorage } from '../storage/local-storage.js';

/**
 * Pemrosesan gambar unggahan dokumen sewa (KTP, SIM, surat pernyataan).
 *
 * Aturan pemeriksaan dan normalisasi sekarang dipakai bersama dengan jalur
 * media lewat `imageNormalisasi.ts`. Yang tersisa di sini hanya dua hal yang
 * khas dokumen: kode galat lama yang sudah dijanjikan ke klien, dan penamaan
 * berkas `<id booking>/<uuid>.webp`.
 *
 * Sebelumnya fungsi ini memanggil sharp tanpa `limitInputPixels`, sehingga
 * berkas kecil yang mengaku beresolusi raksasa bisa menghabiskan RAM server.
 */

const ATURAN_DOKUMEN = PRESET_GAMBAR.dokumen;

/** Batas ukuran berkas sebelum diproses. */
export const MAX_UPLOAD_BYTES = ATURAN_DOKUMEN.batasByte; // 5 MB
/** Batas dimensi setelah resize (sisi terpanjang). */
export const MAX_IMAGE_DIMENSION = ATURAN_DOKUMEN.sisiMaksimal;

/**
 * Memvalidasi, mengonversi, dan menyimpan satu gambar dokumen.
 *
 * @returns URL relatif yang disimpan ke database.
 */
export async function processAndStoreImage(
  buffer: Buffer,
  options: { prefix: string; originalName?: string },
): Promise<string> {
  // Pemeriksaan awal mempertahankan kode galat yang sudah dipakai klien.
  if (!buffer || buffer.byteLength === 0) {
    throw new AppError('EMPTY_FILE', 'Berkas kosong tidak dapat diproses.', 400);
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Ukuran berkas maksimal 5 MB.', 400);
  }

  let hasil;
  try {
    hasil = await normalisasiGambar(buffer, 'dokumen');
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'FILE_TOO_MANY_PIXELS') throw error;
      if (error.code === 'FILE_TYPE_NOT_ALLOWED') {
        throw new AppError(
          'UNSUPPORTED_FILE_TYPE',
          'Berkas harus berupa gambar JPG, PNG, atau WebP. PDF dan format lain tidak diterima.',
          400,
        );
      }
    }
    throw new AppError(
      'CORRUPT_IMAGE',
      'Berkas gambar tidak dapat dibaca. Coba unggah ulang.',
      400,
    );
  }

  /* Nama berkas selalu dibuat server: nama asli dari klien tidak dipakai,
     sehingga tidak ada `../`, spasi aneh, atau ekstensi ganda. */
  const key = `${options.prefix}/${randomUUID()}.webp`;
  await fileStorage.put(key, hasil.buffer, 'image/webp');

  return fileStorage.urlFor(key);
}

/**
 * Mendeteksi data URL base64 (format lama) dan mengubahnya menjadi buffer.
 *
 * Dipertahankan agar dokumen yang sudah tersimpan sebelum alur multipart
 * tetap bisa dibaca dan dimigrasikan bertahap.
 */
export function decodeLegacyDataUrl(value: string): Buffer | null {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(value.trim());
  if (!match) return null;
  return Buffer.from(match[2]!, 'base64');
}
