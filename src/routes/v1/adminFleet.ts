import { Router } from 'express';
import { z } from 'zod';
import { adminFleetController } from '../../controller/adminFleetController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Kalender jadwal armada: /api/v1/admin/fleet/*
 */
export const adminFleetRouter: Router = Router();

// Endpoint khusus role ADMIN dan SUPER_ADMIN
adminFleetRouter.use(requireAuth);
adminFleetRouter.use(requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN));

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
    },
  );

adminFleetRouter.get(
  '/calendar',
  validateQuery(fleetCalendarQuerySchema),
  adminFleetController.calendar,
);

const tariffSettingsSchema = z.object({
  driverDailyRate: z
    .number({ error: 'Tarif jasa supir wajib berupa angka.' })
    .int('Tarif jasa supir harus bilangan bulat.')
    .positive('Tarif jasa supir harus lebih besar dari nol.')
    .max(10_000_000, 'Tarif jasa supir terlalu besar.'),
});

/* Unit yang sedang disewa saat ini. Dipakai katalog untuk badge "Disewa".
   Tidak menerima parameter: yang ditanyakan selalu "sekarang". */
adminFleetRouter.get('/rented', adminFleetController.rented);

/* Tarif jasa supir global. Dibaca admin untuk perkiraan tarif, diubah hanya oleh
   SUPER_ADMIN karena angkanya berlaku untuk semua pesanan baru. */
adminFleetRouter.get('/tariff-settings', adminFleetController.getTariffSettings);

adminFleetRouter.patch(
  '/tariff-settings',
  requireRole(UserRole.SUPER_ADMIN),
  validateBody(tariffSettingsSchema),
  adminFleetController.updateTariffSettings,
);
