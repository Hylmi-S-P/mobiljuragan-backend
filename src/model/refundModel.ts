import { db } from '../db.js';
import type { Prisma } from '../generated/prisma/client.js';

/**
 * Akses data pengembalian dana.
 *
 * Dipisahkan dari bookingModel karena daftar yang dibaca di dashboard bukan lagi
 * per pesanan, melainkan antrean kewajiban bayar: "uang siapa yang masih harus
 * ditransfer balik".
 */
export const refundModel = {
  list(where: Prisma.BookingRefundWhereInput, skip: number, take: number) {
    return db.bookingRefund.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dicatatPada: 'desc' }],
      skip,
      take,
      include: {
        booking: {
          select: {
            id: true,
            bookingCode: true,
            status: true,
            startDateTime: true,
            endDateTime: true,
            customer: { select: { id: true, fullName: true, phoneNumber: true } },
            vehicle: { select: { id: true, name: true, licensePlate: true } },
          },
        },
      },
    });
  },

  count(where: Prisma.BookingRefundWhereInput) {
    return db.bookingRefund.count({ where });
  },

  findByBookingCode(bookingCode: string) {
    return db.bookingRefund.findFirst({
      where: { booking: { bookingCode } },
      include: { booking: { select: { id: true, bookingCode: true } } },
    });
  },

  update(id: string, data: Prisma.BookingRefundUpdateInput) {
    return db.bookingRefund.update({
      where: { id },
      data,
      include: {
        booking: {
          select: {
            id: true,
            bookingCode: true,
            customer: { select: { id: true, fullName: true, phoneNumber: true } },
          },
        },
      },
    });
  },

  ringkasanAntrean() {
    return db.bookingRefund.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { nominal: true },
    });
  },
};
