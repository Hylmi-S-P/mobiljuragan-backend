import { db } from '../db.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Model lapisan data untuk tabel `faqs`.
 * Mengelola query database untuk FAQ publik dan manajemen admin portal.
 */
export const faqModel = {
  /**
   * Mengambil daftar FAQ aktif untuk konsumsi publik (mobile & RAG).
   * Diurutkan berdasarkan orderIndex ASC, kemudian createdAt ASC.
   */
  findActive(filter?: { category?: string; search?: string }) {
    const where: Prisma.FaqWhereInput = {
      isActive: true,
    };

    if (filter?.category && filter.category.trim() !== '' && filter.category.toLowerCase() !== 'semua') {
      where.category = filter.category.trim();
    }

    if (filter?.search && filter.search.trim() !== '') {
      const keyword = filter.search.trim();
      where.OR = [
        { question: { contains: keyword } },
        { answer: { contains: keyword } },
      ];
    }

    return db.faq.findMany({
      where,
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  },

  /**
   * Mengambil daftar seluruh FAQ untuk manajemen admin portal (aktif & nonaktif).
   */
  findAllAdmin(filter?: { category?: string; search?: string; isActive?: boolean }) {
    const where: Prisma.FaqWhereInput = {};

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.category && filter.category.trim() !== '' && filter.category.toLowerCase() !== 'semua') {
      where.category = filter.category.trim();
    }

    if (filter?.search && filter.search.trim() !== '') {
      const keyword = filter.search.trim();
      where.OR = [
        { question: { contains: keyword } },
        { answer: { contains: keyword } },
      ];
    }

    return db.faq.findMany({
      where,
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  },

  findById(id: string) {
    return db.faq.findUnique({
      where: { id },
    });
  },

  create(data: Prisma.FaqCreateInput) {
    return db.faq.create({
      data,
    });
  },

  update(id: string, data: Prisma.FaqUpdateInput) {
    return db.faq.update({
      where: { id },
      data,
    });
  },

  async toggle(id: string) {
    const affected = await db.$executeRaw`
      UPDATE faqs
      SET isActive = NOT isActive, updatedAt = UTC_TIMESTAMP(3)
      WHERE id = ${id}
    `;

    if (affected === 0) {
      return null;
    }

    return db.faq.findUnique({
      where: { id },
    });
  },

  delete(id: string) {
    return db.faq.delete({
      where: { id },
    });
  },
};
