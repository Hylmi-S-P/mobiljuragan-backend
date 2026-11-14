import { mediaStorage } from '../../lib/mediaStorage.js';
import type { FileStorage, StoredFile } from './file-storage.js';

/**
 * Penyimpanan berkas di disk server.
 *
 * Sebelumnya ada dua pipeline paralel: `mediaStorage` untuk media katalog dan
 * `LocalFileStorage` untuk dokumen sewa, masing-masing dengan folder akar dan
 * pemeriksaan jalur sendiri. Sekarang keduanya memakai satu penampung: dokumen
 * disimpan di subfolder `dokumen/` di dalam akar penyimpanan yang sama, sehingga
 * pemindahan ke S3 nanti hanya perlu mengganti satu adapter.
 *
 * Folder tetap berada di luar `src/` dan tidak disajikan sebagai static publik:
 * dokumen berisi KTP/SIM, jadi aksesnya lewat endpoint ber-otorisasi.
 */
const PREFIX_DOKUMEN = 'dokumen';

export class LocalFileStorage implements FileStorage {
  async put(key: string, data: Buffer, mimeType = 'image/webp'): Promise<StoredFile> {
    const tersimpan = await mediaStorage.simpan(`${PREFIX_DOKUMEN}/${key}`, data);

    return { key, size: tersimpan.byte, mimeType };
  }

  async get(key: string): Promise<Buffer> {
    return mediaStorage.baca(`${PREFIX_DOKUMEN}/${key}`);
  }

  async delete(key: string): Promise<void> {
    await mediaStorage.hapus(`${PREFIX_DOKUMEN}/${key}`);
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
