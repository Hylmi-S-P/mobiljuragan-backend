import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { profilController } from '../../controller/profilController.js';
import { PANJANG_MINIMAL, BATAS_BYTE } from '../../lib/passwordPolicy.js';

/**
 * Profil pemilik sesi: `/api/v1/me/*`
 *
 * Satu-satunya jalur untuk mengubah identitas pelanggan. Rute autentikasi
 * (`/auth/*`) sengaja tidak menyentuh nama sama sekali.
 */
export const meRouter: Router = Router();

meRouter.use(requireAuth);

// Profil ringkas pemilik sesi.
meRouter.get('/', profilController.tampilkan);

/**
 * Mengubah nama.
 *
 * `expectedUpdatedAt` opsional tetapi dianjurkan: klien mengirim nilai
 * `updatedAt` yang terakhir dibacanya, dan server menolak bila datanya sudah
 * berubah (412). Ini mencegah dua tab/perangkat saling menimpa.
 */
meRouter.patch(
  '/',
  validateBody(
    z.object({
      fullName: z
        .string()
        .trim()
        .min(3, 'Nama lengkap minimal 3 karakter.')
        .max(100, 'Nama lengkap maksimal 100 karakter.'),
      expectedUpdatedAt: z.string().datetime().optional(),
    }),
  ),
  profilController.ubahNama,
);

/**
 * Membuat atau mengganti kata sandi.
 *
 * Akun lama tanpa kata sandi tidak perlu `currentPassword`. Akun yang sudah
 * punya wajib menyertakannya.
 */
meRouter.patch(
  '/password',
  validateBody(
    z.object({
      currentPassword: z.string().min(1).optional(),
      newPassword: z
        .string({ error: 'Kata sandi baru wajib diisi.' })
        .min(PANJANG_MINIMAL, `Kata sandi minimal ${PANJANG_MINIMAL} karakter.`)
        .refine((val) => Buffer.byteLength(val, 'utf8') <= BATAS_BYTE, {
          message: `Kata sandi maksimal ${BATAS_BYTE} byte.`,
        }),
    }),
  ),
  profilController.ubahKataSandi,
);

// Mengeluarkan semua perangkat (token lama tidak berlaku).
meRouter.post('/logout-all', profilController.keluarkanSemuaPerangkat);

// Jejak perubahan identitas milik sendiri.
meRouter.get('/identity-history', profilController.riwayat);
