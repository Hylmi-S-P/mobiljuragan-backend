import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { AppError } from '../../lib/response.js';
import type { FileStorage, StoredFile } from './file-storage.js';

/**
 * Penyimpanan lokal di disk server.
 *
 * Dipakai selama target akhir (S3 atau VPS) belum diputuskan. Folder berkas
 * sengaja berada di luar `src/` dan tidak disajikan sebagai static publik:
 * dokumen berisi KTP/SIM, jadi aksesnya lewat endpoint ber-otorisasi.
 */
export class LocalFileStorage implements FileStorage {
  private readonly rootDir: string;

  constructor(rootDir = process.env.UPLOAD_DIR ?? resolve(process.cwd(), 'uploads')) {
    this.rootDir = resolve(rootDir);
  }

  /** Mencegah path keluar dari folder penyimpanan (path traversal). */
  private safePath(key: string): string {
    const target = resolve(join(this.rootDir, key));
    if (!target.startsWith(this.rootDir)) {
      throw new AppError('INVALID_FILE_PATH', 'Nama berkas tidak valid.', 400);
    }
    return normalize(target);
  }

  async put(key: string, data: Buffer): Promise<StoredFile> {
    const target = this.safePath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);

    return { key, size: data.byteLength, mimeType: 'image/webp' };
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.safePath(key));
    } catch {
      throw new AppError('FILE_NOT_FOUND', 'Berkas tidak ditemukan.', 404);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.safePath(key));
    } catch {
      // Berkas sudah tidak ada: tidak perlu dianggap gagal.
    }
  }

  urlFor(key: string): string {
    /* Slash sengaja dibiarkan: rute pengambilan berkas memakai pola
       /documents/file/:folder/:name. Meng-encode "/" menjadi %2F membuat
       Express tidak mencocokkan rutenya. */
    return `/api/v1/documents/file/${key}`;
  }
}

/** Adapter aktif. Titik tunggal untuk mengganti ke S3 nanti. */
export const fileStorage: FileStorage = new LocalFileStorage();
