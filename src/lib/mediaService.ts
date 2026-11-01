import crypto from 'node:crypto';
import { db } from '../db.js';
import { AppError } from './response.js';
import { bentukObjectKey, mediaStorage } from './mediaStorage.js';
import { siapkanGambar } from './imagePipeline.js';

/**
 * Kategori media menentukan siapa yang boleh melihat dan berapa lama disimpan.
 *
 * `publik` berarti boleh dilihat siapa pun tanpa sesi, karena isinya foto armada
 * yang memang dipajang di katalog. Sisanya memuat data pribadi, sehingga hanya
 * bisa dibuka lewat tautan bertanda tangan yang berumur pendek.
 */
export const KATEGORI_MEDIA = {
  FLEET_PHOTO: { publik: true, label: 'Foto armada' },
  PAYMENT_PROOF: { publik: false, label: 'Bukti transfer' },
  KTP: { publik: false, label: 'e-KTP' },
  SIM: { publik: false, label: 'SIM A' },
  STATEMENT_LETTER: { publik: false, label: 'Surat pernyataan' },
  DRIVER_LICENSE: { publik: false, label: 'Foto SIM supir' },
} as const;

export type KategoriMedia = keyof typeof KATEGORI_MEDIA;

export function kategoriValid(nilai: string): nilai is KategoriMedia {
  return Object.prototype.hasOwnProperty.call(KATEGORI_MEDIA, nilai);
}

export function mediaPublik(kategori: string): boolean {
  return kategoriValid(kategori) ? KATEGORI_MEDIA[kategori].publik : false;
}

/** Masa berlaku tautan bertanda tangan, dalam detik. */
const TTL_DETIK = Number(process.env.MEDIA_URL_TTL_SECONDS ?? 900);

function ambilKunciTandaTangan(): string {
  const kunci = process.env.MEDIA_SIGNING_SECRET;
  if (kunci && kunci.length >= 32) return kunci;

  if (process.env.NODE_ENV === 'production') {
    throw new AppError(
      'MEDIA_SECRET_MISSING',
      'MEDIA_SIGNING_SECRET wajib diisi minimal 32 karakter untuk menandatangani tautan media.',
      500,
    );
  }

  // Nilai tetap saat pengembangan supaya tautan tidak berubah tiap restart.
  return 'mobiljuragan-media-dev-signing-secret-32';
}

function tandaTangan(mediaId: string, kedaluwarsa: number): string {
  return crypto
    .createHmac('sha256', ambilKunciTandaTangan())
    .update(`${mediaId}.${kedaluwarsa}`)
    .digest('hex');
}

/**
 * Membentuk tautan untuk satu objek media.
 *
 * Untuk kategori publik, tautannya polos. Untuk kategori pribadi, tautannya
 * membawa masa berlaku dan tanda tangan HMAC, sehingga bisa dipasang langsung
 * pada atribut `src` gambar yang tidak bisa mengirim header Authorization.
 */
export function tautanMedia(mediaId: string, kategori: string): string {
  if (mediaPublik(kategori)) {
    return `/api/v1/media/${mediaId}`;
  }

  const kedaluwarsa = Math.floor(Date.now() / 1000) + TTL_DETIK;
  const sig = tandaTangan(mediaId, kedaluwarsa);
  return `/api/v1/media/${mediaId}?exp=${kedaluwarsa}&sig=${sig}`;
}

export interface PemeriksaanTautan {
  mediaId: string;
  exp?: number;
  sig?: string;
}

/**
 * Memeriksa apakah tautan pribadi sah dan belum kedaluwarsa.
 *
 * Mengembalikan `false` tanpa melempar galat, supaya pemanggil bisa memutuskan
 * sendiri apakah akan menjawab 403 atau mencoba jalur sesi biasa.
 */
export function tautanSah({ mediaId, exp, sig }: PemeriksaanTautan): boolean {
  if (!exp || !sig) return false;
  if (!Number.isFinite(exp)) return false;
  if (exp * 1000 < Date.now()) return false;

  const harapan = tandaTangan(mediaId, exp);

  // Perbandingan waktu tetap supaya panjang jawaban tidak membocorkan isi tanda tangan.
  const a = Buffer.from(harapan, 'utf8');
  const b = Buffer.from(sig, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface SimpanMediaParams {
  file: Express.Multer.File;
  kategori: KategoriMedia;
  ownerUserId?: string | null;
}

/**
 * Menyimpan satu berkas gambar: normalisasi sharp, simpan ke penyimpanan objek,
 * lalu catat di `media_objects`.
 *
 * Berkas dengan isi identik tidak disimpan dua kali karena `sha256` unik.
 */
export async function simpanMedia(params: SimpanMediaParams) {
  const gambar = await siapkanGambar(params.file);
  const objectKey = bentukObjectKey(gambar.sha256, gambar.ekstensi);

  const sudahAda = await db.mediaObject.findUnique({ where: { sha256: gambar.sha256 } });
  if (sudahAda) {
    /*
     * Objek sudah tercatat. Berkas fisiknya tetap dipastikan ada, karena isi
     * folder penyimpanan bisa terhapus terpisah dari database.
     */
    if (!(await mediaStorage.ada(sudahAda.objectKey))) {
      await mediaStorage.simpan(objectKey, gambar.buffer);
    }
    return sudahAda;
  }

  await mediaStorage.simpan(objectKey, gambar.buffer);

  return db.mediaObject.create({
    data: {
      sha256: gambar.sha256,
      objectKey,
      mimeType: gambar.mime,
      byteSize: gambar.byte,
      width: gambar.lebar,
      height: gambar.tinggi,
      sourceType: gambar.jenisAsal,
      sourceBytes: gambar.byteAsal,
      kategori: params.kategori,
      ownerUserId: params.ownerUserId ?? null,
    },
  });
}

export async function ambilMedia(mediaId: string) {
  const media = await db.mediaObject.findUnique({ where: { id: mediaId } });
  if (!media) {
    throw new AppError('MEDIA_NOT_FOUND', 'Media tidak ditemukan.', 404);
  }
  return media;
}
