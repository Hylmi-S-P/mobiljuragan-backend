import { Router } from 'express';
import { ticketController } from '../../controller/ticketController.js';
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

/* Percakapan bantuan untuk satu pesanan. Didaftarkan sebelum "/:id" karena
   "booking" akan tertangkap sebagai id tiket kalau urutannya dibalik. */
ticketRouter.post('/booking/:bookingId', ticketController.createBookingTicket);

ticketRouter.get('/:id', ticketController.detailCustomerTicket);
ticketRouter.post('/:id/messages', ticketMessageRateLimiter, ticketController.addCustomerMessage);

/* Dipanggil saat asisten AI menyerahkan tiket ke admin. */
ticketRouter.post('/:id/handover', ticketController.handover);

/* Penutupan tiket bantuan oleh pelanggan atau staf */
ticketRouter.patch('/:id/close', ticketController.closeCustomerTicket);
ticketRouter.post('/:id/close', ticketController.closeCustomerTicket);

/* Peristiwa tiket tidak lagi lewat HTTP. Klien berlangganan ke
   `/api/v1/ws/tickets` (WebSocket) yang dipasang di `src/ws/ticketSocket.ts`. */
