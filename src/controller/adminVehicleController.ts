import { vehicleModel } from '../model/vehicleModel.js';
import type { NextFunction, Request, Response } from 'express';
import type { OperationalStatus } from '../generated/prisma/client.js';
import { AppError, sendSuccess } from '../lib/response.js';
import { simpanMedia, tautanMedia } from '../lib/mediaService.js';

/**
 * Controller manajemen armada untuk portal staf/admin.
 *
 * Menangani pembaruan status fisik armada beserta audit lognya.
 * Semua kegagalan diteruskan lewat `next(error)` supaya ditangani satu kali
 * oleh errorHandler global.
 */

export const adminVehicleController = {
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status: nextStatus, note } = req.body;
      const staffUser = req.user!;

      const vehicle = await vehicleModel.findByIdOrExternalId(id);

      if (!vehicle) {
        throw new AppError(
          'VEHICLE_NOT_FOUND',
          `Armada dengan pengenal '${id}' tidak ditemukan.`,
          404,
        );
      }

      const updatedVehicle = await vehicleModel.updateOperationalStatus(
        vehicle,
        nextStatus as OperationalStatus,
        staffUser.userId,
        note,
      );

      sendSuccess(res, updatedVehicle);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffUser = req.user!;
      const created = await vehicleModel.createVehicle(req.body, staffUser.userId);
      sendSuccess(res, created, 201);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const staffUser = req.user!;
      const updated = await vehicleModel.updateVehicle(id, req.body, staffUser.userId);
      sendSuccess(res, updated);
    } catch (error: any) {
      if (error?.message === 'VEHICLE_NOT_FOUND') {
        throw new AppError(
          'VEHICLE_NOT_FOUND',
          `Armada dengan pengenal '${req.params.id}' tidak ditemukan.`,
          404,
        );
      }
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const staffUser = req.user!;
      const deleted = await vehicleModel.deleteVehicle(id, staffUser.userId);
      sendSuccess(res, { deleted: true, id: deleted.id });
    } catch (error: any) {
      if (error?.message === 'VEHICLE_NOT_FOUND') {
        throw new AppError(
          'VEHICLE_NOT_FOUND',
          `Armada dengan pengenal '${req.params.id}' tidak ditemukan.`,
          404,
        );
      }
      if (error?.message === 'VEHICLE_HAS_ACTIVE_BOOKINGS') {
        throw new AppError(
          'VEHICLE_HAS_ACTIVE_BOOKINGS',
          'Tidak dapat menghapus armada yang sedang memiliki pesanan sewa aktif.',
          400,
        );
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/admin/vehicles/:id/photo
   *
   * Menerima foto armada lewat multipart, menormalkannya dengan sharp, menyimpan
   * ke penyimpanan media, lalu menautkannya ke `imageUrl`.
   *
   * Jalur ini menggantikan pengiriman Base64 lewat JSON. Selain lebih hemat,
   * foto asli dari kamera HP tidak lagi perlu diperkecil di peramban lebih dulu.
   */
  async unggahFoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const staffUser = req.user!;

      const file = req.file;
      if (!file) {
        throw new AppError('FILE_REQUIRED', 'Berkas foto wajib disertakan pada field "file".', 400);
      }

      const kendaraan = await vehicleModel.findByIdOrExternalId(id);
      if (!kendaraan) {
        throw new AppError(
          'VEHICLE_NOT_FOUND',
          `Armada dengan pengenal '${id}' tidak ditemukan.`,
          404,
        );
      }

      const media = await simpanMedia({
        file,
        kategori: 'FLEET_PHOTO',
        ownerUserId: staffUser.userId,
      });

      const url = tautanMedia(media.id, media.kategori);
      const updated = await vehicleModel.updateVehicle(
        kendaraan.id,
        { imageUrl: url },
        staffUser.userId,
      );

      sendSuccess(res, {
        vehicle: updated,
        media: {
          id: media.id,
          url,
          width: media.width,
          height: media.height,
          byteSize: media.byteSize,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
