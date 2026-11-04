import { Router } from 'express';
import { z } from 'zod';
import { adminVehicleController } from '../../controller/adminVehicleController.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { unggahSatuGambar } from '../../lib/imagePipeline.js';
import { OperationalStatus, UserRole } from '../../generated/prisma/client.js';

/**
 * Status operasional armada: /api/v1/admin/vehicles/*
 */
export const adminVehicleRouter: Router = Router();

// Endpoint khusus role STAFF dan ADMIN
adminVehicleRouter.use(requireAuth);
adminVehicleRouter.use(requireRole(UserRole.ADMIN, UserRole.STAFF));

/**
 * Foto armada bisa dikirim dengan dua cara.
 *
 * Cara lama: data URL Base64 di dalam JSON. Masih diterima supaya dashboard
 * versi sekarang tidak langsung rusak.
 *
 * Cara baru: unggah multipart ke POST /admin/vehicles/:id/photo, yang
 * membalas dengan tautan `/api/v1/media/...`. Tautan itu juga boleh dikirim
 * ulang lewat sini, misalnya saat memindahkan foto antar unit.
 */
const POLA_FOTO_MEDIA = /^\/api\/v1\/media\/[0-9a-f-]{36}(\?exp=\d+&sig=[0-9a-f]{64})?$/;
const POLA_FOTO_BASE64 = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Batas 5 MB diukur dari panjang string Base64, bukan hasil decode, supaya
 * tidak perlu mengalokasikan buffer sebesar isinya hanya untuk menolak berkas.
 * Batas 5 MB di form hanya menyaring di peramban; permintaan langsung ke API
 * tidak melewati pemeriksaan itu.
 */
const MAKS_FOTO_BYTES = 5 * 1024 * 1024;
/* Base64 membengkak 4/3, ditambah awalan "data:image/png;base64,". */
const MAKS_PANJANG_FOTO = Math.ceil((MAKS_FOTO_BYTES * 4) / 3) + 64;

const imageUrlSchema = z
  .string()
  .max(MAKS_PANJANG_FOTO, 'Ukuran foto maksimal 5 MB.')
  .refine(
    (v) => v === '' || POLA_FOTO_MEDIA.test(v) || POLA_FOTO_BASE64.test(v),
    'Foto harus berupa gambar PNG, JPG, WebP, atau tautan media hasil unggahan.',
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
    error: 'Status operasional tidak valid (pilih: AVAILABLE, BOOKED, MAINTENANCE, UNAVAILABLE).',
  }),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
});

// Menambah unit armada baru
adminVehicleRouter.post('/', validateBody(createVehicleSchema), adminVehicleController.create);

// Memperbarui data/tarif sewa armada
adminVehicleRouter.patch('/:id', validateBody(updateVehicleSchema), adminVehicleController.update);
adminVehicleRouter.put('/:id', validateBody(updateVehicleSchema), adminVehicleController.update);

// Menghapus armada (jika tidak ada pesanan aktif)
adminVehicleRouter.delete('/:id', adminVehicleController.remove);

// Memperbarui status fisik/operasional armada mobil dan mencatat ke audit log staf.
adminVehicleRouter.patch(
  '/:id/status',
  validateBody(updateVehicleStatusSchema),
  adminVehicleController.updateStatus,
);

// Menutup masa in-service setelah pemeriksaan/pembersihan armada selesai.
adminVehicleRouter.post(
  '/:id/service/complete',
  validateBody(
    z.object({
      note: z.string().max(500, 'Catatan maksimal 500 karakter.').optional(),
    }),
  ),
  adminVehicleController.completeService,
);

/*
 * Unggah foto armada lewat multipart. Berkas dinormalkan sharp sebelum disimpan,
 * sehingga foto dari kamera HP tidak perlu diperkecil di peramban lebih dulu.
 */
adminVehicleRouter.post('/:id/photo', unggahSatuGambar('file'), adminVehicleController.unggahFoto);
