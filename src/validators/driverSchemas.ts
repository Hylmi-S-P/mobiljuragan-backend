import { z } from 'zod';
import { DriverLicenseType, DriverReadiness, DriverRoute } from '../generated/prisma/client.js';

/**
 * Skema validasi modul roster supir.
 *
 * Dipisah dari router dan controller supaya keduanya bisa memakainya tanpa
 * saling mengimpor. Router memasangnya lewat validateQuery / validateBody,
 * controller memakai tipenya untuk membaca req.body dan req.query.
 */

export const listQuerySchema = z.object({
  readiness: z.nativeEnum(DriverReadiness).optional(),
  routeScope: z.nativeEnum(DriverRoute).optional(),
  search: z.string().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9+()\-\s]{8,20}$/,
    'Nomor kontak harus 8 sampai 20 karakter angka, boleh memakai tanda + atau tanda hubung.',
  )
  .nullable()
  .optional();

const licenseSchema = z
  .string()
  .trim()
  .min(4, 'Nomor SIM minimal 4 karakter.')
  .max(30, 'Nomor SIM maksimal 30 karakter.')
  .nullable()
  .optional();

/**
 * Foto SIM: data URL Base64 dari dashboard lama, atau tautan media internal.
 *
 * Tautan media harus diterima karena dashboard membaca `licensePhotoUrl` dari
 * server lalu mengirimkannya kembali saat menyunting. Kalau hanya Base64 yang
 * diterima, menyunting nama supir akan gagal karena fotonya sudah berbentuk
 * tautan. Batas 5 MB dihitung dari panjang string; batas sebenarnya diperiksa
 * setelah isinya diukur di pipeline gambar.
 */
const BATAS_FOTO_BASE64 = 5 * 1024 * 1024;

const licensePhotoSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (v) =>
      v == null ||
      v === '' ||
      /^data:image\/(png|jpeg|webp);base64,/.test(v) ||
      /^\/api\/v1\/media\/[0-9a-f-]{36}(\?.*)?$/.test(v),
    { message: 'Foto SIM harus berupa berkas gambar PNG, JPG, atau WebP.' },
  )
  .refine((v) => v == null || v.length <= BATAS_FOTO_BASE64, {
    message: 'Foto SIM maksimal 5 MB.',
  });

export const createDriverSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Nama supir minimal 3 karakter.')
    .max(80, 'Nama supir maksimal 80 karakter.'),
  phoneNumber: phoneSchema,
  licenseNumber: licenseSchema,
  /* Jenis SIM dipilih dari daftar, bukan diketik. Halimah meminta ini supaya
     tidak ada "SIM A", "sim a", dan "A" untuk hal yang sama. */
  licenseType: z.nativeEnum(DriverLicenseType).nullable().optional(),
  licensePhotoUrl: licensePhotoSchema,
  routeScope: z.nativeEnum(DriverRoute, {
    error: 'Rute penugasan tidak valid (pilih: DALAM_KOTA atau LUAR_KOTA).',
  }),
});

export const updateDriverSchema = createDriverSchema.partial();

export const readinessSchema = z.object({
  readiness: z.nativeEnum(DriverReadiness, {
    error: 'Status kesiapan tidak valid (pilih: SIAGA, LIBUR, atau SEDANG_TUGAS).',
  }),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});
