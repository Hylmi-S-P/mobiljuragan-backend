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
};
