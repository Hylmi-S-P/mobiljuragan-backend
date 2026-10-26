import { Router } from 'express';
import { ticketController } from '../../controller/ticketController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Tiket bantuan pelanggan: /api/v1/admin/tickets/*
 */
export const adminTicketRouter: Router = Router();

adminTicketRouter.use(requireAuth);
adminTicketRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminTicketRouter.get('/', ticketController.list);
adminTicketRouter.post('/', ticketController.create);
adminTicketRouter.get('/:id', ticketController.detail);
adminTicketRouter.patch('/:id/status', ticketController.updateStatus);
adminTicketRouter.post('/:id/messages', ticketController.addMessage);
adminTicketRouter.post('/:id/handover', ticketController.handover);

/* A15.1 — kepemilikan tiket. Tiga tindakan dipisah karena akibatnya berbeda:
   assign untuk tiket bebas, takeover untuk merebut (khusus ADMIN), release untuk
   melepas. Menggabungkannya dalam satu endpoint dengan parameter mode akan
   membuat aturan izinnya sulit dibaca dan mudah salah. */
adminTicketRouter.post('/:id/assign', ticketController.assign);
adminTicketRouter.post('/:id/takeover', ticketController.takeover);
adminTicketRouter.delete('/:id/assign', ticketController.release);
