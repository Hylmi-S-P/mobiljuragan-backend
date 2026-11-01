import { db } from '../db.js';
import { AppError } from './response.js';
import {
  ISI_BAWAAN_FORM_KESANGGUPAN,
  KODE_FORM_KESANGGUPAN,
  type IsiTemplateDokumen,
} from './documentTemplateDefault.js';
import { buatPdfFormKesanggupan } from './documentTemplatePdf.js';

/**
 * Pengelolaan template dokumen resmi.
 *
 * Aturan pentingnya: template tidak pernah diubah di tempat. Setiap penyuntingan
 * menghasilkan baris baru dengan nomor versi bertambah, dan versi lama
 * dinonaktifkan. Pelanggan selalu mendapat versi aktif, sedangkan dokumen yang
 * sudah ditandatangani tetap bisa ditelusuri memakai versi mana.
 */

/** Penjaga agar penyemaian bawaan tidak berjalan bersamaan. */
let penyemaianBerjalan: Promise<void> | null = null;

/** Memastikan isi template punya bentuk yang bisa dicetak. */
function periksaIsi(isi: unknown): IsiTemplateDokumen {
  if (!isi || typeof isi !== 'object') {
    throw new AppError('TEMPLATE_ISI_INVALID', 'Isi template wajib berupa objek.', 400);
  }

  const kandidat = isi as Partial<IsiTemplateDokumen>;

  if (!kandidat.kop || typeof kandidat.kop.nama !== 'string' || !kandidat.kop.nama.trim()) {
    throw new AppError('TEMPLATE_ISI_INVALID', 'Kop dokumen wajib memuat nama perusahaan.', 400);
  }

  if (typeof kandidat.judul !== 'string' || !kandidat.judul.trim()) {
    throw new AppError('TEMPLATE_ISI_INVALID', 'Judul dokumen wajib diisi.', 400);
  }

  if (!Array.isArray(kandidat.butir) || kandidat.butir.length === 0) {
    throw new AppError('TEMPLATE_ISI_INVALID', 'Dokumen wajib memuat minimal satu butir.', 400);
  }

  for (const [i, butir] of kandidat.butir.entries()) {
    if (!butir || typeof butir.teks !== 'string' || !butir.teks.trim()) {
      throw new AppError('TEMPLATE_ISI_INVALID', `Butir nomor ${i + 1} tidak boleh kosong.`, 400);
    }
  }

  if (!kandidat.tabelPembayaran || !Array.isArray(kandidat.tabelPembayaran.kolom)) {
    throw new AppError('TEMPLATE_ISI_INVALID', 'Tabel pembayaran wajib memuat daftar kolom.', 400);
  }

  return kandidat as IsiTemplateDokumen;
}

export const documentTemplateService = {
  /**
   * Menyiapkan template bawaan bila belum ada di database.
   *
   * Aman dipanggil berkali-kali. Dipakai saat server mulai, dan juga dipanggil
   * otomatis oleh `ambilAktif` kalau tabelnya masih kosong. Cara kedua penting
   * supaya instalasi baru tetap bisa melayani unduhan walaupun penyemaian saat
   * start terlewat, misalnya karena database baru siap setelah server menyala.
   */
  async pastikanTemplateBawaan(): Promise<void> {
    if (penyemaianBerjalan) return penyemaianBerjalan;

    penyemaianBerjalan = (async () => {
      const jumlah = await db.documentTemplate.count({ where: { kode: KODE_FORM_KESANGGUPAN } });
      if (jumlah > 0) return;

      await db.documentTemplate.create({
        data: {
          kode: KODE_FORM_KESANGGUPAN,
          judul: 'Form Kesanggupan Penyewa',
          versi: 1,
          isi: ISI_BAWAAN_FORM_KESANGGUPAN as unknown as object,
          isActive: true,
          catatan: 'Versi awal, disalin dari surat pernyataan resmi perusahaan.',
          dibuatOleh: 'sistem',
        },
      });
    })().finally(() => {
      penyemaianBerjalan = null;
    });

    return penyemaianBerjalan;
  },

  /** Template aktif yang dipakai pelanggan. */
  async ambilAktif(kode: string = KODE_FORM_KESANGGUPAN) {
    let template = await db.documentTemplate.findFirst({
      where: { kode, isActive: true },
      orderBy: { versi: 'desc' },
    });

    /*
     * Tabel kosong pada instalasi baru bukan alasan untuk menolak melayani.
     * Template bawaan disemai lebih dulu, lalu pembacaan diulang sekali.
     */
    if (!template) {
      await this.pastikanTemplateBawaan();
      template = await db.documentTemplate.findFirst({
        where: { kode, isActive: true },
        orderBy: { versi: 'desc' },
      });
    }

    if (!template) {
      throw new AppError(
        'TEMPLATE_NOT_FOUND',
        `Template dokumen '${kode}' belum tersedia. Hubungi admin.`,
        404,
      );
    }

    return template;
  },

  /** Seluruh versi dari satu kode, terbaru lebih dulu. */
  async daftarVersi(kode: string = KODE_FORM_KESANGGUPAN) {
    return db.documentTemplate.findMany({
      where: { kode },
      orderBy: { versi: 'desc' },
      select: {
        id: true,
        kode: true,
        judul: true,
        versi: true,
        isActive: true,
        catatan: true,
        dibuatOleh: true,
        diperbaruiOleh: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async ambilSatu(id: string) {
    const template = await db.documentTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new AppError('TEMPLATE_NOT_FOUND', 'Template dokumen tidak ditemukan.', 404);
    }
    return template;
  },

  /**
   * Menyimpan perubahan sebagai versi baru.
   *
   * Versi lama tidak dihapus dan tidak diubah isinya, hanya dinonaktifkan.
   * Kalau admin menyimpan tanpa mengubah apa pun, versi baru tetap dibuat agar
   * jejak siapa mengubah kapan tetap tercatat.
   */
  async simpanVersiBaru(params: {
    kode?: string;
    judul?: string;
    isi: unknown;
    catatan?: string;
    oleh: string;
  }) {
    const kode = params.kode ?? KODE_FORM_KESANGGUPAN;
    const isi = periksaIsi(params.isi);

    const terakhir = await db.documentTemplate.findFirst({
      where: { kode },
      orderBy: { versi: 'desc' },
      select: { versi: true },
    });

    const versiBaru = (terakhir?.versi ?? 0) + 1;

    return db.$transaction(async (tx) => {
      // Hanya satu versi aktif per kode.
      await tx.documentTemplate.updateMany({
        where: { kode, isActive: true },
        data: { isActive: false },
      });

      return tx.documentTemplate.create({
        data: {
          kode,
          judul: params.judul?.trim() || isi.judul,
          versi: versiBaru,
          isi: isi as unknown as object,
          isActive: true,
          catatan: params.catatan ?? null,
          dibuatOleh: params.oleh,
          diperbaruiOleh: params.oleh,
        },
      });
    });
  },

  /**
   * Mengaktifkan kembali versi lama.
   *
   * Berguna kalau versi terbaru ternyata salah. Versi lain dinonaktifkan, dan
   * tidak ada baris baru yang dibuat karena isinya memang sudah ada.
   */
  async aktifkanVersi(id: string, oleh: string) {
    const target = await this.ambilSatu(id);

    return db.$transaction(async (tx) => {
      await tx.documentTemplate.updateMany({
        where: { kode: target.kode, isActive: true },
        data: { isActive: false },
      });

      return tx.documentTemplate.update({
        where: { id },
        data: { isActive: true, diperbaruiOleh: oleh },
      });
    });
  },

  /**
   * Membentuk PDF dari template aktif.
   *
   * `terisi` dipakai saat data pemesan sudah diketahui, misalnya dari halaman
   * status pesanan. Tanpa itu, formulir tercetak kosong untuk diisi tangan.
   */
  async buatPdf(params: {
    kode?: string;
    terisi?: {
      nama?: string | null;
      nomorHp?: string | null;
      alamat?: string | null;
      namaMobil?: string | null;
      kodeBooking?: string | null;
    };
  }): Promise<{ buffer: Buffer; judul: string; versi: number }> {
    const template = await this.ambilAktif(params.kode);
    const isi = template.isi as unknown as IsiTemplateDokumen;

    const buffer = await buatPdfFormKesanggupan(isi, { terisi: params.terisi });

    return { buffer, judul: template.judul, versi: template.versi };
  },

  /** PDF dari versi tertentu, dipakai saat menelusuri dokumen lama. */
  async buatPdfVersi(
    id: string,
    terisi?: { nama?: string | null; kodeBooking?: string | null },
  ): Promise<{ buffer: Buffer; judul: string; versi: number }> {
    const template = await this.ambilSatu(id);
    const isi = template.isi as unknown as IsiTemplateDokumen;
    const buffer = await buatPdfFormKesanggupan(isi, { terisi });
    return { buffer, judul: template.judul, versi: template.versi };
  },
};
