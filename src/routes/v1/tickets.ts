import { Router } from 'express';
import { ticketController } from '../../controller/ticketController.js';
import { requireAuth } from '../../middleware/auth.js';

/**
 * Tiket bantuan pelanggan: /api/v1/tickets/*
 */
export const ticketRouter: Router = Router();

// Seluruh endpoint tiket pelanggan mewajibkan autentikasi Bearer token
ticketRouter.use(requireAuth);

ticketRouter.get('/', ticketController.listCustomerTickets);
ticketRouter.post('/', ticketController.createCustomerTicket);
ticketRouter.get('/:id', ticketController.detailCustomerTicket);
ticketRouter.post('/:id/messages', ticketController.addCustomerMessage);
