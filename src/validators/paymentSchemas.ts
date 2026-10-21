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

export const webhookMutationSchema = z.object({
  amount: z.coerce.number().positive('Nominal mutasi harus lebih besar dari 0'),
  sender: z.string().optional().default('ANONYMOUS_SENDER'),
  referenceNo: z.string().optional().default(() => `MUT-${Date.now()}`),
  bank: z.string().optional().default('GOPAY'),
  type: z.enum(['CR', 'DB']).optional().default('CR'),
  description: z.string().optional(),
  timestamp: z.string().optional(),
});

export const simulateMutationSchema = z.object({
  paymentId: z.string().optional(),
  bookingId: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  sender: z.string().optional().default('PENGUJI_SIMULASI_E2E'),
  referenceNo: z.string().optional().default(() => `SIM-${Date.now()}`),
  bank: z.string().optional().default('GOPAY'),
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
export type WebhookMutationInput = z.infer<typeof webhookMutationSchema>;
export type SimulateMutationInput = z.infer<typeof simulateMutationSchema>;
export type AdminVerifyPaymentInput = z.infer<typeof adminVerifyPaymentSchema>;
export type ListPaymentQuery = z.infer<typeof listPaymentQuerySchema>;
