import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/client.js';

/*
 * Pelanggan hanya boleh memilih QRIS atau transfer bank.
 *
 * Pembayaran tunai dicatat admin di kantor, bukan dipilih sendiri dari aplikasi.
 * Alasannya bukan soal selera: pesanan tunai tidak pernah melewati verifikasi
 * pembayaran, sehingga aturan "armada hanya diserahkan setelah lunas" tidak
 * berlaku untuk jalur itu, dan tenggat pembayaran juga tidak bisa ditegakkan.
 *
 * Nilai `CASH` tetap ada di enum karena pesanan lama masih memakainya; yang
 * ditutup hanya jalur pembuatan tagihan baru dari sisi pelanggan.
 */
export const createPaymentSchema = z.object({
  bookingId: z.string().min(1, 'ID atau kode booking wajib diisi'),
  method: z
    .nativeEnum(PaymentMethod)
    .refine((nilai) => nilai !== PaymentMethod.CASH, {
      message:
        'Pembayaran tunai tidak bisa dipilih dari aplikasi. Silakan bayar langsung di kantor.',
    })
    .default(PaymentMethod.QRIS),
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

export const adminVerifyPaymentSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    notes: z.string().optional(),
    /* Hanya berlaku untuk REJECT. `false` (bawaan) menolak bukti bayar tetapi
       membiarkan pesanan hidup supaya pelanggan bisa mengunggah ulang; `true`
       membatalkan pesanan sekaligus, dipakai saat ada indikasi penipuan. */
    cancelBooking: z.boolean().optional(),
  })
  .refine((nilai) => !(nilai.action === 'APPROVE' && nilai.cancelBooking), {
    message: 'Pembatalan pesanan hanya bisa menyertai penolakan pembayaran.',
    path: ['cancelBooking'],
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
