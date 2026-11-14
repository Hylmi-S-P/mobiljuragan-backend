import multer from 'multer';
import { AppError } from './response.js';
import {
  BATAS_PIKSEL,
  PRESET_GAMBAR,
  normalisasiGambar,
  type GambarNormal,
  type PresetGambar,
} from './imageNormalisasi.js';

/**
 * Pipeline unggah gambar: multer menampung berkas di memori, lalu sharp
 * menormalkannya sebelum disimpan.
 *
 * Pemeriksaan isi dan batas piksel ada di `imageNormalisasi.ts`, dipakai
 * bersama jalur dokumen sewa supaya tidak ada lagi jalur yang lupa membatasi
 * piksel.
 */

const ATURAN_MEDIA = PRESET_GAMBAR.media;

/** Batas berkas masuk untuk media. Foto HP terbesar yang wajar masih di bawah ini. */
export const BATAS_UKURAN_BERKAS = ATURAN_MEDIA.batasByte;

/** Sisi terpanjang setelah diperkecil. Cukup tajam untuk layar dan cetak struk. */
export const SISI_MAKSIMAL = ATURAN_MEDIA.sisiMaksimal;

export const KUALITAS_WEBP = ATURAN_MEDIA.kualitas;

/** Bentuk hasil normalisasi, sama untuk semua preset. */
export type GambarSiapSimpan = GambarNormal;

export { BATAS_PIKSEL };

/**
 * Menormalkan satu berkas gambar.
 *
 * @param preset `media` untuk foto katalog, `dokumen` untuk KTP/SIM/surat.
 */
export async function siapkanGambar(
  file: { buffer?: Buffer } | undefined,
  preset: PresetGambar = 'media',
): Promise<GambarNormal> {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new AppError('FILE_EMPTY', 'Berkas gambar kosong.', 400);
  }

  return normalisasiGambar(file.buffer, preset);
}

/**
 * Middleware multer untuk satu berkas gambar.
 *
 * `memoryStorage` dipakai supaya berkas tidak pernah menyentuh disk: hasilnya
 * langsung dinormalkan sharp, jadi tidak ada berkas sementara yang perlu
 * dibersihkan dan tidak ada nama berkas kiriman yang bisa dipakai menulis ke
 * luar folder tujuan.
 */
export function unggahSatuGambar(namaField = 'file') {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: BATAS_UKURAN_BERKAS,
      files: 1,
      fields: 20,
    },
    fileFilter: (_req, file, cb) => {
      const diizinkan = ['image/jpeg', 'image/png', 'image/webp'];
      if (!diizinkan.includes(file.mimetype)) {
        cb(
          new AppError(
            'FILE_TYPE_NOT_ALLOWED',
            'Berkas harus berupa gambar JPEG, PNG, atau WebP.',
            400,
          ),
        );
        return;
      }
      cb(null, true);
    },
  }).single(namaField);
}

/**
 * Mengubah data URL Base64 menjadi buffer, dengan batas ukuran yang sama
 * seperti unggahan berkas.
 *
 * Dipakai untuk memindahkan endpoint lama yang masih menerima Base64 di dalam
 * JSON. Isinya tidak langsung disimpan: tetap dilewatkan ke sharp lebih dulu,
 * supaya yang masuk database hanya WebP yang sudah dinormalkan.
 */
export function bufferDariBase64(nilai: string): Buffer {
  const cocok = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(nilai.trim());
  if (!cocok) {
    throw new AppError(
      'FILE_TYPE_NOT_ALLOWED',
      'Bukti harus berupa data URL gambar JPEG, PNG, atau WebP.',
      400,
    );
  }

  const isi = cocok[2]!.replace(/\s/g, '');

  /*
   * Panjang string Base64 diperiksa lebih dulu. Tanpa ini, berkas 50 MB harus
   * di-decode penuh ke memori sebelum ditolak, dan penyerang bisa memakai itu
   * untuk menghabiskan RAM.
   */
  const perkiraanByte = Math.floor((isi.length * 3) / 4);
  if (perkiraanByte > BATAS_UKURAN_BERKAS) {
    throw new AppError(
      'FILE_TOO_LARGE',
      `Ukuran berkas melebihi batas ${Math.round(BATAS_UKURAN_BERKAS / 1024 / 1024)} MB.`,
      413,
    );
  }

  const buffer = Buffer.from(isi, 'base64');
  if (buffer.length === 0) {
    throw new AppError('FILE_EMPTY', 'Berkas gambar kosong.', 400);
  }

  return buffer;
}

/**
 * Menormalkan gambar yang datang sebagai Base64.
 *
 * Membungkus buffer menjadi bentuk yang sama dengan berkas multer, lalu memakai
 * jalur `siapkanGambar` yang sudah ada. Tujuannya supaya Base64 dan unggahan
 * berkas menghasilkan normalisasi yang persis sama.
 */
export async function siapkanGambarDariBase64(
  nilai: string,
  preset: PresetGambar = 'media',
): Promise<GambarNormal> {
  const buffer = bufferDariBase64(nilai);

  const sepertiBerkas = {
    fieldname: 'file',
    originalname: 'base64.webp',
    encoding: 'base64',
    mimetype: 'application/octet-stream',
    buffer,
    size: buffer.length,
  } as Express.Multer.File;

  return siapkanGambar(sepertiBerkas, preset);
}
