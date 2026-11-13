import { z } from 'zod';
import { RefundStatus } from '../generated/prisma/client.js';

export const listRefundQuerySchema = z.object({
  status: z.nativeEnum(RefundStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Penyuntingan catatan pengembalian dana oleh admin.
 *
 * Semua kolom opsional karena admin mengisi bertahap: nomor rekening dulu saat
 * pelanggan mengirim, lalu bukti transfer saat uangnya benar-benar dikirim.
 * Perubahan status SELESAI wajib menyertakan bukti atau catatan supaya antrean
 * tidak ditutup tanpa jejak.
 */
export const updateRefundSchema = z
  .object({
    nominal: z.coerce.number().min(0).max(1_000_000_000).optional(),
    namaBank: z.string().trim().max(80).optional(),
    nomorRekening: z.string().trim().max(40).optional(),
    namaPemilik: z.string().trim().max(120).optional(),
    buktiMediaId: z.string().trim().max(120).optional(),
    catatan: z.string().trim().max(500).optional(),
    status: z.nativeEnum(RefundStatus).optional(),
  })
  .refine(
    (nilai) =>
      nilai.status !== RefundStatus.SELESAI || Boolean(nilai.buktiMediaId || nilai.catatan),
    {
      message:
        'Menutup pengembalian dana wajib menyertakan bukti transfer atau catatan penyelesaian.',
      path: ['status'],
    },
  );

export type UpdateRefundInput = z.infer<typeof updateRefundSchema>;
