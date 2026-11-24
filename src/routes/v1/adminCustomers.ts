import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { adminCustomerController } from '../../controller/adminCustomerController.js';
import { UserRole } from '../../generated/prisma/client.js';

/**
 * Akun pelanggan & jejak identitas: `/api/v1/admin/customers/*` dan
 * `/api/v1/admin/identity-audit`
 *
 * Hanya terbuka untuk SUPER_ADMIN: data akun pelanggan, jejak identitas, dan
 * penghapusan akun merupakan kewenangan pengelola penuh.
 */
export const adminCustomerRouter: Router = Router();

adminCustomerRouter.use(requireAuth);
adminCustomerRouter.use(requireRole(UserRole.SUPER_ADMIN));

adminCustomerRouter.get('/', adminCustomerController.daftar);
adminCustomerRouter.get('/:id', adminCustomerController.detail);
adminCustomerRouter.delete('/:id', adminCustomerController.hapus);

/**
 * Koreksi nama.
 *
 * Hanya SUPER_ADMIN. Nama pelanggan adalah data identitas yang juga dipakai pada
 * dokumen sewa; mengubahnya butuh alasan tertulis.
 *
 * Alasan wajib minimal 10 karakter, sebagai keterangan mengapa identitas seseorang
 * diubah oleh pengelola.
 */
adminCustomerRouter.patch(
  '/:id/name',
  requireRole(UserRole.SUPER_ADMIN),
  validateBody(
    z.object({
      fullName: z
        .string()
        .trim()
        .min(3, 'Nama lengkap minimal 3 karakter.')
        .max(60, 'Nama lengkap maksimal 60 karakter.'),
      reason: z
        .string()
        .trim()
        .min(10, 'Alasan koreksi minimal 10 karakter.')
        .max(300, 'Alasan koreksi maksimal 300 karakter.'),
    }),
  ),
  adminCustomerController.koreksiNama,
);

adminCustomerRouter.post(
  '/:id/unlock',
  validateBody(
    z.object({
      reason: z.string().trim().max(300).optional(),
    }),
  ),
  adminCustomerController.bukaKunci,
);

adminCustomerRouter.post(
  '/:id/revoke-sessions',
  validateBody(
    z.object({
      reason: z.string().trim().max(300).optional(),
    }),
  ),
  adminCustomerController.cabutSesi,
);

adminCustomerRouter.patch(
  '/:id/active',
  validateBody(
    z.object({
      isActive: z.boolean({ error: 'isActive harus bernilai true atau false.' }),
      reason: z.string().trim().max(300).optional(),
    }),
  ),
  adminCustomerController.ubahAktif,
);

/** Jejak identitas lintas akun untuk halaman audit (khusus SUPER_ADMIN). */
export const adminIdentityAuditRouter: Router = Router();

adminIdentityAuditRouter.use(requireAuth);
adminIdentityAuditRouter.use(requireRole(UserRole.SUPER_ADMIN));
adminIdentityAuditRouter.get('/', adminCustomerController.audit);
