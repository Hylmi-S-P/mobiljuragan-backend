import { z } from 'zod';
import { DriverReadiness, DriverRoute } from '../generated/prisma/client.js';

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

export const createDriverSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Nama supir minimal 3 karakter.')
    .max(80, 'Nama supir maksimal 80 karakter.'),
  phoneNumber: phoneSchema,
  licenseNumber: licenseSchema,
  routeScope: z.nativeEnum(DriverRoute, {
    errorMap: () => ({ message: 'Rute penugasan tidak valid (pilih: DALAM_KOTA atau LUAR_KOTA).' }),
  }),
});

export const updateDriverSchema = createDriverSchema.partial();

export const readinessSchema = z.object({
  readiness: z.nativeEnum(DriverReadiness, {
    errorMap: () => ({
      message: 'Status kesiapan tidak valid (pilih: SIAGA, LIBUR, atau SEDANG_TUGAS).',
    }),
  }),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});
