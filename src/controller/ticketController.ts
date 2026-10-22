import type { NextFunction, Request, Response } from 'express';
import { TicketCategory, TicketStatus, UserRole } from '../generated/prisma/client.js';
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

const CATEGORY_MAP: Record<string, TicketCategory> = {
  RESERVASI: TicketCategory.GENERAL,
  PEMBAYARAN: TicketCategory.PAYMENT_CONFIRMATION,
  KENDARAAN: TicketCategory.VEHICLE_ISSUE,
  LAYANANSOPIR: TicketCategory.COMPLAINT,
  LAYANAN_SOPIR: TicketCategory.COMPLAINT,
  LAINNYA: TicketCategory.OTHER,
  GENERAL: TicketCategory.GENERAL,
  PAYMENT_CONFIRMATION: TicketCategory.PAYMENT_CONFIRMATION,
  VEHICLE_ISSUE: TicketCategory.VEHICLE_ISSUE,
  CANCELLATION: TicketCategory.CANCELLATION,
  COMPLAINT: TicketCategory.COMPLAINT,
  OTHER: TicketCategory.OTHER,
};

function parseTicketCategory(raw?: string): TicketCategory {
  if (!raw) return TicketCategory.GENERAL;
  const normalized = raw.trim().toUpperCase();
  const mapped = CATEGORY_MAP[normalized];
  if (mapped) return mapped;
  if (CATEGORY_VALUES.includes(normalized as TicketCategory)) {
    return normalized as TicketCategory;
  }
  throw new AppError(
    'VALIDATION_ERROR',
    `Kategori tiket tidak valid (pilih: ${CATEGORY_VALUES.join(', ')}).`,
    400,
  );
}

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
      const body = ((req.body?.body ?? req.body?.message) as string | undefined)?.trim();
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
      const title = ((req.body?.title ?? req.body?.subject) as string | undefined)?.trim();
      const description = ((req.body?.description ?? req.body?.message) as string | undefined)?.trim();
      const customerId = req.body?.customerId as string | undefined;
      const actor = req.user!;

      if (!title) {
        throw new AppError('VALIDATION_ERROR', 'Judul tiket wajib diisi.', 400);
      }
      if (!description) {
        throw new AppError('VALIDATION_ERROR', 'Deskripsi tiket wajib diisi.', 400);
      }

      const category = parseTicketCategory(req.body?.category as string | undefined);
      const ticketNumber = await ticketModel.nextTicketNumber(new Date());

      const created = await ticketModel.create({
        ticketNumber,
        title,
        description,
        category,
        // Tanpa customerId, tiket dicatat atas nama staf yang membuatnya.
        customer: { connect: { id: customerId ?? actor.userId } },
      });

      sendSuccess(res, created, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/tickets
   * Mengambil daftar tiket milik pelanggan yang sedang terautentikasi.
   */
  async listCustomerTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user!;
      const rawStatus = (req.query.status as string | undefined)?.toUpperCase();

      if (rawStatus && !STATUS_VALUES.includes(rawStatus as TicketStatus)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Status tiket tidak valid (pilih: ${STATUS_VALUES.join(', ')}).`,
          400,
        );
      }

      const tickets = await ticketModel.listForCustomer(actor.userId, {
        status: rawStatus as TicketStatus | undefined,
      });

      sendSuccess(res, tickets);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/tickets/:id
   * Mengambil detail tiket milik pelanggan.
   */
  async detailCustomerTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const actor = req.user!;
      const ticket = await ticketModel.findById(id);

      if (!ticket) {
        throw new AppError('TICKET_NOT_FOUND', `Tiket dengan ID '${id}' tidak ditemukan.`, 404);
      }

      if (ticket.customerId !== actor.userId && actor.role === UserRole.CUSTOMER) {
        throw new AppError('FORBIDDEN', 'Anda tidak memiliki hak akses untuk tiket ini.', 403);
      }

      sendSuccess(res, ticket);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/tickets
   * Membuat tiket bantuan baru dari sisi pelanggan.
   */
  async createCustomerTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const title = ((req.body?.title ?? req.body?.subject) as string | undefined)?.trim();
      const description = ((req.body?.description ?? req.body?.message) as string | undefined)?.trim();
      const actor = req.user!;

      if (!title) {
        throw new AppError('VALIDATION_ERROR', 'Judul tiket wajib diisi.', 400);
      }
      if (!description) {
        throw new AppError('VALIDATION_ERROR', 'Deskripsi tiket wajib diisi.', 400);
      }

      const category = parseTicketCategory(req.body?.category as string | undefined);
      const ticketNumber = await ticketModel.nextTicketNumber(new Date());

      const created = await ticketModel.create({
        ticketNumber,
        title,
        description,
        category,
        customer: { connect: { id: actor.userId } },
        messages: {
          create: {
            sender: { connect: { id: actor.userId } },
            body: description,
            isCustomer: true,
          },
        },
      });

      sendSuccess(res, created, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/tickets/:id/messages
   * Mengirim pesan balasan pelanggan pada thread tiket.
   */
  async addCustomerMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const body = ((req.body?.body ?? req.body?.message) as string | undefined)?.trim();
      const actor = req.user!;

      if (!body) {
        throw new AppError('VALIDATION_ERROR', 'Isi pesan wajib diisi.', 400);
      }

      const existing = await ticketModel.findById(id);
      if (!existing) {
        throw new AppError('TICKET_NOT_FOUND', `Tiket dengan ID '${id}' tidak ditemukan.`, 404);
      }

      if (existing.customerId !== actor.userId && actor.role === UserRole.CUSTOMER) {
        throw new AppError('FORBIDDEN', 'Anda tidak memiliki hak akses untuk tiket ini.', 403);
      }

      const message = await ticketModel.createMessage({
        ticket: { connect: { id } },
        sender: { connect: { id: actor.userId } },
        body,
        isCustomer: true,
      });

      // Kembalikan tiket ke proses tim jika sebelumnya menunggu pelanggan atau selesai
      if (
        existing.status === TicketStatus.WAITING_CUSTOMER ||
        existing.status === TicketStatus.RESOLVED
      ) {
        await ticketModel.updateStatus(id, TicketStatus.IN_PROGRESS);
      }

      sendSuccess(res, message, 201);
    } catch (error) {
      next(error);
    }
  },
};
