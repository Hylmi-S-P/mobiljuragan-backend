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
  search: z.string().trim().max(50, 'Kata kunci maksimal 50 karakter.').optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus, {
    error: 'Status sewa tidak valid.',
  }),
  note: z.string().max(300, 'Catatan maksimal 300 karakter.').optional(),
});

export const assignDriverSchema = z.object({
  driverId: z
    .string()
    .trim()
    .min(1, 'driverId wajib diisi, boleh uuid supir atau externalId seperti markus-gebze.'),
  note: z.string().max(300, 'Catatan maksimal 300 karakter.').optional(),
});

/**
 * Rekening tujuan pengembalian dana.
 *
 * Pelanggan sudah mengisi ini di aplikasi saat membatalkan pesanan yang sudah
 * dibayar. Sebelumnya isian itu berhenti di perangkat dan kantor harus
 * menelepon pelanggan untuk menanyakan nomor rekening; sekarang ikut terkirim
 * bersama pembatalan supaya antrean pengembalian dana langsung bisa diproses.
 */
export const refundAccountSchema = z.object({
  bankName: z
    .string()
    .trim()
    .min(2, 'Nama bank atau e-wallet wajib diisi.')
    .max(30, 'Nama bank atau e-wallet maksimal 30 karakter.'),
  accountNumber: z
    .string()
    .trim()
    .min(6, 'Nomor rekening minimal 6 digit.')
    .max(20, 'Nomor rekening maksimal 20 karakter.')
    .regex(/^[0-9]+$/, 'Nomor rekening hanya boleh berisi angka.'),
  accountHolderName: z
    .string()
    .trim()
    .min(2, 'Nama pemilik rekening wajib diisi.')
    .max(60, 'Nama pemilik rekening maksimal 60 karakter.'),
});

export const customerCancelBookingSchema = z.object({
  reason: z.string().max(300, 'Alasan pembatalan maksimal 300 karakter.').optional(),
  /** Opsional: hanya dikirim pelanggan yang pesanannya sudah dibayar. */
  refundAccount: refundAccountSchema.optional(),
});

/**
 * Rekening tujuan yang dikirim pelanggan setelah pesanannya dibatalkan.
 *
 * Dipakai tombol "Klaim Pengembalian Dana" di riwayat pesanan: pelanggan yang
 * dulu membatalkan tanpa mengisi rekening tetap bisa melengkapinya selama
 * kantor belum memproses pengembaliannya.
 */
export const updateRefundAccountSchema = z.object({
  refundAccount: refundAccountSchema,
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
    .max(150, 'Deskripsi maksimal 150 karakter.'),
  nominal: z
    .number({ error: 'Nominal penyesuaian harus berupa angka.' })
    .positive('Nominal penyesuaian harus lebih dari 0.')
    .max(100_000_000, 'Nominal penyesuaian maksimal Rp 100.000.000.'),
  arah: z.enum(['TAMBAH', 'KURANG'], {
    error: 'Arah penyesuaian harus TAMBAH atau KURANG.',
  }),
  justifikasi: z
    .string()
    .trim()
    .min(1, 'Justifikasi wajib diisi untuk audit internal.')
    .max(300, 'Justifikasi maksimal 300 karakter.'),
});
