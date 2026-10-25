import { Router } from 'express';
import { z } from 'zod';
import { adminVehicleController } from '../../controller/adminVehicleController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { OperationalStatus, UserRole } from '../../generated/prisma/client.js';

/**
 * Status operasional armada: /api/v1/admin/vehicles/*
 */
export const adminVehicleRouter: Router = Router();

// Endpoint khusus role STAFF dan ADMIN
adminVehicleRouter.use(requireAuth);
adminVehicleRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));


/**
 * Foto armada disimpan sebagai data URL di database, jadi server harus memeriksa
 * isinya sendiri. Batas 5 MB di form hanya menyaring di peramban; permintaan
 * langsung ke API tidak melewati pemeriksaan itu.
 *
 * Ukuran diperiksa dari panjang string base64, bukan dari hasil decode, supaya
 * tidak perlu mengalokasikan buffer sebesar isinya hanya untuk menolak berkas.
 */
const MAKS_FOTO_BYTES = 5 * 1024 * 1024;
/* Base64 membengkak 4/3, ditambah awalan "data:image/png;base64,". */
const MAKS_PANJANG_FOTO = Math.ceil((MAKS_FOTO_BYTES * 4) / 3) + 64;

const imageUrlSchema = z
  .string()
  .max(MAKS_PANJANG_FOTO, 'Ukuran foto maksimal 5 MB.')
  .refine(
    (v) => v === '' || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v),
    'Foto harus berupa gambar PNG atau JPG.',
  )
  .optional();

const createVehicleSchema = z.object({
  name: z.string().min(1, 'Nama armada wajib diisi.'),
  licensePlate: z.string().min(1, 'Plat nomor wajib diisi.'),
  category: z.string().optional(),
  transmission: z.string().optional(),
  seatingCapacity: z.number().int().positive().optional(),
  pricePerDay: z.number().int().positive('Tarif sewa per hari harus bernilai positif.'),
  brand: z.string().optional(),
  model: z.string().optional(),
  imageUrl: imageUrlSchema,
  operationalStatus: z.nativeEnum(OperationalStatus).optional(),
});

const updateVehicleSchema = z.object({
  name: z.string().min(1).optional(),
  licensePlate: z.string().min(1).optional(),
  category: z.string().optional(),
  transmission: z.string().optional(),
  seatingCapacity: z.number().int().positive().optional(),
  pricePerDay: z.number().int().positive('Tarif sewa per hari harus bernilai positif.').optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  imageUrl: imageUrlSchema,
  operationalStatus: z.nativeEnum(OperationalStatus).optional(),
});

const updateVehicleStatusSchema = z.object({
  status: z.nativeEnum(OperationalStatus, {
    error:
      'Status operasional tidak valid (pilih: AVAILABLE, BOOKED, MAINTENANCE, UNAVAILABLE).',
  }),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

// Menambah unit armada baru
adminVehicleRouter.post(
  '/',
  validateBody(createVehicleSchema),
  adminVehicleController.create,
);

// Memperbarui data/tarif sewa armada
adminVehicleRouter.patch(
  '/:id',
  validateBody(updateVehicleSchema),
  adminVehicleController.update,
);
adminVehicleRouter.put(
  '/:id',
  validateBody(updateVehicleSchema),
  adminVehicleController.update,
);

// Menghapus armada (jika tidak ada pesanan aktif)
adminVehicleRouter.delete(
  '/:id',
  adminVehicleController.remove,
);

// Memperbarui status fisik/operasional armada mobil dan mencatat ke audit log staf.
adminVehicleRouter.patch(
  '/:id/status',
  validateBody(updateVehicleStatusSchema),
  adminVehicleController.updateStatus,
);
