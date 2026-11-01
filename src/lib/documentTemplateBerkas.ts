import crypto from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import multer from 'multer';

import { AppError } from './response.js';
import { mediaStorage } from './mediaStorage.js';

/**
 * Berkas template dokumen.
 *
 * Berbeda dengan foto, dokumen tidak boleh diproses ulang. Yang diunggah admin
 * adalah dokumen resmi perusahaan yang akan dicetak dan ditandatangani
 * pelanggan; mengubahnya berarti mengubah dokumen hukum. Karena itu berkas
 * disimpan apa adanya, hanya jenis dan ukurannya yang diperiksa.
 */

/** Batas ukuran berkas. Dokumen Word bergambar masih jauh di bawah angka ini. */
export const BATAS_UKURAN_DOKUMEN = 15 * 1024 * 1024;

export type JenisDokumen = 'pdf' | 'docx' | 'doc';

export interface JenisDokumenTerdeteksi {
  jenis: JenisDokumen;
  ekstensi: string;
  mime: string;
}

/**
 * Mengenali jenis dokumen dari isi berkas, bukan dari nama atau Content-Type.
 *
 * Nama berkas mudah dipalsukan: berkas teks bisa dinamai `.pdf` dan tetap
 * diterima kalau hanya nama yang diperiksa. Tiga tanda di bawah cukup untuk
 * membedakan format yang benar-benar dipakai perusahaan.
 */
export function kenaliDokumen(isi: Buffer): JenisDokumenTerdeteksi {
  if (isi.length < 8) {
    throw new AppError('DOCUMENT_EMPTY', 'Berkas dokumen kosong atau rusak.', 400);
  }

  // PDF: "%PDF-" di awal berkas.
  if (isi.toString('ascii', 0, 5) === '%PDF-') {
    return { jenis: 'pdf', ekstensi: 'pdf', mime: 'application/pdf' };
  }

  /*
   * DOCX adalah arsip ZIP. Empat byte pertama "PK\x03\x04". Untuk memastikan
   * ini benar-benar dokumen Word dan bukan ZIP sembarang, dicari penanda
   * "word/" di dalam daftar isi arsip. Penanda itu selalu ada pada DOCX.
   */
  if (isi[0] === 0x50 && isi[1] === 0x4b && isi[2] === 0x03 && isi[3] === 0x04) {
    const potongan = isi.toString('latin1');
    if (potongan.includes('word/')) {
      return {
        jenis: 'docx',
        ekstensi: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }
    throw new AppError(
      'DOCUMENT_TYPE_NOT_ALLOWED',
      'Berkas ZIP ini bukan dokumen Word. Simpan ulang sebagai .docx lalu unggah lagi.',
      400,
    );
  }

  // DOC lama: berkas OLE2, ditandai D0 CF 11 E0 A1 B1 1A E1.
  const tandaOle = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (tandaOle.every((b, i) => isi[i] === b)) {
    return { jenis: 'doc', ekstensi: 'doc', mime: 'application/msword' };
  }

  throw new AppError(
    'DOCUMENT_TYPE_NOT_ALLOWED',
    'Dokumen harus berformat PDF, DOCX, atau DOC.',
    400,
  );
}

/** Membersihkan nama berkas kiriman supaya aman dipakai di header unduhan. */
export function rapikanNamaBerkas(nama: string, ekstensi: string): string {
  const tanpaJalur = nama.split(/[\\/]/).pop() ?? '';
  const dasar = tanpaJalur
    // Hanya huruf, angka, spasi, titik, garis bawah, dan tanda hubung.
    .replace(/[^A-Za-z0-9 ._-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  if (!dasar) return `dokumen.${ekstensi}`;

  // Pastikan akhiran sesuai jenis yang benar-benar terdeteksi, bukan nama kiriman.
  const tanpaAkhiran = dasar.replace(/\.(pdf|docx?|PDF|DOCX?)$/, '');
  return `${tanpaAkhiran || 'dokumen'}.${ekstensi}`;
}

/** Membentuk jalur objek dokumen, terpisah dari folder foto. */
export function bentukObjectKeyDokumen(sha256: string, ekstensi: string): string {
  const sekarang = new Date();
  const tahun = sekarang.getUTCFullYear();
  const bulan = String(sekarang.getUTCMonth() + 1).padStart(2, '0');
  return `dokumen/${tahun}/${bulan}/${sha256}.${ekstensi}`;
}

export interface DokumenSiapSimpan {
  objectKey: string;
  nama: string;
  mime: string;
  byte: number;
  sha256: string;
  jenis: JenisDokumen;
}

/**
 * Memeriksa lalu menyimpan satu berkas dokumen.
 *
 * Isi berkas tidak diubah sama sekali. Kalau berkas dengan isi identik sudah
 * ada, berkas lama dipakai ulang, jadi mengunggah dokumen yang sama dua kali
 * tidak memakan ruang tambahan.
 */
export async function simpanDokumen(buffer: Buffer, namaAsli: string): Promise<DokumenSiapSimpan> {
  if (!buffer || buffer.length === 0) {
    throw new AppError('DOCUMENT_EMPTY', 'Berkas dokumen kosong.', 400);
  }

  if (buffer.length > BATAS_UKURAN_DOKUMEN) {
    throw new AppError(
      'DOCUMENT_TOO_LARGE',
      `Ukuran dokumen melebihi batas ${Math.round(BATAS_UKURAN_DOKUMEN / 1024 / 1024)} MB.`,
      413,
    );
  }

  const jenis = kenaliDokumen(buffer);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const objectKey = bentukObjectKeyDokumen(sha256, jenis.ekstensi);

  if (!(await mediaStorage.ada(objectKey))) {
    await mediaStorage.simpan(objectKey, buffer);
  }

  return {
    objectKey,
    nama: rapikanNamaBerkas(namaAsli, jenis.ekstensi),
    mime: jenis.mime,
    byte: buffer.length,
    sha256,
    jenis: jenis.jenis,
  };
}

/**
 * Middleware unggah satu dokumen.
 *
 * `memoryStorage` dipakai supaya berkas tidak pernah menyentuh disk sebelum
 * diperiksa. Dengan begitu berkas yang bukan PDF/Word tidak pernah sempat
 * ditulis ke folder penyimpanan.
 */
export function unggahSatuDokumen(namaField = 'berkas') {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: BATAS_UKURAN_DOKUMEN,
      files: 1,
      fields: 10,
    },
    fileFilter: (_req, file, cb) => {
      const diizinkan = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // Sebagian peramban mengirim tipe generik untuk .docx.
        'application/octet-stream',
        'application/zip',
      ];

      if (!diizinkan.includes(file.mimetype)) {
        cb(
          new AppError(
            'DOCUMENT_TYPE_NOT_ALLOWED',
            'Dokumen harus berformat PDF, DOCX, atau DOC.',
            400,
          ),
        );
        return;
      }
      cb(null, true);
    },
  }).single(namaField);
}

/** Membaca kembali dokumen tersimpan. */
export async function bacaDokumen(objectKey: string): Promise<Buffer> {
  return mediaStorage.baca(objectKey);
}

/** Folder sementara untuk keperluan pengujian dan pemeliharaan. */
export async function pastikanFolder(alamat: string): Promise<void> {
  await mkdir(alamat, { recursive: true });
}

/** Lokasi berkas bawaan yang dipakai saat belum ada dokumen dari admin. */
export const BERKAS_BAWAAN = join(process.cwd(), 'assets', 'form-kesanggupan-bawaan.pdf');
