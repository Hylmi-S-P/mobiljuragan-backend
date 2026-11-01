import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/client.js';

export const createPaymentSchema = z.object({
  bookingId: z.string().min(1, 'ID atau kode booking wajib diisi'),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.QRIS),
  notes: z.string().optional(),
});

/**
 * Bukti transfer boleh dikirim dengan salah satu cara:
 *
 * - `proofMediaId`: hasil unggahan ke `/api/v1/media` (cara baru);
 * - `proofImageUrl`: data URL Base64 atau tautan media internal (cara lama,
 *   tetap diterima supaya APK yang sudah beredar tidak rusak).
 *
 * Batas panjang Base64 di sini hanya pagar pertama. Batas sebenarnya diperiksa
 * setelah isinya diukur, karena panjang string tidak sama dengan ukuran berkas.
 */
export const uploadPaymentProofSchema = z
  .object({
    proofImageUrl: z.string().optional(),
    proofMediaId: z.string().uuid('ID media tidak valid').optional(),
    senderAccount: z.string().optional(),
    bankName: z.string().optional(),
  })
  .refine((data) => Boolean(data.proofImageUrl || data.proofMediaId), {
    message: 'Bukti transfer wajib diunggah.',
    path: ['proofImageUrl'],
  });

export const adminVerifyPaymentSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().optional(),
});

export const listPaymentQuerySchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>;
export type AdminVerifyPaymentInput = z.infer<typeof adminVerifyPaymentSchema>;
export type ListPaymentQuery = z.infer<typeof listPaymentQuerySchema>;
