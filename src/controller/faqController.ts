import type { NextFunction, Request, Response } from 'express';
import { faqModel } from '../model/faqModel.js';
import { AppError, sendSuccess } from '../lib/response.js';
import type { CreateFaqInput, ListFaqQuery, UpdateFaqInput } from '../validators/faqSchemas.js';

/**
 * Controller untuk mengelola FAQ dinamis MobilJuragan Merauke.
 * Mendukung konsumsi publik (mobile) dan operasi CRUD admin portal.
 */
export const faqController = {
  /**
   * GET /api/v1/faqs
   * Endpoint publik untuk aplikasi mobile Flutter.
   * Hanya menyajikan FAQ dengan isActive: true, diurutkan berdasarkan orderIndex ASC.
   */
  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, search } = req.query as { category?: string; search?: string };
      const faqs = await faqModel.findActive({ category, search });
      sendSuccess(res, faqs);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/faqs
   * Endpoint admin portal untuk menampilkan seluruh FAQ (aktif & nonaktif).
   */
  async listAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, search, isActive } = req.query as ListFaqQuery;
      let activeFilter: boolean | undefined = undefined;
      if (isActive === 'true') activeFilter = true;
      if (isActive === 'false') activeFilter = false;

      const faqs = await faqModel.findAllAdmin({
        category,
        search,
        isActive: activeFilter,
      });

      sendSuccess(res, faqs);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/faqs/:id
   * Detail satu FAQ berdasarkan ID.
   */
  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const faq = await faqModel.findById(id);

      if (!faq) {
        throw new AppError('FAQ_NOT_FOUND', `FAQ dengan ID '${id}' tidak ditemukan.`, 404);
      }

      sendSuccess(res, faq);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/admin/faqs
   * Tambah FAQ baru oleh admin.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as CreateFaqInput;

      const created = await faqModel.create({
        question: body.question.trim(),
        answer: body.answer.trim(),
        category: body.category.trim(),
        orderIndex: body.orderIndex ?? 0,
        isActive: body.isActive ?? true,
      });

      sendSuccess(res, created, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT / PATCH /api/v1/admin/faqs/:id
   * Edit FAQ yang ada oleh admin.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body as UpdateFaqInput;

      const existing = await faqModel.findById(id);
      if (!existing) {
        throw new AppError('FAQ_NOT_FOUND', `FAQ dengan ID '${id}' tidak ditemukan.`, 404);
      }

      const updated = await faqModel.update(id, {
        ...(body.question !== undefined ? { question: body.question.trim() } : {}),
        ...(body.answer !== undefined ? { answer: body.answer.trim() } : {}),
        ...(body.category !== undefined ? { category: body.category.trim() } : {}),
        ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/faqs/:id/toggle
   * Saklar instan visibilitas FAQ ke aplikasi mobile.
   */
  async toggle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const toggled = await faqModel.toggle(id);

      if (!toggled) {
        throw new AppError('FAQ_NOT_FOUND', `FAQ dengan ID '${id}' tidak ditemukan.`, 404);
      }

      sendSuccess(res, toggled);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/admin/faqs/:id
   * Hapus FAQ permanen dari database.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const existing = await faqModel.findById(id);
      if (!existing) {
        throw new AppError('FAQ_NOT_FOUND', `FAQ dengan ID '${id}' tidak ditemukan.`, 404);
      }

      await faqModel.delete(id);

      sendSuccess(res, { id });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/admin/faqs/categories
   * Daftar kategori FAQ beserta jumlah pemakainya.
   */
  async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await faqModel.listCategories();
      sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/admin/faqs/categories/:nama
   * Mengganti nama kategori pada semua FAQ yang memakainya.
   */
  async renameCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lama = decodeURIComponent(req.params.nama ?? '').trim();
      const baru = String((req.body as { namaBaru?: string }).namaBaru ?? '').trim();

      if (!lama) {
        throw new AppError('VALIDATION_ERROR', 'Nama kategori lama wajib diisi.', 400);
      }
      if (baru.length < 2 || baru.length > 100) {
        throw new AppError('VALIDATION_ERROR', 'Nama kategori baru harus 2 sampai 100 karakter.', 400);
      }

      const jumlah = await faqModel.countByCategory(lama);
      if (jumlah === 0) {
        throw new AppError('FAQ_CATEGORY_NOT_FOUND', `Kategori '${lama}' tidak ditemukan.`, 404);
      }

      /* Menggabung ke kategori yang sudah ada diperbolehkan: hasilnya satu
         kategori, bukan dua yang mirip. Yang ditolak hanya nama yang sama. */
      if (lama === baru) {
        throw new AppError('FAQ_CATEGORY_SAMA', 'Nama kategori baru sama dengan yang lama.', 400);
      }

      const diubah = await faqModel.renameCategory(lama, baru);
      sendSuccess(res, { dari: lama, ke: baru, jumlah: diubah });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/admin/faqs/categories/:nama
   *
   * Kategori bukan baris tersendiri: ia hanya kolom teks pada FAQ. Karena itu
   * "menghapus kategori" hanya masuk akal bila FAQ yang memakainya dipindahkan
   * lebih dulu. Tanpa `pindahkanKe`, permintaan ditolak dengan jumlah pemakainya
   * supaya admin tahu berapa baris yang harus dipindahkan.
   *
   * Dengan `?pindahkanKe=<kategori lain>`, seluruh FAQ dipindahkan lalu kategori
   * lama tidak lagi dipakai siapa pun.
   */
  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const nama = decodeURIComponent(req.params.nama ?? '').trim();
      const pindahkanKe = String((req.query.pindahkanKe as string | undefined) ?? '').trim();

      if (!nama) {
        throw new AppError('VALIDATION_ERROR', 'Nama kategori wajib diisi.', 400);
      }

      const jumlah = await faqModel.countByCategory(nama);
      if (jumlah === 0) {
        throw new AppError('FAQ_CATEGORY_NOT_FOUND', `Kategori '${nama}' tidak ditemukan.`, 404);
      }

      if (!pindahkanKe) {
        throw new AppError(
          'FAQ_CATEGORY_MASIH_DIPAKAI',
          `Kategori '${nama}' masih dipakai ${jumlah} FAQ. Pilih kategori tujuan untuk memindahkannya lebih dulu.`,
          409,
        );
      }

      if (pindahkanKe === nama) {
        throw new AppError(
          'FAQ_CATEGORY_SAMA',
          'Kategori tujuan tidak boleh sama dengan kategori yang dihapus.',
          400,
        );
      }

      const dipindahkan = await faqModel.renameCategory(nama, pindahkanKe);
      sendSuccess(res, { dihapus: nama, pindahkanKe, jumlah: dipindahkan });
    } catch (error) {
      next(error);
    }
  },
};
