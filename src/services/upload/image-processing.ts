import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from '../../lib/response.js';
import { fileStorage } from '../storage/local-storage.js';

/**
 * Pemrosesan gambar unggahan pelanggan.
 *
 * Alur: periksa isi berkas (bukan ekstensi) -> batasi ukuran/dimensi ->
 * normalisasi orientasi -> buang metadata (EXIF/GPS) -> simpan sebagai WebP.
 *
 * Server tidak boleh mempercayai nama berkas atau `Content-Type` dari klien:
 * keduanya mudah dipalsukan. Yang diperiksa adalah magic bytes-nya.
 */

/** Batas ukuran berkas sebelum diproses. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
/** Batas dimensi setelah resize (sisi terpanjang). */
export const MAX_IMAGE_DIMENSION = 2000;

/** Hanya format gambar ini yang diterima. PDF sengaja ditolak. */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Signature minimum yang dikenali, dipakai saat file-type tidak tersedia. */
const MAGIC_SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
];

function detectByMagic(buffer: Buffer): string | null {
  for (const signature of MAGIC_SIGNATURES) {
    const offset = signature.offset ?? 0;
    const slice = buffer.subarray(offset, offset + signature.bytes.length);
    if (slice.length === signature.bytes.length && signature.bytes.every((b, i) => slice[i] === b)) {
      if (signature.mime === 'image/webp') {
        // "RIFF....WEBP"
        const marker = buffer.subarray(8, 12).toString('ascii');
        if (marker !== 'WEBP') continue;
      }
      return signature.mime;
    }
  }
  return null;
}

function assertImageType(buffer: Buffer): string {
  const detected = detectByMagic(buffer);
  if (!detected || !ALLOWED_MIME.has(detected)) {
    throw new AppError(
      'UNSUPPORTED_FILE_TYPE',
      'Berkas harus berupa gambar JPG, PNG, atau WebP. PDF dan format lain tidak diterima.',
      400,
    );
  }
  return detected;
}

/**
 * Memvalidasi, mengonversi, dan menyimpan satu gambar.
 *
 * @returns URL relatif yang disimpan ke database.
 */
export async function processAndStoreImage(
  buffer: Buffer,
  options: { prefix: string; originalName?: string },
): Promise<string> {
  if (!buffer || buffer.byteLength === 0) {
    throw new AppError('EMPTY_FILE', 'Berkas kosong tidak dapat diproses.', 400);
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError(
      'FILE_TOO_LARGE',
      'Ukuran berkas maksimal 5 MB.',
      400,
    );
  }

  assertImageType(buffer);

  let output: Buffer;
  try {
    output = await sharp(buffer, { failOn: 'error' })
      .rotate() // menghormati orientasi kamera
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new AppError(
      'CORRUPT_IMAGE',
      'Berkas gambar tidak dapat dibaca. Coba unggah ulang.',
      400,
    );
  }

  /* Nama berkas selalu dibuat server: nama asli dari klien tidak dipakai,
     sehingga tidak ada `../`, spasi aneh, atau ekstensi ganda. */
  const key = `${options.prefix}/${randomUUID()}.webp`;
  await fileStorage.put(key, output, 'image/webp');

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
