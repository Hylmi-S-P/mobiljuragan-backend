import { db } from '../db.js';
import {
  BookingStatus,
  BookingStatusActor,
  DriverReadiness,
  PaymentMethod,
  PaymentStatus,
  type Prisma,
} from '../generated/prisma/client.js';
import { AppError } from '../lib/response.js';
import { generateDynamicQris } from '../utils/qris.js';

export interface CreatePaymentParams {
  bookingId: string;
  method: PaymentMethod;
  notes?: string;
  actorUserId?: string;
}

export interface UploadProofParams {
  proofImageUrl: string;
  senderAccount?: string;
  bankName?: string;
  actorUserId?: string;
}

export interface AdminVerifyParams {
  action: 'APPROVE' | 'REJECT';
  notes?: string;
  verifierUserId: string;
  verifierName?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    booking: {
      include: {
        vehicle: true;
        customer: {
          select: { id: true; fullName: true; phoneNumber: true };
        };
      };
    };
  };
}>;


let paymentAllocationLock: Promise<unknown> = Promise.resolve();

function withPaymentLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = paymentAllocationLock.then(fn, fn);
  paymentAllocationLock = next.then(() => {}, () => {});
  return next;
}

export const paymentService = {
  /**
   * Pembuatan tagihan pembayaran baru dengan alokasi kode unik (1-100) bebas bentrok
   * dan injeksi QRIS dinamis mandiri (EMVCo Tag 54).
   */
  async createPayment(params: CreatePaymentParams) {
    return withPaymentLock(() =>
      db.$transaction(async (tx) => {
      // 1. Cari booking berdasarkan ID atau bookingCode
      const booking = await tx.booking.findFirst({
        where: {
          OR: [{ id: params.bookingId }, { bookingCode: params.bookingId }],
        },
        include: {
          payment: true,
          vehicle: true,
          customer: {
            select: { id: true, fullName: true, phoneNumber: true },
          },
        },
      });

      if (!booking) {
        throw new AppError(
          'BOOKING_NOT_FOUND',
          `Pesanan sewa '${params.bookingId}' tidak ditemukan.`,
          404
        );
      }

      // Pastikan tarif sewa sudah dikonfirmasi
      if (!booking.quotedAmount || Number(booking.quotedAmount) <= 0) {
        throw new AppError(
          'BOOKING_NOT_QUOTED',
          'Tarif sewa belum dikonfirmasi oleh tim/admin. Pembayaran belum dapat dibuat.',
          400
        );
      }

      // 1:1 Constraint: Cek apakah pembayaran sudah pernah dibuat
      if (booking.payment) {
        if (booking.payment.status === PaymentStatus.PAID) {
          throw new AppError(
            'PAYMENT_ALREADY_SETTLED',
            'Pesanan ini sudah lunas terbayar.',
            400
          );
        }
        throw new AppError(
          'PAYMENT_ALREADY_EXISTS',
          'Tagihan pembayaran untuk pesanan ini sudah ada.',
          409,
          { paymentId: booking.payment.id, status: booking.payment.status }
        );
      }

      const baseAmount = Number(booking.quotedAmount);

      // 2. Alokasi kode unik (1 s.d. 100) bebas bentrok di dalam transaksi
      let uniqueCode = 0;
      let totalAmount = baseAmount;

      if (params.method === PaymentMethod.QRIS || params.method === PaymentMethod.BANK_TRANSFER) {
        // Cari semua kode unik yang sedang aktif pada pembayaran berstatus UNPAID / PENDING_VERIFICATION
        // dengan tarif dasar yang sama untuk menghindari ambiguitas nominal mutasi
        const activePayments = await tx.payment.findMany({
          where: {
            status: { in: [PaymentStatus.UNPAID, PaymentStatus.PENDING_VERIFICATION] },
            baseAmount: baseAmount,
          },
          select: { uniqueCode: true },
        });

        const usedCodes = new Set(activePayments.map((p) => p.uniqueCode));

        // Acak kandidat kode unik antara 1 dan 100
        let candidate = Math.floor(Math.random() * 100) + 1;
        if (usedCodes.has(candidate)) {
          // Cari angka pertama yang belum terpakai dalam rentang 1..100
          candidate = 0;
          for (let c = 1; c <= 100; c++) {
            if (!usedCodes.has(c)) {
              candidate = c;
              break;
            }
          }
          if (candidate === 0) {
            throw new AppError(
              'UNIQUE_CODE_EXHAUSTED',
              'Antrean kode unik pembayaran sedang penuh. Silakan coba beberapa saat lagi.',
              409
            );
          }
        }

        uniqueCode = candidate;
        totalAmount = baseAmount + uniqueCode;
      }

      // 3. Setup QRIS jika metode QRIS
      let qrisPayload: string | null = null;
      let bankName = params.method === PaymentMethod.QRIS ? 'GOPAY' : null;
      if (params.method === PaymentMethod.BANK_TRANSFER) {
        bankName = 'BRI';
      }

      if (params.method === PaymentMethod.QRIS) {
        qrisPayload = generateDynamicQris(totalAmount);
      }

      // Batas waktu pembayaran 12 jam dari sekarang
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

      // 4. Buat record pembayaran
      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          baseAmount,
          uniqueCode,
          totalAmount,
          method: params.method,
          status: PaymentStatus.UNPAID,
          qrisPayload,
          bankName,
          expiresAt,
          notes: params.notes || null,
        },
        include: {
          booking: {
            include: {
              vehicle: true,
              customer: {
                select: { id: true, fullName: true, phoneNumber: true },
              },
            },
          },
        },
      });

      // 5. Catat riwayat status
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: booking.status,
          actor: BookingStatusActor.SYSTEM,
          actorUserId: params.actorUserId || booking.customerId,
          note: `Tagihan pembayaran dibuat via ${params.method} sebesar Rp ${totalAmount.toLocaleString('id-ID')} (Kode Unik: ${uniqueCode}).`,
        },
      });

      // 6. Catat audit log
      await tx.auditLog.create({
        data: {
          actorId: params.actorUserId || booking.customerId,
          action: 'CREATE_PAYMENT',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: {
            bookingCode: booking.bookingCode,
            totalAmount,
            uniqueCode,
            method: params.method,
          },
        },
      });

      return payment;
      })
    );
  },

  /**
   * Memeriksa dan membatalkan otomatis seluruh pembayaran UNPAID yang telah melewati batas 12 jam (expiresAt).
   * Status pembayaran diubah menjadi FAILED, status booking diubah menjadi CANCELLED,
   * dan kesiapan supir (jika ada) dikembalikan ke SIAGA.
   */
  async expireOverduePayments(): Promise<number> {
    try {
      const now = new Date();
      const overduePayments = await db.payment.findMany({
        where: {
          status: PaymentStatus.UNPAID,
          expiresAt: {
            lt: now,
          },
        },
        include: {
          booking: {
            include: {
              vehicle: true,
            },
          },
        },
      });

      if (overduePayments.length === 0) return 0;

      let expiredCount = 0;
      for (const payment of overduePayments) {
        await db.$transaction(async (tx) => {
          const current = await tx.payment.findUnique({
            where: { id: payment.id },
            include: { booking: true },
          });

          if (!current || current.status !== PaymentStatus.UNPAID || !current.expiresAt || current.expiresAt >= now) {
            return;
          }

          // 1. Update status pembayaran menjadi FAILED
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
              notes: current.notes
                ? `${current.notes} | Kedaluwarsa otomatis: Melewati batas waktu pembayaran 12 jam.`
                : 'Kedaluwarsa otomatis: Melewati batas waktu pembayaran 12 jam.',
            },
          });

          // 2. Update status booking menjadi CANCELLED jika masih CONFIRMED / PENDING_CONFIRMATION / CREATED
          if (
            current.booking.status === BookingStatus.CONFIRMED ||
            current.booking.status === BookingStatus.PENDING_CONFIRMATION ||
            current.booking.status === BookingStatus.CREATED
          ) {
            await tx.booking.update({
              where: { id: current.booking.id },
              data: {
                status: BookingStatus.CANCELLED,
              },
            });

            await tx.bookingStatusHistory.create({
              data: {
                bookingId: current.booking.id,
                fromStatus: current.booking.status,
                toStatus: BookingStatus.CANCELLED,
                actor: BookingStatusActor.SYSTEM,
                note: 'Pesanan dibatalkan otomatis oleh sistem karena batas waktu pembayaran 12 jam telah terlewati.',
              },
            });

            // Lepas supir kembali ke SIAGA jika ada dan tidak memegang booking aktif lain
            if (current.booking.driverId) {
              const otherActive = await tx.booking.count({
                where: {
                  driverId: current.booking.driverId,
                  id: { not: current.booking.id },
                  status: {
                    in: [
                      BookingStatus.CONFIRMED,
                      BookingStatus.IN_PROGRESS,
                    ],
                  },
                },
              });
              if (otherActive === 0) {
                await tx.driver.update({
                  where: { id: current.booking.driverId },
                  data: { readiness: DriverReadiness.SIAGA },
                });
              }
            }

            await tx.auditLog.create({
              data: {
                action: 'AUTO_CANCEL_EXPIRED_PAYMENT',
                entityType: 'Booking',
                entityId: current.booking.id,
                metadata: {
                  bookingCode: current.booking.bookingCode,
                  paymentId: payment.id,
                  expiredAt: current.expiresAt.toISOString(),
                  reason: '12_HOURS_EXPIRED',
                },
              },
            });
          }

          expiredCount++;
        });
      }

      return expiredCount;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PaymentService] Error expiring overdue payments:', err);
      return 0;
    }
  },

  /**
   * Mengambil detail pembayaran berdasarkan bookingId atau bookingCode.
   */
  async getPaymentByBookingId(bookingId: string) {
    await this.expireOverduePayments();

    const payment = await db.payment.findFirst({
      where: {
        OR: [
          { bookingId: bookingId },
          { booking: { bookingCode: bookingId } },
        ],
      },
      include: {
        booking: {
          include: {
            vehicle: true,
            customer: {
              select: { id: true, fullName: true, phoneNumber: true },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(
        'PAYMENT_NOT_FOUND',
        `Pembayaran untuk pesanan '${bookingId}' tidak ditemukan.`,
        404
      );
    }

    return payment;
  },

  /**
   * Mengambil pembayaran berdasarkan payment ID.
   */
  async getPaymentById(paymentId: string) {
    await this.expireOverduePayments();

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            vehicle: true,
            customer: {
              select: { id: true, fullName: true, phoneNumber: true },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(
        'PAYMENT_NOT_FOUND',
        `Pembayaran dengan ID '${paymentId}' tidak ditemukan.`,
        404
      );
    }

    return payment;
  },

  /**
   * Unggah bukti transfer manual pelanggan (Bank Transfer).
   * Status berpindah menjadi PENDING_VERIFICATION.
   */
  async uploadPaymentProof(paymentId: string, params: UploadProofParams) {
    return db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });

      if (!payment) {
        throw new AppError(
          'PAYMENT_NOT_FOUND',
          `Pembayaran '${paymentId}' tidak ditemukan.`,
          404
        );
      }

      if (payment.status === PaymentStatus.PAID) {
        throw new AppError(
          'PAYMENT_ALREADY_SETTLED',
          'Pembayaran sudah lunas dan tidak perlu mengunggah bukti lagi.',
          400
        );
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          proofImageUrl: params.proofImageUrl,
          senderAccount: params.senderAccount || payment.senderAccount,
          bankName: params.bankName || payment.bankName,
          status: PaymentStatus.PENDING_VERIFICATION,
        },
        include: {
          booking: {
            include: {
              vehicle: true,
              customer: {
                select: { id: true, fullName: true, phoneNumber: true },
              },
            },
          },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: payment.bookingId,
          fromStatus: payment.booking.status,
          toStatus: payment.booking.status,
          actor: BookingStatusActor.CUSTOMER,
          actorUserId: params.actorUserId || payment.booking.customerId,
          note: `Bukti transfer pembayaran diunggah oleh pelanggan. Menunggu verifikasi tim.`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.actorUserId || payment.booking.customerId,
          action: 'UPLOAD_PAYMENT_PROOF',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: {
            bookingCode: payment.booking.bookingCode,
            proofImageUrl: params.proofImageUrl,
          },
        },
      });

      return updated;
    });
  },

  /**
   * Antrean verifikasi pembayaran untuk admin portal.
   */
  async adminListPayments(params: {
    status?: PaymentStatus;
    method?: PaymentMethod;
    search?: string;
    page: number;
    limit: number;
  }) {
    await this.expireOverduePayments();

    const skip = (params.page - 1) * params.limit;
    const where: Prisma.PaymentWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.method) {
      where.method = params.method;
    }

    if (params.search) {
      where.OR = [
        { booking: { bookingCode: { contains: params.search } } },
        { booking: { customer: { fullName: { contains: params.search } } } },
        { senderAccount: { contains: params.search } },
        { bankName: { contains: params.search } },
      ];
    }

    const [total, payments] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  licensePlate: true,
                  brand: true,
                  model: true,
                },
              },
              customer: {
                select: {
                  id: true,
                  fullName: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: payments,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  },

  /**
   * Verifikasi manual oleh staf/admin (Approve / Reject).
   */
  async adminVerifyPayment(paymentId: string, params: AdminVerifyParams) {
    return db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });

      if (!payment) {
        throw new AppError(
          'PAYMENT_NOT_FOUND',
          `Pembayaran dengan ID '${paymentId}' tidak ditemukan.`,
          404
        );
      }

      // Penjagaan status: verifikasi bersifat final dan tidak dapat dibatalkan.
      // Tanpa pemeriksaan ini, pembayaran yang sudah lunas masih bisa disetujui
      // ulang (menimpa jejak verifikator pertama) atau bahkan ditolak sehingga
      // dana yang sudah masuk tercatat gagal.
      if (payment.status === PaymentStatus.PAID) {
        throw new AppError(
          'PAYMENT_ALREADY_SETTLED',
          'Pembayaran ini sudah lunas dan terverifikasi. Status final tidak dapat diubah.',
          409,
        );
      }

      // Hanya tagihan yang masih berjalan yang boleh diverifikasi. FAILED dan
      // REFUNDED sengaja ditolak: menandainya lunas akan menutupi riwayat
      // penolakan atau pengembalian dana yang sudah tercatat.
      // UNPAID tetap diizinkan karena pembayaran tunai (CASH) tidak pernah
      // melewati tahap unggah bukti, sehingga admin menandainya langsung.
      const verifiableStatuses: PaymentStatus[] = [
        PaymentStatus.UNPAID,
        PaymentStatus.PENDING_VERIFICATION,
      ];
      if (!verifiableStatuses.includes(payment.status)) {
        throw new AppError(
          'PAYMENT_NOT_VERIFIABLE',
          `Pembayaran berstatus ${payment.status} tidak dapat diverifikasi.`,
          409,
        );
      }

      if (params.action === 'APPROVE') {
        const now = params.acknowledgedAt ?? new Date();
        const acknowledgedBy =
          params.acknowledgedBy ??
          (params.verifierName
            ? `${params.verifierName} (${params.verifierUserId})`
            : params.verifierUserId);

        const updated = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.PAID,
            verifiedAt: now,
            verifiedBy: params.verifierUserId,
            acknowledgedAt: now,
            acknowledgedBy,
            notes: params.notes ? `${payment.notes ? payment.notes + ' | ' : ''}${params.notes}` : payment.notes,
          },
          include: {
            booking: {
              include: {
                vehicle: true,
                customer: {
                  select: { id: true, fullName: true, phoneNumber: true },
                },
              },
            },
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: payment.bookingId,
            fromStatus: payment.booking.status,
            toStatus: payment.booking.status,
            actor: BookingStatusActor.ADMIN,
            actorUserId: params.verifierUserId,
            note: `Pembayaran disetujui secara manual oleh ${params.verifierName || 'Admin'}. Status lunas (PAID).`,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: params.verifierUserId,
            action: 'VERIFY_PAYMENT_APPROVED',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: {
              bookingCode: payment.booking.bookingCode,
              totalAmount: payment.totalAmount,
              notes: params.notes,
              acknowledgedBy,
              acknowledgedAt: now.toISOString(),
            },
          },
        });

        return updated;
      } else {
        // REJECT
        const updated = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.FAILED,
            verifiedAt: new Date(),
            verifiedBy: params.verifierUserId,
            notes: params.notes
              ? `${payment.notes ? payment.notes + ' | ' : ''}DITOLAK: ${params.notes}`
              : `${payment.notes ? payment.notes + ' | ' : ''}Bukti transfer ditolak admin.`,
          },
          include: {
            booking: {
              include: {
                vehicle: true,
                customer: {
                  select: { id: true, fullName: true, phoneNumber: true },
                },
              },
            },
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: payment.bookingId,
            fromStatus: payment.booking.status,
            toStatus: payment.booking.status,
            actor: BookingStatusActor.ADMIN,
            actorUserId: params.verifierUserId,
            note: `Bukti transfer pembayaran ditolak oleh ${params.verifierName || 'Admin'}: ${params.notes || 'Bukti transfer tidak valid'}.`,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: params.verifierUserId,
            action: 'VERIFY_PAYMENT_REJECTED',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: {
              bookingCode: payment.booking.bookingCode,
              totalAmount: payment.totalAmount,
              notes: params.notes,
            },
          },
        });

        return updated;
      }
    });
  },
};
