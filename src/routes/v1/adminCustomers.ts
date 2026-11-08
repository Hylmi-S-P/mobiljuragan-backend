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
 * Terbuka untuk ADMIN dan STAFF: staf operasional perlu membuka akun yang
 * terkunci dan menelusuri identitas saat pelanggan menelepon. Yang **tidak**
 * diberikan kepada staf adalah mengganti nomor telepon atau kata sandi
 * pelanggan — keduanya tetap butuh kepemilikan nomor (OTP) atau tindakan
 * pemilik akun sendiri.
 */
export const adminCustomerRouter: Router = Router();

adminCustomerRouter.use(requireAuth);
adminCustomerRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

adminCustomerRouter.get('/', adminCustomerController.daftar);
adminCustomerRouter.get('/:id', adminCustomerController.detail);

/**
 * Koreksi nama.
 *
 * Alasan wajib minimal 10 karakter — bukan formalitas, melainkan satu-satunya
 * keterangan mengapa identitas seseorang diubah oleh orang lain.
 */
adminCustomerRouter.patch(
  '/:id/name',
  validateBody(
    z.object({
      fullName: z
        .string()
        .trim()
        .min(3, 'Nama lengkap minimal 3 karakter.')
        .max(100, 'Nama lengkap maksimal 100 karakter.'),
      reason: z
        .string()
        .trim()
        .min(10, 'Alasan koreksi minimal 10 karakter.'),
    }),
  ),
  adminCustomerController.koreksiNama,
);

adminCustomerRouter.post(
  '/:id/unlock',
  validateBody(
    z.object({
      reason: z.string().trim().max(500).optional(),
    }),
  ),
  adminCustomerController.bukaKunci,
);

adminCustomerRouter.post(
  '/:id/revoke-sessions',
  validateBody(
    z.object({
      reason: z.string().trim().max(500).optional(),
    }),
  ),
  adminCustomerController.cabutSesi,
);

adminCustomerRouter.patch(
  '/:id/active',
  validateBody(
    z.object({
      isActive: z.boolean({ error: 'isActive harus bernilai true atau false.' }),
      reason: z.string().trim().max(500).optional(),
    }),
  ),
  adminCustomerController.ubahAktif,
);

/** Jejak identitas lintas akun untuk halaman audit. */
export const adminIdentityAuditRouter: Router = Router();

adminIdentityAuditRouter.use(requireAuth);
adminIdentityAuditRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));
adminIdentityAuditRouter.get('/', adminCustomerController.audit);
