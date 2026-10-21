import { z } from 'zod';

/**
 * Skema validasi untuk modul FAQ dinamis MobilJuragan Merauke.
 */

export const listFaqQuerySchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export const createFaqSchema = z.object({
  question: z
    .string({ required_error: 'Pertanyaan wajib diisi.' })
    .trim()
    .min(3, 'Pertanyaan minimal 3 karakter.')
    .max(1000, 'Pertanyaan maksimal 1000 karakter.'),
  answer: z
    .string({ required_error: 'Jawaban wajib diisi.' })
    .trim()
    .min(3, 'Jawaban minimal 3 karakter.'),
  category: z
    .string({ required_error: 'Kategori wajib diisi.' })
    .trim()
    .min(1, 'Kategori wajib diisi.')
    .max(100, 'Kategori maksimal 100 karakter.'),
  orderIndex: z
    .number({ invalid_type_error: 'Urutan prioritas harus berupa angka.' })
    .int('Urutan prioritas harus berupa bilangan bulat.')
    .min(0, 'Urutan prioritas minimal 0.')
    .optional(),
  isActive: z.boolean({ invalid_type_error: 'Status aktif harus berupa boolean.' }).optional(),
});

export const updateFaqSchema = createFaqSchema.partial();

export type ListFaqQuery = z.infer<typeof listFaqQuerySchema>;
export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
