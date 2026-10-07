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
    startDateTime: z
      .string()
      .datetime({ message: 'startDateTime harus berformat ISO 8601 (contoh: 2026-10-01T08:00:00Z).' }),
    endDateTime: z
      .string()
      .datetime({ message: 'endDateTime harus berformat ISO 8601 (contoh: 2026-10-03T18:00:00Z).' }),
    rentalType: z.nativeEnum(RentalType, {
      errorMap: () => ({ message: 'rentalType harus bernilai WITH_DRIVER atau WITHOUT_DRIVER.' }),
    }),
    pickupLocation: z.string().max(255).optional(),
    customerRequest: z.string().max(1000).optional(),
    numberGuests: z.number().int().min(1, 'Minimal jumlah penumpang adalah 1 orang.').max(50).optional(),
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
    errorMap: () => ({ message: 'Status sewa tidak valid.' }),
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
