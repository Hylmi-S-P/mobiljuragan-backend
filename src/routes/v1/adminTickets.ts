import { Router } from 'express';
import { ticketController } from '../../controller/ticketController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Customer Care: /api/v1/admin/tickets/*
 */
export const adminTicketRouter: Router = Router();

adminTicketRouter.use(requireAuth);
adminTicketRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminTicketRouter.get('/', ticketController.list);
adminTicketRouter.post('/', ticketController.create);
adminTicketRouter.get('/:id', ticketController.detail);
adminTicketRouter.patch('/:id/status', ticketController.updateStatus);
adminTicketRouter.post('/:id/messages', ticketController.addMessage);