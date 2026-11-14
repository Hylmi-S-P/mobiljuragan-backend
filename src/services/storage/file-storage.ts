/**
 * Abstraksi penyimpanan berkas.
 *
 * Tujuan: pemilihan tempat penyimpanan (disk lokal sekarang, S3/VPS nanti)
 * tidak boleh merembes ke controller. Semua kode hanya berbicara lewat
 * antarmuka ini, sehingga memindahkan berkas cukup mengganti adapter.
 */
import type { Readable } from 'node:stream';

export type StoredFile = {
  /** Nama unik di penyimpanan (tanpa folder publik). */
  key: string;
  /** Ukuran akhir berkas dalam byte. */
  size: number;
  /** MIME akhir setelah diproses (selalu image/webp untuk gambar). */
  mimeType: string;
};

export interface FileStorage {
  put(key: string, data: Buffer, mimeType: string): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  /**
   * Aliran baca, dipakai saat menyajikan berkas ke klien.
   *
   * Tanpa ini, setiap permintaan foto KTP/SIM menyalin seluruh isi berkas ke
   * RAM lebih dulu. Dengan aliran, memori yang terpakai tetap kecil meskipun
   * berkas besar dan banyak permintaan datang bersamaan.
   */
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  /** URL relatif yang bisa dipakai klien untuk mengambil berkas. */
  urlFor(key: string): string;
}
