import type { NextFunction, Request, Response } from 'express';
import { db } from '../db.js';
import { RefundStatus, type Prisma } from '../generated/prisma/client.js';
import { refundModel } from '../model/refundModel.js';
import { AppError, sendSuccess } from '../lib/response.js';
import { hitungNominalRefund, type PembatalOleh } from '../lib/refund.js';
import { listRefundQuerySchema, updateRefundSchema } from '../validators/refundSchemas.js';

/**
 * Antrean pengembalian dana untuk pesanan yang dibatalkan setelah dibayar.
 *
 * Catatan refund dibuat otomatis saat pesanan batal/ditolak, sehingga daftar ini
 * adalah to-do kantor: transfer balik uangnya lalu tutup barisnya dengan bukti.
 */
export const adminRefundController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listRefundQuerySchema.parse(req.query);
      const where: Prisma.BookingRefundWhereInput = {};

      if (query.status) where.status = query.status;
      if (query.search) {
        const cari = query.search.trim();
        where.OR = [
          { booking: { bookingCode: { contains: cari } } },
          { booking: { customer: { fullName: { contains: cari } } } },
          { booking: { customer: { phoneNumber: { contains: cari } } } },
          { namaPemilik: { contains: cari } },
          { nomorRekening: { contains: cari } },
        ];
      }

      const [items, total] = await Promise.all([
        refundModel.list(where, (query.page - 1) * query.limit, query.limit),
        refundModel.count(where),
      ]);

      sendSuccess(res, {
        items,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /** Ringkasan untuk badge dashboard: berapa baris menunggu dan total nominalnya. */
  async summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const grup = await refundModel.ringkasanAntrean();
      const hasil = grup.map((baris) => ({
        status: baris.status,
        jumlah: baris._count._all,
        totalNominal: Number(baris._sum.nominal ?? 0),
      }));

      sendSuccess(res, {
        menunggu: hasil.find((h) => h.status === RefundStatus.MENUNGGU) ?? {
          status: RefundStatus.MENUNGGU,
          jumlah: 0,
          totalNominal: 0,
        },
        diproses: hasil.find((h) => h.status === RefundStatus.DIPROSES) ?? {
          status: RefundStatus.DIPROSES,
          jumlah: 0,
          totalNominal: 0,
        },
        selesai: hasil.find((h) => h.status === RefundStatus.SELESAI) ?? {
          status: RefundStatus.SELESAI,
          jumlah: 0,
          totalNominal: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const body = updateRefundSchema.parse(req.body);

      const refund = await db.bookingRefund.findFirst({
        where: { OR: [{ id }, { booking: { bookingCode: id } }] },
      });

      if (!refund) {
        throw new AppError(
          'REFUND_NOT_FOUND',
          `Catatan pengembalian dana '${id}' tidak ditemukan.`,
          404,
        );
      }

      if (refund.status === RefundStatus.SELESAI && body.status !== RefundStatus.SELESAI) {
        throw new AppError(
          'REFUND_ALREADY_SETTLED',
          'Pengembalian dana ini sudah ditutup dan tidak dapat dibuka kembali.',
          409,
        );
      }

      const data: Prisma.BookingRefundUpdateInput = {};

      /* Konfirmasi dana: staf mencocokkan mutasi bank untuk pesanan yang ditutup
         saat bukti transfernya belum diperiksa. Dua kemungkinan, dua akibat:
         uangnya ada → aturan potongan normal berlaku; uangnya tidak ada → tidak
         ada yang perlu dikembalikan, barisnya ditutup dengan nominal nol. */
      if (body.konfirmasiDana !== undefined) {
        if (refund.danaTerverifikasi) {
          throw new AppError(
            'REFUND_FUNDS_ALREADY_CONFIRMED',
            'Dana pengembalian ini sudah pernah dikonfirmasi.',
            409,
          );
        }

        if (body.konfirmasiDana) {
          const hitungan = hitungNominalRefund(
            Number(refund.totalDibayar),
            refund.dibatalkanOleh as PembatalOleh,
          );
          data.danaTerverifikasi = true;
          data.potongan = hitungan.potongan;
          data.nominal = hitungan.nominal;
        } else {
          data.potongan = 0;
          data.nominal = 0;
          data.status = RefundStatus.SELESAI;
          data.diselesaikanPada = new Date();
          data.alasan = refund.alasan
            ? `${refund.alasan} | Dana tidak ditemukan di mutasi bank.`
            : 'Dana tidak ditemukan di mutasi bank.';
        }
      }

      if (body.nominal !== undefined) {
        /* Nominal tidak boleh melebihi uang yang benar-benar masuk: mengembalikan
           lebih banyak daripada yang dibayar berarti kantor kehilangan uang tanpa
           catatan. */
        if (body.nominal > Number(refund.totalDibayar)) {
          throw new AppError(
            'REFUND_EXCEEDS_PAYMENT',
            `Nominal pengembalian (${body.nominal}) melebihi uang yang diterima (${Number(refund.totalDibayar)}).`,
            400,
          );
        }
        data.nominal = body.nominal;
        data.potongan = Number(refund.totalDibayar) - body.nominal;
      }

      if (body.namaBank !== undefined) data.namaBank = body.namaBank;
      if (body.nomorRekening !== undefined) data.nomorRekening = body.nomorRekening;
      if (body.namaPemilik !== undefined) data.namaPemilik = body.namaPemilik;
      if (body.buktiMediaId !== undefined) data.buktiMediaId = body.buktiMediaId;
      if (body.catatan !== undefined) {
        data.alasan = refund.alasan
          ? `${refund.alasan} | Catatan admin: ${body.catatan}`
          : body.catatan;
      }

      if (body.status !== undefined) {
        data.status = body.status;
        data.diselesaikanPada = body.status === RefundStatus.SELESAI ? new Date() : null;
      } else if (refund.status === RefundStatus.MENUNGGU && data.status === undefined) {
        /* Begitu admin mengisi data rekening, barisnya berarti sedang dikerjakan.
           Tidak menimpa status yang sudah ditentukan oleh konfirmasi dana. */
        data.status = RefundStatus.DIPROSES;
      }

      const updated = await refundModel.update(refund.id, data);

      await db.auditLog.create({
        data: {
          actorId: req.user?.userId ?? null,
          action: 'UPDATE_REFUND',
          entityType: 'BookingRefund',
          entityId: refund.id,
          metadata: {
            bookingCode: updated.booking.bookingCode,
            nominal: Number(updated.nominal),
            status: updated.status,
            catatan: body.catatan ?? null,
          },
        },
      });

      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  },
};
