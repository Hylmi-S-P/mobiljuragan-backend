import { readFile } from 'node:fs/promises';

import { db } from '../db.js';
import { AppError } from './response.js';
import {
  BERKAS_BAWAAN,
  bacaDokumen,
  simpanDokumen,
  type DokumenSiapSimpan,
} from './documentTemplateBerkas.js';

/** Kode template Form Kesanggupan. Satu-satunya dokumen yang dipakai saat ini. */
export const KODE_FORM_KESANGGUPAN = 'FORM_KESANGGUPAN';

/**
 * Template dokumen resmi.
 *
 * Admin mengunggah berkas PDF atau Word yang sudah jadi. Aplikasi tidak
 * menyusun ulang isinya, karena yang dicetak dan ditandatangani pelanggan harus
 * persis berkas resmi perusahaan.
 *
 * Setiap unggahan menjadi versi baru dan langsung aktif. Versi lama tetap
 * tersimpan tanpa berkasnya dihapus, sehingga dokumen yang sudah ditandatangani
 * pelanggan tetap bisa ditelusuri memakai versi mana.
 */

let penyemaianBerjalan: Promise<void> | null = null;

/**
 * Menyiapkan versi pertama dari berkas bawaan bila belum ada sama sekali.
 *
 * Berkas bawaan disertakan bersama aplikasi supaya formulir sudah bisa diunduh
 * pelanggan sejak hari pertama, sebelum admin sempat mengunggah dokumennya
 * sendiri. Begitu admin mengunggah, versi ini kalah dan tidak dipakai lagi.
 */
async function semaiBilaKosong(): Promise<void> {
  const jumlah = await db.documentTemplate.count({ where: { kode: KODE_FORM_KESANGGUPAN } });
  if (jumlah > 0) return;

  let isiBerkas: Buffer;
  try {
    isiBerkas = await readFile(BERKAS_BAWAAN);
  } catch {
    /*
     * Berkas bawaan tidak ada. Ini bukan kegagalan yang perlu menghentikan
     * aplikasi: admin tetap bisa mengunggah dokumen, dan sampai itu terjadi
     * pelanggan menerima pesan bahwa dokumen belum tersedia.
     */
    return;
  }

  const tersimpan = await simpanDokumen(isiBerkas, 'Form Kesanggupan.pdf');

  await db.documentTemplate.create({
    data: {
      kode: KODE_FORM_KESANGGUPAN,
      judul: 'Form Kesanggupan',
      versi: 1,
      berkasObjectKey: tersimpan.objectKey,
      berkasNama: tersimpan.nama,
      berkasMime: tersimpan.mime,
      berkasByte: tersimpan.byte,
      berkasSha256: tersimpan.sha256,
      isActive: true,
      catatan: 'Dokumen bawaan. Ganti dengan berkas resmi perusahaan lewat menu Template Dokumen.',
      dibuatOleh: 'sistem',
    },
  });
}

/** Menjalankan penyemaian sekali saja walaupun dipanggil bersamaan. */
export async function pastikanTemplateBawaan(): Promise<void> {
  if (!penyemaianBerjalan) {
    penyemaianBerjalan = semaiBilaKosong().catch((error: unknown) => {
      // Dikosongkan lagi supaya penyemaian dicoba ulang pada permintaan berikutnya.
      penyemaianBerjalan = null;
      throw error;
    });
  }
  return penyemaianBerjalan;
}

/** Mengambil versi yang sedang aktif, menyemai lebih dulu bila perlu. */
export async function ambilAktif(kode = KODE_FORM_KESANGGUPAN) {
  await pastikanTemplateBawaan();

  const aktif = await db.documentTemplate.findFirst({
    where: { kode, isActive: true },
    orderBy: { versi: 'desc' },
  });

  if (!aktif) {
    throw new AppError(
      'TEMPLATE_NOT_AVAILABLE',
      'Dokumen belum tersedia. Admin perlu mengunggah berkas dokumen terlebih dahulu.',
      404,
    );
  }

  return aktif;
}

/** Daftar seluruh versi, terbaru lebih dulu. */
export async function daftarVersi(kode = KODE_FORM_KESANGGUPAN) {
  await pastikanTemplateBawaan();

  return db.documentTemplate.findMany({
    where: { kode },
    orderBy: { versi: 'desc' },
    select: {
      id: true,
      kode: true,
      judul: true,
      versi: true,
      berkasNama: true,
      berkasMime: true,
      berkasByte: true,
      isActive: true,
      catatan: true,
      dibuatOleh: true,
      diperbaruiOleh: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** Satu versi berdasarkan ID. */
export async function ambilSatu(id: string) {
  const template = await db.documentTemplate.findUnique({ where: { id } });
  if (!template) {
    throw new AppError('TEMPLATE_NOT_FOUND', 'Versi dokumen tidak ditemukan.', 404);
  }
  return template;
}

/**
 * Menyimpan berkas yang diunggah admin sebagai versi baru yang langsung aktif.
 *
 * Versi lama tidak dihapus, hanya dinonaktifkan. Penonaktifan dan pembuatan
 * versi baru dijalankan dalam satu transaksi supaya tidak pernah ada keadaan
 * dengan dua versi aktif atau tanpa versi aktif sama sekali.
 */
export async function simpanVersiBaru(params: {
  buffer: Buffer;
  namaAsli: string;
  judul?: string;
  catatan?: string;
  aktor?: string;
  kode?: string;
}) {
  const kode = params.kode ?? KODE_FORM_KESANGGUPAN;
  const tersimpan: DokumenSiapSimpan = await simpanDokumen(params.buffer, params.namaAsli);

  return db.$transaction(async (tx) => {
    const terakhir = await tx.documentTemplate.findFirst({
      where: { kode },
      orderBy: { versi: 'desc' },
      select: { versi: true, judul: true },
    });

    const versiBaru = (terakhir?.versi ?? 0) + 1;

    await tx.documentTemplate.updateMany({
      where: { kode, isActive: true },
      data: { isActive: false, diperbaruiOleh: params.aktor ?? null },
    });

    return tx.documentTemplate.create({
      data: {
        kode,
        judul: params.judul?.trim() || terakhir?.judul || 'Form Kesanggupan',
        versi: versiBaru,
        berkasObjectKey: tersimpan.objectKey,
        berkasNama: tersimpan.nama,
        berkasMime: tersimpan.mime,
        berkasByte: tersimpan.byte,
        berkasSha256: tersimpan.sha256,
        isActive: true,
        catatan: params.catatan?.trim() || null,
        dibuatOleh: params.aktor ?? null,
      },
    });
  });
}

/** Mengaktifkan kembali versi lama tanpa membuat versi baru. */
export async function aktifkanVersi(id: string, aktor?: string) {
  const template = await ambilSatu(id);

  return db.$transaction(async (tx) => {
    await tx.documentTemplate.updateMany({
      where: { kode: template.kode, isActive: true },
      data: { isActive: false, diperbaruiOleh: aktor ?? null },
    });

    return tx.documentTemplate.update({
      where: { id },
      data: { isActive: true, diperbaruiOleh: aktor ?? null },
    });
  });
}

/** Isi berkas dari versi tertentu. */
export async function bacaBerkas(id: string) {
  const template = await ambilSatu(id);
  const isi = await bacaDokumen(template.berkasObjectKey);
  return { template, isi };
}

/** Isi berkas dari versi yang sedang aktif. */
export async function bacaBerkasAktif() {
  const template = await ambilAktif();
  const isi = await bacaDokumen(template.berkasObjectKey);
  return { template, isi };
}

/**
 * Keterangan ringkas dokumen aktif untuk ditampilkan di aplikasi mobile.
 *
 * Aplikasi tidak lagi menampilkan isi klausul sebagai teks, karena dokumennya
 * bisa berupa PDF atau Word yang tidak bisa dibaca sebagai teks biasa. Yang
 * dikirim adalah keterangan berkasnya, dan pelanggan mengunduh berkasnya.
 */
export async function keteranganDokumenAktif() {
  const template = await ambilAktif();

  return {
    kode: template.kode,
    judul: template.judul,
    versi: template.versi,
    namaBerkas: template.berkasNama,
    mime: template.berkasMime,
    byte: template.berkasByte,
    diperbarui: template.createdAt,
  };
}

/**
 * Bentuk objek dari fungsi-fungsi di atas.
 *
 * Dipakai controller dan service lain supaya pemanggilnya cukup mengimpor satu
 * nama, dan pengelompokan ini juga menandai mana yang bagian dari antarmuka
 * publik modul ini.
 */
export const documentTemplateService = {
  pastikanTemplateBawaan,
  ambilAktif,
  daftarVersi,
  ambilSatu,
  simpanVersiBaru,
  aktifkanVersi,
  bacaBerkas,
  bacaBerkasAktif,
  keteranganDokumenAktif,
};
