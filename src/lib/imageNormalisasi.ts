import crypto from 'node:crypto';
import sharp from 'sharp';
import { AppError } from './response.js';

/**
 * Normalisasi gambar unggahan: satu tempat untuk semua jalur.
 *
 * Sebelumnya ada dua pipeline yang tumbuh sendiri-sendiri: `imagePipeline`
 * untuk foto media (punya batas piksel) dan `image-processing` untuk dokumen
 * sewa (tidak punya). Akibatnya jalur dokumen bisa dijadikan sasaran
 * decompression bomb. Sekarang keduanya memanggil fungsi ini dengan preset yang
 * berbeda; yang berbeda hanya angka batasnya, bukan cara memeriksanya.
 */

export type PresetGambar = 'dokumen' | 'media';

export interface AturanGambar {
  /** Batas ukuran berkas masuk, sebelum diproses. */
  batasByte: number;
  /**
   * Batas piksel saat decode. Berkas 200 KB bisa berisi 50000x50000 piksel dan
   * menghabiskan seluruh RAM saat diproses. Inilah decompression bomb.
   */
  batasPiksel: number;
  /** Sisi terpanjang setelah diperkecil. */
  sisiMaksimal: number;
  /** Kualitas WebP. Dokumen dipindai staf, jadi lebih rendah sedikit. */
  kualitas: number;
  /** Label batas ukuran untuk pesan galat. */
  labelBatas: string;
}

export const PRESET_GAMBAR: Record<PresetGambar, AturanGambar> = {
  dokumen: {
    batasByte: 5 * 1024 * 1024,
    batasPiksel: 40_000_000,
    sisiMaksimal: 2000,
    kualitas: 80,
    labelBatas: '5 MB',
  },
  media: {
    batasByte: 8 * 1024 * 1024,
    batasPiksel: 40_000_000,
    sisiMaksimal: 1600,
    kualitas: 82,
    labelBatas: '8 MB',
  },
};

/** Batas piksel yang berlaku untuk semua preset; dipakai pesan galat & uji. */
export const BATAS_PIKSEL = 40_000_000;

/**
 * Jenis berkas yang diterima, dikenali dari magic bytes dan bukan dari nama
 * berkas atau Content-Type. Keduanya mudah dipalsukan klien.
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

export interface GambarNormal {
  /** Isi berkas hasil normalisasi, selalu WebP. */
  buffer: Buffer;
  mime: 'image/webp';
  ekstensi: 'webp';
  lebar: number;
  tinggi: number;
  byte: number;
  /** SHA-256 isi hasil normalisasi, dipakai sebagai nama objek dan pendeteksi duplikat. */
  sha256: string;
  /** Jenis berkas asli yang dikirim, hanya untuk catatan. */
  jenisAsal: 'jpeg' | 'png' | 'webp';
  /** Ukuran berkas asli sebelum diproses. */
  byteAsal: number;
}

export function kenaliJenisGambar(buffer: Buffer): 'jpeg' | 'png' | 'webp' {
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
 * Menormalkan satu gambar: periksa isi, batasi ukuran & piksel, luruskan
 * orientasi, buang metadata, lalu jadikan WebP.
 *
 * `rotate()` tanpa argumen membaca orientasi EXIF lalu memutarnya, sehingga foto
 * potret dari HP tidak tersimpan miring. Metadata lain (termasuk GPS) hilang
 * karena hasil akhirnya WebP baru, bukan salinan berkas asli.
 */
export async function normalisasiGambar(
  buffer: Buffer,
  preset: PresetGambar,
): Promise<GambarNormal> {
  const aturan = PRESET_GAMBAR[preset];

  if (!buffer || buffer.length === 0) {
    throw new AppError('FILE_EMPTY', 'Berkas gambar kosong.', 400);
  }

  if (buffer.length > aturan.batasByte) {
    throw new AppError(
      'FILE_TOO_LARGE',
      `Ukuran berkas melebihi batas ${aturan.labelBatas}.`,
      413,
    );
  }

  const jenisAsal = kenaliJenisGambar(buffer);

  let hasil: Buffer;
  let info: { width: number; height: number };

  try {
    const pipeline = sharp(buffer, {
      limitInputPixels: aturan.batasPiksel,
      // Gambar rusak sebagian tetap ditolak, bukan diperbaiki diam-diam.
      failOn: 'error',
    });

    const keluaran = await pipeline
      .rotate()
      .resize({
        width: aturan.sisiMaksimal,
        height: aturan.sisiMaksimal,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: aturan.kualitas })
      .toBuffer({ resolveWithObject: true });

    hasil = keluaran.data;
    info = keluaran.info;
  } catch (error) {
    const pesan = error instanceof Error ? error.message : String(error);

    if (pesan.includes('pixel limit')) {
      throw new AppError(
        'FILE_TOO_MANY_PIXELS',
        `Gambar melebihi batas ${aturan.batasPiksel.toLocaleString('id-ID')} piksel. Perkecil dulu sebelum mengunggah.`,
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
    byteAsal: buffer.length,
  };
}
