import { Router } from 'express';
import { ticketController } from '../../controller/ticketController.js';
import { streamTicketEvents } from '../../controller/ticketEventController.js';
import { requireAuth } from '../../middleware/auth.js';
import { ticketMessageRateLimiter } from '../../middleware/rateLimiter.js';

/**
 * Tiket bantuan pelanggan: /api/v1/tickets/*
 */
export const ticketRouter: Router = Router();

// Seluruh endpoint tiket pelanggan mewajibkan autentikasi Bearer token
ticketRouter.use(requireAuth);

ticketRouter.get('/', ticketController.listCustomerTickets);
ticketRouter.post('/', ticketController.createCustomerTicket);

/* Sesi percakapan AI: satu tiket per sesi, bukan per pesan. Didaftarkan sebelum
   rute berparameter supaya "/ai-session" tidak tertangkap sebagai ":id". */
ticketRouter.post('/ai-session', ticketController.createAiSession);

ticketRouter.get('/:id', ticketController.detailCustomerTicket);
ticketRouter.post('/:id/messages', ticketMessageRateLimiter, ticketController.addCustomerMessage);

/* Dipanggil saat asisten AI menyerahkan tiket ke admin. */
ticketRouter.post('/:id/handover', ticketController.handover);

/* Penutupan tiket bantuan oleh pelanggan atau staf */
ticketRouter.patch('/:id/close', ticketController.closeCustomerTicket);
ticketRouter.post('/:id/close', ticketController.closeCustomerTicket);

/* Saluran peristiwa tiket. Dipakai setelah handover, saat balasan admin perlu
   sampai ke layar pelanggan tanpa menanyakan ulang. */
ticketRouter.get('/:id/events', streamTicketEvents);
