import { z } from 'zod';
import { DOCUMENT_TARGETS } from '../lib/documentTargets.js';

/**
 * Skema validasi berkas dokumen pemesanan.
 *
 * Dipisah dari controller supaya pesan galatnya konsisten dan bisa dipakai
 * bersama oleh dua endpoint: verifikasi (setujui/tolak) dan permintaan unggah
 * ulang. Keduanya menyentuh baris yang sama, jadi bentuk masukannya dibuat
 * seragam.
 */

const targetSchema = z.enum(DOCUMENT_TARGETS, {
  error: 'Dokumen harus salah satu dari KTP, SIM, atau STATEMENT.',
});

const catatanSchema = z
  .string({ error: 'Catatan untuk pelanggan wajib diisi.' })
  .trim()
  .min(10, 'Catatan minimal 10 karakter supaya pelanggan tahu apa yang harus diperbaiki.')
  .max(500, 'Catatan maksimal 500 karakter.');

export const verifyDocumentsSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT'], {
      error: 'Aksi verifikasi harus bernilai APPROVE atau REJECT.',
    }),
    rejectionReason: z.string().trim().max(500, 'Catatan maksimal 500 karakter.').optional(),
    targets: z.array(targetSchema).max(DOCUMENT_TARGETS.length).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action !== 'REJECT') return;

    if (!data.targets || data.targets.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets'],
        message: 'Pilih minimal satu dokumen yang bermasalah sebelum menolak.',
      });
    }

    /* Penolakan tanpa alasan membuat pelanggan menebak apa yang salah, lalu
       mengunggah ulang berkas yang sama persis. */
    if (!data.rejectionReason || data.rejectionReason.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Tuliskan alasan penolakan supaya pelanggan tahu apa yang harus diperbaiki.',
      });
    }
  });

/**
 * Permintaan unggah ulang berkas tertentu.
 *
 * Semua berkas bisa sekaligus lewat `semuaBerkas: true`; kalau tidak, `targets`
 * wajib berisi minimal satu berkas. Catatan wajib karena isi catatan itulah yang
 * dibaca pelanggan di aplikasi.
 */
export const requestDocumentRevisionSchema = z
  .object({
    catatan: catatanSchema,
    targets: z.array(targetSchema).max(DOCUMENT_TARGETS.length).optional(),
    semuaBerkas: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.semuaBerkas) return;

    if (!data.targets || data.targets.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets'],
        message: 'Pilih berkas yang perlu diunggah ulang, atau minta semua berkas.',
      });
    }
  });
