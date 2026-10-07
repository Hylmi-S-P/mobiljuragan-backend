import type { NextFunction, Request, Response } from 'express';
import { TicketCategory, TicketStatus } from '../generated/prisma/client.js';
import { ticketModel } from '../model/ticketModel.js';
import { AppError, sendSuccess } from '../lib/response.js';

/**
 * Controller customer care.
 *
 * Menangani daftar tiket, detail tiket beserta percakapan, pembaruan status,
 * dan pengiriman balasan tim. Semua kegagalan diteruskan lewat `next(error)`
 * supaya ditangani satu kali oleh errorHandler global.
 */

const STATUS_VALUES = Object.values(TicketStatus);
const CATEGORY_VALUES = Object.values(TicketCategory);

export const ticketController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawStatus = (req.query.status as string | undefined)?.toUpperCase();

      if (rawStatus && !STATUS_VALUES.includes(rawStatus as TicketStatus)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Status tiket tidak valid (pilih: ${STATUS_VALUES.join(', ')}).`,
          400,
        );
      }

      const tickets = await ticketModel.listWithCounts({
        status: rawStatus as TicketStatus | undefined,
      });

      sendSuccess(res, tickets);
    } catch (error) {
      next(error);
    }
  },

  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const ticket = await ticketModel.findById(id);

      if (!ticket) {
        throw new AppError('TICKET_NOT_FOUND', `Tiket dengan ID '${id}' tidak ditemukan.`, 404);
      }

      sendSuccess(res, ticket);
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const rawStatus = (req.body?.status as string | undefined)?.toUpperCase();

      if (!rawStatus || !STATUS_VALUES.includes(rawStatus as TicketStatus)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Status tiket wajib diisi dan harus salah satu dari: ${STATUS_VALUES.join(', ')}.`,
          400,
        );
      }

      const existing = await ticketModel.findById(id);
      if (!existing) {
        throw new AppError('TICKET_NOT_FOUND', `Tiket dengan ID '${id}' tidak ditemukan.`, 404);
      }

      const updated = await ticketModel.updateStatus(id, rawStatus as TicketStatus);
      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  },

  async addMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const body = (req.body?.body as string | undefined)?.trim();
      const actor = req.user!;

      if (!body) {
        throw new AppError('VALIDATION_ERROR', 'Isi pesan wajib diisi.', 400);
      }

      const existing = await ticketModel.findById(id);
      if (!existing) {
        throw new AppError('TICKET_NOT_FOUND', `Tiket dengan ID '${id}' tidak ditemukan.`, 404);
      }

      const message = await ticketModel.createMessage({
        ticket: { connect: { id } },
        sender: { connect: { id: actor.userId } },
        body,
        // Balasan dari portal selalu berasal dari tim, bukan pelanggan.
        isCustomer: false,
      });

      // Tiket yang baru dibalas tim berubah menjadi menunggu pelanggan.
      if (existing.status === TicketStatus.OPEN || existing.status === TicketStatus.IN_PROGRESS) {
        await ticketModel.updateStatus(id, TicketStatus.WAITING_CUSTOMER);
      }

      sendSuccess(res, message, 201);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const title = (req.body?.title as string | undefined)?.trim();
      const description = (req.body?.description as string | undefined)?.trim();
      const rawCategory = (req.body?.category as string | undefined)?.toUpperCase();
      const customerId = req.body?.customerId as string | undefined;
      const actor = req.user!;

      if (!title) {
        throw new AppError('VALIDATION_ERROR', 'Judul tiket wajib diisi.', 400);
      }
      if (!description) {
        throw new AppError('VALIDATION_ERROR', 'Deskripsi tiket wajib diisi.', 400);
      }
      if (rawCategory && !CATEGORY_VALUES.includes(rawCategory as TicketCategory)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Kategori tiket tidak valid (pilih: ${CATEGORY_VALUES.join(', ')}).`,
          400,
        );
      }

      const ticketNumber = await ticketModel.nextTicketNumber(new Date());

      const created = await ticketModel.create({
        ticketNumber,
        title,
        description,
        category: (rawCategory as TicketCategory) ?? TicketCategory.GENERAL,
        // Tanpa customerId, tiket dicatat atas nama staf yang membuatnya.
        customer: { connect: { id: customerId ?? actor.userId } },
      });

      sendSuccess(res, created, 201);
    } catch (error) {
      next(error);
    }
  },
};
