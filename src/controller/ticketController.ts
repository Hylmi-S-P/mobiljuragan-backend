import type { NextFunction, Request, Response } from 'express';
import { TicketCategory, TicketHandler, TicketStatus, UserRole } from '../generated/prisma/client.js';
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

/* Batas panjang satu pesan tiket. Dipakai bersama oleh balasan admin dan pesan
   pelanggan, dan ditegakkan di server supaya tidak bisa dilewati lewat API. */
const MAKS_PANJANG_PESAN = 2000;

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

      /* Tiket yang sudah ditutup tidak boleh dibuka lagi.
       *
       * Penutupan berarti percakapan selesai: pelanggan sudah dapat jawaban, atau
       * tiket ditutup otomatis karena tidak ada balasan. Membukanya kembali akan
       * membuat antrean berisi tiket yang sebenarnya sudah beres, dan menghapus
       * arti penutupan itu sendiri.
       *
       * Pelanggan yang masih butuh bantuan setelah tiket ditutup bisa membuat
       * tiket baru — riwayatnya tetap tersimpan dan tetap bisa dibaca admin.
       *
       * RESOLVED masih boleh dibuka kembali. Status itu berarti "dijawab, menunggu
       * konfirmasi pelanggan", bukan "selesai", jadi pelanggan yang baru membalas
       * memang perlu menghidupkan percakapannya lagi. */
      if (existing.status === TicketStatus.CLOSED) {
        throw new AppError(
          'TICKET_CLOSED',
          'Tiket ini sudah ditutup dan tidak bisa dibuka kembali. Buat tiket baru kalau masih perlu bantuan.',
          409,
        );
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

      if (body.length > MAKS_PANJANG_PESAN) {
        throw new AppError(
          'MESSAGE_TOO_LONG',
          `Pesan maksimal ${MAKS_PANJANG_PESAN} karakter. Pesan Anda ${body.length} karakter.`,
          400,
        );
      }

      const existing = await ticketModel.findById(id);
      if (!existing) {
        throw new AppError('TICKET_NOT_FOUND', `Tiket dengan ID '${id}' tidak ditemukan.`, 404);
      }

      /* Selama tiket masih dipegang asisten AI, admin hanya boleh membaca.
         Pemeriksaan ini ada di backend, bukan hanya di tampilan, supaya tidak bisa
         dilewati dengan memanggil API langsung. Penyerahan ke admin terjadi saat
         asisten AI memberi flag handover, dan itu mengubah handledBy menjadi HUMAN
         sekaligus mengisi handoverAt. */
      if (existing.handledBy === TicketHandler.AI) {
        throw new AppError(
          'TICKET_STILL_WITH_AI',
          'Tiket ini masih ditangani asisten AI. Admin baru bisa membalas setelah AI menyerahkannya.',
          409,
        );
      }

      /* Tiket yang sudah ditutup tidak menerima pesan baru.
       *
       * Kalau dibiarkan, pesan akan masuk ke tiket yang tidak lagi dipantau
       * siapa pun: pelanggan mengira sudah mengirim, admin tidak pernah melihat,
       * dan tiketnya tidak muncul di daftar aktif. Lebih baik ditolak terang-
       * terangan supaya pelanggan membuat tiket baru. */
      if (existing.status === TicketStatus.CLOSED) {
        throw new AppError(
          'TICKET_CLOSED',
          'Tiket ini sudah ditutup dan tidak menerima pesan baru. Buat tiket baru untuk melanjutkan.',
          409,
        );
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
   * POST /api/v1/tickets/ai-session
   *
   * Membuat tiket dari percakapan dengan asisten AI, atau mengembalikan tiket sesi
   * yang masih berjalan.
   *
   * Satu tiket mewakili satu sesi percakapan, bukan satu pesan. Pelanggan yang
   * bertanya dua puluh kali tetap memakai tiket yang sama sampai sesi itu ditutup.
   * Tanpa aturan ini daftar Customer Care akan penuh tiket sebaris pertanyaan.
   *
   * Tiket baru selalu mulai dipegang AI (`handledBy = AI`), sehingga admin hanya
   * bisa membaca sampai asisten menyerahkannya.
   */
  async createAiSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user!;
      const judulAwal =
        ((req.body?.title as string | undefined)?.trim() || 'Percakapan dengan asisten AI').slice(
          0,
          120,
        );

      // Sesi yang masih berjalan dipakai ulang, supaya tidak menumpuk tiket baru
      // setiap kali pelanggan mengirim satu pertanyaan.
      const sesiBerjalan = await ticketModel.findOpenAiSession(actor.userId);
      if (sesiBerjalan) {
        sendSuccess(res, { ...sesiBerjalan, dipakaiUlang: true }, 200);
        return;
      }

      const ticketNumber = await ticketModel.nextTicketNumber(new Date());
      const category = parseTicketCategory(req.body?.category as string | undefined);

      const created = await ticketModel.create({
        ticketNumber,
        title: judulAwal,
        description: 'Percakapan pelanggan dengan asisten AI MobilJuragan.',
        category,
        customer: { connect: { id: actor.userId } },
        handledBy: TicketHandler.AI,
      });

      sendSuccess(res, { ...created, dipakaiUlang: false }, 201);
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

      if (body.length > MAKS_PANJANG_PESAN) {
        throw new AppError(
          'MESSAGE_TOO_LONG',
          `Pesan maksimal ${MAKS_PANJANG_PESAN} karakter. Pesan Anda ${body.length} karakter.`,
          400,
        );
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

  /**
   * Menyerahkan tiket dari asisten AI ke admin.
   *
   * Dipanggil ketika asisten memutuskan pertanyaan pelanggan butuh manusia. Setelah
   * ini admin boleh membalas. Pemanggilan berulang tidak mengubah waktu penyerahan
   * yang sudah tercatat.
   */
  async handover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const actor = req.user!;

      const existing = await ticketModel.findById(id);
      if (!existing) {
        throw new AppError('TICKET_NOT_FOUND', `Tiket dengan ID '${id}' tidak ditemukan.`, 404);
      }

      // Hanya pemilik tiket yang boleh menyerahkan tiketnya sendiri.
      if (existing.customerId !== actor.userId && actor.role === UserRole.CUSTOMER) {
        throw new AppError('FORBIDDEN', 'Anda tidak memiliki hak akses untuk tiket ini.', 403);
      }

      const berubah = await ticketModel.handoverToHuman(id, new Date());

      /* Pesan transisi ditulis hanya saat penyerahan benar-benar terjadi.
         Fungsinya bukan hiasan: admin yang membuka tiket perlu tahu bahwa
         percakapan sebelumnya dijawab mesin, bukan staf. Tanpa penanda ini,
         riwayat terbaca seolah staf yang menjawab dari awal. */
      if (berubah) {
        await ticketModel.createMessage({
          ticket: { connect: { id } },
          body:
            'Percakapan dialihkan dari asisten AI ke staf admin. Pesan sebelumnya dijawab otomatis oleh asisten AI.',
          isCustomer: false,
          isAi: false,
        });
      }

      sendSuccess(res, {
        ticketId: id,
        handledBy: TicketHandler.HUMAN,
        baruDiserahkan: berubah,
        handoverAt: existing.handoverAt ?? new Date(),
      });
    } catch (error) {
      next(error);
    }
  },
};
