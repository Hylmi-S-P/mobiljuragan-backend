import { Router } from 'express';
import { z } from 'zod';
import { adminFleetController } from '../../controller/adminFleetController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateQuery } from '../../middleware/validate.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Admin Fleet Calendar: /api/v1/admin/fleet/*
 */
export const adminFleetRouter: Router = Router();

// Endpoint khusus role STAFF dan ADMIN
adminFleetRouter.use(requireAuth);
adminFleetRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

const fleetCalendarQuerySchema = z
  .object({
    startDate: z.string().datetime({ message: 'startDate harus berformat ISO 8601.' }).optional(),
    endDate: z.string().datetime({ message: 'endDate harus berformat ISO 8601.' }).optional(),
    category: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'endDate harus lebih besar dari startDate.',
      path: ['endDate'],
    }
  );

adminFleetRouter.get('/calendar', validateQuery(fleetCalendarQuerySchema), adminFleetController.calendar);