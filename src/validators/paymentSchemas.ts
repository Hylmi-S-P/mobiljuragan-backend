import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/client.js';

export const createPaymentSchema = z.object({
  bookingId: z.string().min(1, 'ID atau kode booking wajib diisi'),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.QRIS),
  notes: z.string().optional(),
});

export const uploadPaymentProofSchema = z.object({
  proofImageUrl: z.string().min(1, 'URL atau bukti transfer wajib diisi'),
  senderAccount: z.string().optional(),
  bankName: z.string().optional(),
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
