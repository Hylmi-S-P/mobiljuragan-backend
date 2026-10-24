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
    .string({
      error: (issue) =>
        issue.input === undefined ? 'Pertanyaan wajib diisi.' : 'Pertanyaan harus berupa teks.',
    })
    .trim()
    .min(3, 'Pertanyaan minimal 3 karakter.')
    .max(1000, 'Pertanyaan maksimal 1000 karakter.'),
  answer: z
    .string({
      error: (issue) =>
        issue.input === undefined ? 'Jawaban wajib diisi.' : 'Jawaban harus berupa teks.',
    })
    .trim()
    .min(3, 'Jawaban minimal 3 karakter.')
    .max(5000, 'Jawaban maksimal 5000 karakter.'),
  category: z
    .string({
      error: (issue) =>
        issue.input === undefined ? 'Kategori wajib diisi.' : 'Kategori harus berupa teks.',
    })
    .trim()
    .min(1, 'Kategori wajib diisi.')
    .max(100, 'Kategori maksimal 100 karakter.'),
  orderIndex: z
    .number({
      error: (issue) =>
        issue.input === undefined
          ? 'Urutan prioritas wajib diisi.'
          : 'Urutan prioritas harus berupa angka.',
    })
    .int('Urutan prioritas harus berupa bilangan bulat.')
    .min(0, 'Urutan prioritas minimal 0.')
    .optional(),
  isActive: z
    .boolean({
      error: (issue) =>
        issue.input === undefined
          ? 'Status aktif wajib diisi.'
          : 'Status aktif harus berupa boolean.',
    })
    .optional(),
});

export const updateFaqSchema = createFaqSchema.partial();

export type ListFaqQuery = z.infer<typeof listFaqQuerySchema>;
export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
