import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { AppError } from './response.js';

/**
 * Penyimpanan berkas media.
 *
 * Driver `lokal` menyimpan berkas di disk mesin yang menjalankan backend.
 * Cukup untuk staging di satu laptop server dan tidak menambah layanan yang
 * harus dirawat. Ketika MinIO dipasang, yang berubah hanya isi berkas ini;
 * pemanggil tetap memakai `simpanBerkas`, `bacaBerkas`, dan `hapusBerkas`.
 */

const DRIVER = (process.env.MEDIA_DRIVER ?? 'lokal').toLowerCase();

/**
 * Folder akar penyimpanan. Default berada di dalam repo backend, dan sengaja
 * di luar folder yang disajikan statis supaya berkas tidak bisa diakses
 * langsung tanpa melewati pemeriksaan hak akses.
 */
const AKAR = resolve(process.env.MEDIA_DIR ?? join(process.cwd(), 'storage', 'media'));

/** Hanya menerima jalur relatif yang aman, tanpa `..` dan tanpa akar absolut. */
function pastikanJalurAman(objectKey: string): string {
  if (
    objectKey.length === 0 ||
    objectKey.startsWith('/') ||
    objectKey.startsWith('\\') ||
    /^[A-Za-z]:/.test(objectKey) ||
    objectKey.split(/[\\/]/).includes('..')
  ) {
    throw new AppError('MEDIA_KEY_INVALID', 'Jalur objek media tidak valid.', 400);
  }

  const penuh = resolve(AKAR, objectKey);
  const akarDenganPemisah = AKAR.endsWith('\\') || AKAR.endsWith('/') ? AKAR : AKAR + '\\';

  if (!penuh.startsWith(akarDenganPemisah)) {
    throw new AppError(
      'MEDIA_KEY_INVALID',
      'Jalur objek media keluar dari folder penyimpanan.',
      400,
    );
  }

  return penuh;
}

/**
 * Membentuk jalur objek berdasarkan tanggal dan hash isi berkas.
 *
 * Hash dipakai sebagai nama berkas, sehingga dua unggahan dengan isi sama
 * menunjuk berkas yang sama dan nama berkas kiriman pelanggan tidak pernah
 * dipakai di sistem berkas.
 */
export function bentukObjectKey(sha256: string, ekstensi: string): string {
  const sekarang = new Date();
  const tahun = sekarang.getUTCFullYear();
  const bulan = String(sekarang.getUTCMonth() + 1).padStart(2, '0');
  return `media/${tahun}/${bulan}/${sha256}.${ekstensi}`;
}

export interface BerkasTersimpan {
  objectKey: string;
  byte: number;
}

async function simpanLokal(objectKey: string, isi: Buffer): Promise<BerkasTersimpan> {
  const penuh = pastikanJalurAman(objectKey);
  await mkdir(dirname(penuh), { recursive: true });

  try {
    const sudah = await stat(penuh);
    if (sudah.size === isi.length) {
      // Berkas dengan hash sama sudah ada. Tidak perlu ditulis ulang.
      return { objectKey, byte: sudah.size };
    }
  } catch {
    // Belum ada, lanjut menulis.
  }

  await writeFile(penuh, isi, { mode: 0o640 });
  return { objectKey, byte: isi.length };
}

async function bacaLokal(objectKey: string): Promise<Buffer> {
  const penuh = pastikanJalurAman(objectKey);
  try {
    return await readFile(penuh);
  } catch {
    throw new AppError('MEDIA_NOT_FOUND', 'Berkas media tidak ditemukan di penyimpanan.', 404);
  }
}

async function hapusLokal(objectKey: string): Promise<boolean> {
  const penuh = pastikanJalurAman(objectKey);
  try {
    await unlink(penuh);
    return true;
  } catch {
    return false;
  }
}

async function adaLokal(objectKey: string): Promise<boolean> {
  try {
    const penuh = pastikanJalurAman(objectKey);
    await stat(penuh);
    return true;
  } catch {
    return false;
  }
}

function belumDidukung(): never {
  throw new AppError(
    'MEDIA_DRIVER_UNSUPPORTED',
    `MEDIA_DRIVER '${DRIVER}' belum didukung. Driver yang tersedia: lokal.`,
    500,
  );
}

export const mediaStorage = {
  driver: DRIVER,
  akar: AKAR,

  simpan(objectKey: string, isi: Buffer): Promise<BerkasTersimpan> {
    if (DRIVER === 'lokal') return simpanLokal(objectKey, isi);
    return belumDidukung();
  },

  baca(objectKey: string): Promise<Buffer> {
    if (DRIVER === 'lokal') return bacaLokal(objectKey);
    return belumDidukung();
  },

  hapus(objectKey: string): Promise<boolean> {
    if (DRIVER === 'lokal') return hapusLokal(objectKey);
    return belumDidukung();
  },

  ada(objectKey: string): Promise<boolean> {
    if (DRIVER === 'lokal') return adaLokal(objectKey);
    return belumDidukung();
  },

  /** Aliran baca untuk menyajikan berkas tanpa menyalin seluruhnya ke memori. */
  aliran(objectKey: string) {
    if (DRIVER === 'lokal') return createReadStream(pastikanJalurAman(objectKey));
    return belumDidukung();
  },
};
