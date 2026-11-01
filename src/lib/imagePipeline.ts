import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { AppError } from './response.js';

/**
 * Pipeline unggah gambar: multer menampung berkas di memori, lalu sharp
 * menormalkannya sebelum disimpan.
 *
 * Alasannya bukan sekadar mengecilkan berkas. Foto dari kamera HP membawa
 * metadata EXIF berisi lokasi dan model perangkat, orientasinya bisa terbalik,
 * dan ukurannya bisa 5 MB lebih. Tanpa normalisasi, yang tersimpan adalah apa
 * pun yang dikirim pelanggan, termasuk berkas yang bukan gambar sama sekali.
 */

/** Batas berkas masuk. Foto HP terbesar yang wajar masih di bawah angka ini. */
export const BATAS_UKURAN_BERKAS = 8 * 1024 * 1024;

/**
 * Batas piksel saat decode. Berkas 200 KB bisa berisi 50000x50000 piksel dan
 * menghabiskan seluruh RAM saat diproses. Ini yang disebut decompression bomb.
 */
export const BATAS_PIKSEL = 40_000_000;

/** Sisi terpanjang setelah diperkecil. Cukup tajam untuk layar dan cetak struk. */
export const SISI_MAKSIMAL = 1600;

export const KUALITAS_WEBP = 82;

/**
 * Jenis berkas yang diterima, dikenali dari magic bytes dan bukan dari nama
 * berkas atau Content-Type. Keduanya mudah dipalsukan.
 */
const TANDA_BERKAS: Array<{ jenis: 'jpeg' | 'png' | 'webp'; cocok: (buf: Buffer) => boolean }> = [
  {
    jenis: 'jpeg',
    // FF D8 FF
    cocok: (buf) => buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    jenis: 'png',
    // 89 50 4E 47 0D 0A 1A 0A
    cocok: (buf) =>
      buf.length > 7 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    jenis: 'webp',
    // "RIFF" .... "WEBP"
    cocok: (buf) =>
      buf.length > 11 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP',
  },
];

export interface GambarSiapSimpan {
  /** Isi berkas hasil normalisasi, selalu WebP. */
  buffer: Buffer;
  mime: 'image/webp';
  ekstensi: 'webp';
  lebar: number;
  tinggi: number;
  byte: number;
  /** SHA-256 isi hasil normalisasi, dipakai sebagai nama objek dan pendeteksi duplikat. */
  sha256: string;
  /** Jenis berkas asli yang dikirim pelanggan, hanya untuk catatan. */
  jenisAsal: 'jpeg' | 'png' | 'webp';
  /** Ukuran berkas asli sebelum diproses. */
  byteAsal: number;
}

function kenaliJenis(buffer: Buffer): 'jpeg' | 'png' | 'webp' {
  const cocok = TANDA_BERKAS.find((tanda) => tanda.cocok(buffer));
  if (!cocok) {
    throw new AppError(
      'FILE_TYPE_NOT_ALLOWED',
      'Berkas harus berupa gambar JPEG, PNG, atau WebP.',
      400,
    );
  }
  return cocok.jenis;
}

/**
 * Menormalkan satu berkas gambar.
 *
 * `rotate()` tanpa argumen membaca orientasi EXIF lalu memutarnya, sehingga foto
 * potret dari HP tidak tersimpan miring. Metadata lain dibuang oleh WebP.
 */
export async function siapkanGambar(file: Express.Multer.File): Promise<GambarSiapSimpan> {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new AppError('FILE_EMPTY', 'Berkas gambar kosong.', 400);
  }

  if (file.buffer.length > BATAS_UKURAN_BERKAS) {
    throw new AppError(
      'FILE_TOO_LARGE',
      `Ukuran berkas melebihi batas ${Math.round(BATAS_UKURAN_BERKAS / 1024 / 1024)} MB.`,
      413,
    );
  }

  const jenisAsal = kenaliJenis(file.buffer);

  let hasil: Buffer;
  let info: { width: number; height: number };

  try {
    const pipeline = sharp(file.buffer, {
      limitInputPixels: BATAS_PIKSEL,
      // Gambar rusak sebagian tetap ditolak, bukan diperbaiki diam-diam.
      failOn: 'error',
    });

    const { data, info: infoKeluaran } = await pipeline
      .rotate()
      .resize({
        width: SISI_MAKSIMAL,
        height: SISI_MAKSIMAL,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: KUALITAS_WEBP })
      .toBuffer({ resolveWithObject: true });

    hasil = data;
    info = infoKeluaran;
  } catch (error) {
    const pesan = error instanceof Error ? error.message : String(error);

    if (pesan.includes('pixel limit')) {
      throw new AppError(
        'FILE_TOO_MANY_PIXELS',
        `Gambar melebihi batas ${BATAS_PIKSEL.toLocaleString('id-ID')} piksel.`,
        400,
      );
    }

    throw new AppError('FILE_UNREADABLE', `Gambar tidak dapat dibaca: ${pesan}`, 400);
  }

  return {
    buffer: hasil,
    mime: 'image/webp',
    ekstensi: 'webp',
    lebar: info.width,
    tinggi: info.height,
    byte: hasil.length,
    sha256: crypto.createHash('sha256').update(hasil).digest('hex'),
    jenisAsal,
    byteAsal: file.buffer.length,
  };
}

/**
 * Middleware multer untuk satu berkas gambar.
 *
 * `memoryStorage` dipakai supaya berkas tidak pernah menyentuh disk: hasilnya
 * langsung dinormalisasi sharp, jadi tidak ada berkas sementara yang perlu
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
