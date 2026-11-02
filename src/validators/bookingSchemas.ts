import { z } from 'zod';
import { BookingStatus, RentalType } from '../generated/prisma/client.js';

/**
 * Skema validasi modul pemesanan sewa.
 *
 * Dipisah dari router dan controller supaya keduanya bisa memakainya tanpa
 * saling mengimpor. Router memasangnya lewat validateQuery / validateBody,
 * controller memakai tipenya untuk membaca req.body dan req.query.
 */

export const createBookingSchema = z
  .object({
    vehicleId: z.string().min(1, 'vehicleId wajib diisi.'),
    startDateTime: z.string().datetime({
      message: 'startDateTime harus berformat ISO 8601 (contoh: 2026-10-01T08:00:00Z).',
    }),
    endDateTime: z.string().datetime({
      message: 'endDateTime harus berformat ISO 8601 (contoh: 2026-10-03T18:00:00Z).',
    }),
    rentalType: z.nativeEnum(RentalType, {
      error: 'rentalType harus bernilai WITH_DRIVER atau WITHOUT_DRIVER.',
    }),
    pickupLocation: z.string().max(255).optional(),
    customerRequest: z.string().max(1000).optional(),
    numberGuests: z
      .number()
      .int()
      .min(1, 'Minimal jumlah penumpang adalah 1 orang.')
      .max(50)
      .optional(),
  })
  .refine((data) => new Date(data.endDateTime) > new Date(data.startDateTime), {
    message: 'endDateTime harus lebih besar dari startDateTime.',
    path: ['endDateTime'],
  });

export const adminBookingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(BookingStatus).optional(),
  search: z.string().optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus, {
    error: 'Status sewa tidak valid.',
  }),
  quotedAmount: z.number().nonnegative('Tarif sewa tidak boleh bernilai negatif.').optional(),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

export const assignDriverSchema = z.object({
  driverId: z
    .string()
    .trim()
    .min(1, 'driverId wajib diisi, boleh uuid supir atau externalId seperti markus-gebze.'),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

export const customerCancelBookingSchema = z.object({
  reason: z.string().max(500, 'Alasan pembatalan maksimal 500 karakter.').optional(),
});

/**
 * Penyesuaian biaya manual (surcharge) pada satu booking.
 *
 * Semua isian wajib, termasuk justifikasi. Dashboard sudah memintanya sebagai
 * "catatan justifikasi operasional (wajib untuk audit internal)", jadi server
 * menegakkan aturan yang sama — bukan diam-diam menerima baris tanpa alasan.
 *
 * `nominal` harus POSITIF. Arah penambahan/pengurangan ada di `arah`, sehingga
 * tidak ada nilai negatif yang perlu ditafsirkan saat dibaca balik.
 */
export const createLineItemSchema = z.object({
  kategori: z
    .string()
    .trim()
    .min(1, 'Kategori penyesuaian wajib dipilih.')
    .max(64, 'Kategori maksimal 64 karakter.'),
  deskripsi: z
    .string()
    .trim()
    .min(1, 'Deskripsi penyesuaian wajib diisi.')
    .max(200, 'Deskripsi maksimal 200 karakter.'),
  nominal: z
    .number({ error: 'Nominal penyesuaian harus berupa angka.' })
    .positive('Nominal penyesuaian harus lebih dari 0.'),
  arah: z.enum(['TAMBAH', 'KURANG'], {
    error: 'Arah penyesuaian harus TAMBAH atau KURANG.',
  }),
  justifikasi: z
    .string()
    .trim()
    .min(1, 'Justifikasi wajib diisi untuk audit internal.')
    .max(1000, 'Justifikasi maksimal 1000 karakter.'),
});
