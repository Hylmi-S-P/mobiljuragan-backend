import type { NextFunction, Request, Response } from 'express';
import {
  BookingStatus,
  OperationalStatus,
  PaymentStatus,
  RefundStatus,
  RentalType,
  TicketStatus,
  UserRole,
} from '../generated/prisma/client.js';
import { db } from '../db.js';
import { sendSuccess } from '../lib/response.js';

/**
 * Menghasilkan jumlah lencana navigasi admin secara langsung lewat kueri `COUNT(*)`
 * paralel agar dashboard tidak perlu menarik daftar booking, tiket, pembayaran, dan
 * armada penuh hanya untuk menghitung angka sidebar.
 */
export const adminNavCountsController = {
  async getCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user!;
      const ticketAdminWhere =
        actor.role === UserRole.ADMIN
          ? {
              OR: [{ assignedAdminId: null }, { assignedAdminId: actor.userId }],
            }
          : {};

      const [
        permintaanBaru,
        tindakLanjutPesanan,
        pendingBayar,
        unitPemeriksaan,
        tiketBaru,
        tiketDibalas,
        antreanRefund,
      ] = await Promise.all([
        db.booking.count({
          where: { status: BookingStatus.CREATED },
        }),
        db.booking.count({
          where: {
            OR: [
              { status: BookingStatus.PENDING_CONFIRMATION },
              {
                status: BookingStatus.CONFIRMED,
                payment: { is: { status: PaymentStatus.PAID } },
              },
              {
                status: BookingStatus.CONFIRMED,
                rentalType: RentalType.WITH_DRIVER,
                driverId: null,
              },
            ],
          },
        }),
        db.payment.count({
          where: { status: PaymentStatus.PENDING_VERIFICATION },
        }),
        db.vehicle.count({
          where: { operationalStatus: OperationalStatus.IN_SERVICE },
        }),
        db.supportTicket.count({
          where: {
            status: TicketStatus.OPEN,
            ...ticketAdminWhere,
          },
        }),
        db.supportTicket.count({
          where: {
            status: TicketStatus.WAITING_CUSTOMER,
            ...ticketAdminWhere,
          },
        }),
        db.bookingRefund.count({
          where: {
            status: { in: [RefundStatus.MENUNGGU, RefundStatus.DIPROSES] },
          },
        }),
      ]);

      const counts: Record<string, number> = {};
      const details: Record<string, { baru: number; dibalas: number }> = {};

      const tindakLanjutTotal = tindakLanjutPesanan + pendingBayar;
      const totalPemesanan = permintaanBaru + tindakLanjutTotal;
      if (totalPemesanan > 0) {
        counts['/bookings'] = totalPemesanan;
        details['/bookings'] = {
          baru: permintaanBaru,
          dibalas: tindakLanjutTotal,
        };
      }

      if (unitPemeriksaan > 0) {
        counts['/fleet/catalog'] = unitPemeriksaan;
      }

      const totalTiket = tiketBaru + tiketDibalas;
      if (totalTiket > 0) {
        counts['/customer-care'] = totalTiket;
        details['/customer-care'] = {
          baru: tiketBaru,
          dibalas: tiketDibalas,
        };
      }

      if (antreanRefund > 0) {
        counts['/refunds'] = antreanRefund;
      }

      sendSuccess(res, { counts, details });
    } catch (error) {
      next(error);
    }
  },
};
