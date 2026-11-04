import { db } from '../db.js';
import {
  BookingStatus,
  BookingStatusActor,
  DocumentStatus,
  PaymentMethod,
  PaymentStatus,
  RentalType,
  UserRole,
  type Prisma,
} from '../generated/prisma/client.js';
import { AppError } from '../lib/response.js';
import { generateDynamicQris } from '../utils/qris.js';
import { simpanMediaDariBase64, segarkanTautanMedia, tautanStabil } from '../lib/mediaService.js';

/** Identitas pemanggil yang sudah lolos `requireAuth`. */
export type PaymentActor = { userId: string; role: UserRole };

/**
 * Memastikan pemanggil berhak menyentuh pembayaran ini.
 *
 * Staf dan admin boleh melihat seluruh pembayaran karena tugasnya memverifikasi.
 * Pelanggan hanya boleh menyentuh pembayaran milik pemesanannya sendiri.
 */
function pastikanBolehAkses(customerId: string, actor: PaymentActor): void {
  const staf = actor.role === UserRole.ADMIN || actor.role === UserRole.STAFF;
  if (staf) return;

  if (customerId !== actor.userId) {
    throw new AppError(
      'FORBIDDEN',
      'Anda tidak memiliki hak akses untuk pembayaran pesanan ini.',
      403,
    );
  }
}

export interface CreatePaymentParams {
  bookingId: string;
  method: PaymentMethod;
  notes?: string;
  actorUserId?: string;
}

export interface UploadProofParams {
  /**
   * Bukti transfer. Boleh berupa salah satu:
   *
   * - `mediaId` hasil unggahan ke `/api/v1/media` (cara baru, paling ringkas);
   * - data URL Base64 (cara lama, masih diterima supaya APK yang sudah beredar
   *   tidak rusak — isinya dinormalkan sharp lalu disimpan sebagai media);
   * - tautan `/api/v1/media/...` yang sudah jadi.
   *
   * Yang tidak diterima adalah alamat sembarang di internet, karena bukti
   * transfer harus berada di penyimpanan kita sendiri agar bisa dipercaya.
   */
  proofImageUrl?: string;
  proofMediaId?: string;
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

/**
 * Membuat ulang tautan bukti transfer sebelum data dikirim ke pemanggil.
 *
 * Kolom `proofImageUrl` menyimpan rujukan stabil tanpa tanda tangan, karena
 * tautan bertanda tangan akan kedaluwarsa dan tidak bisa dipakai lagi besok.
 * Tanda tangan baru dibuat di sini, sehingga setiap pembacaan menghasilkan
 * tautan yang masih berlaku.
 */
async function denganBuktiSegar<T extends { proofImageUrl?: string | null }>(
  payment: T,
): Promise<T> {
  if (!payment.proofImageUrl) return payment;
  return { ...payment, proofImageUrl: await segarkanTautanMedia(payment.proofImageUrl) };
}

/** Versi daftar dari `denganBuktiSegar`. */
async function daftarDenganBuktiSegar<T extends { proofImageUrl?: string | null }>(
  payments: T[],
): Promise<T[]> {
  return Promise.all(payments.map((item) => denganBuktiSegar(item)));
}

/**
 * Menentukan tautan bukti transfer yang akan disimpan.
 *
 * Dijalankan SEBELUM transaksi database, karena menyimpan media berarti menulis
 * berkas ke disk. Kalau dikerjakan di dalam transaksi, kegagalan database akan
 * meninggalkan berkas yatim, dan transaksi akan tertahan selama penulisan disk.
 */
async function selesaikanBuktiTransfer(
  params: UploadProofParams,
  customerId: string,
): Promise<string | null> {
  if (params.proofMediaId) {
    const media = await db.mediaObject.findUnique({ where: { id: params.proofMediaId } });
    if (!media) {
      throw new AppError('MEDIA_NOT_FOUND', 'Berkas bukti transfer tidak ditemukan.', 404);
    }
    return tautanStabil(media.id);
  }

  if (!params.proofImageUrl) return null;

  const nilai = params.proofImageUrl.trim();

  // Sudah berupa tautan media internal: pakai apa adanya.
  if (nilai.startsWith('/api/v1/media/')) return nilai;

  // Base64 lama: normalkan lewat sharp, simpan sebagai media, jangan ke kolom.
  if (nilai.startsWith('data:')) {
    const media = await simpanMediaDariBase64({
      base64: nilai,
      kategori: 'PAYMENT_PROOF',
      ownerUserId: customerId,
    });
    return tautanStabil(media.id);
  }

  throw new AppError(
    'PROOF_INVALID',
    'Bukti transfer harus diunggah sebagai berkas gambar, bukan berupa alamat luar.',
    400,
  );
}

function withPaymentLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = paymentAllocationLock.then(fn, fn);
  paymentAllocationLock = next.then(
    () => {},
    () => {},
  );
  return next;
}

export const paymentService = {
  /**
   * Pembuatan tagihan pembayaran baru dengan alokasi kode unik (1-100) bebas bentrok
   * dan injeksi QRIS dinamis mandiri (EMVCo Tag 54).
   */
  async createPayment(params: CreatePaymentParams, actor: PaymentActor) {
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
            404,
          );
        }

        pastikanBolehAkses(booking.customerId, actor);

        // Pastikan tarif sewa sudah dikonfirmasi
        if (!booking.quotedAmount || Number(booking.quotedAmount) <= 0) {
          throw new AppError(
            'BOOKING_NOT_QUOTED',
            'Tarif sewa belum dikonfirmasi oleh tim/admin. Pembayaran belum dapat dibuat.',
            400,
          );
        }

        // Pastikan dokumen sewa lepas kunci sudah diverifikasi sebelum tagihan dibuat
        if (booking.rentalType === RentalType.WITHOUT_DRIVER) {
          const doc = await tx.bookingDocument.findUnique({
            where: { bookingId: booking.id },
          });
          if (doc?.status !== DocumentStatus.VERIFIED) {
            throw new AppError(
              'DOCUMENTS_NOT_VERIFIED',
              'Dokumen persyaratan lepas kunci wajib diverifikasi admin sebelum tagihan pembayaran dapat dibuat.',
              400,
            );
          }
        }

        // 1:1 Constraint: Cek apakah pembayaran sudah pernah dibuat
        if (booking.payment) {
          if (booking.payment.status === PaymentStatus.PAID) {
            throw new AppError('PAYMENT_ALREADY_SETTLED', 'Pesanan ini sudah lunas terbayar.', 400);
          }
          throw new AppError(
            'PAYMENT_ALREADY_EXISTS',
            'Tagihan pembayaran untuk pesanan ini sudah ada.',
            409,
            { paymentId: booking.payment.id, status: booking.payment.status },
          );
        }

        const baseAmount = Number(booking.quotedAmount);

        /* Nominal tagihan sama dengan tarif yang disepakati.
           Sebelumnya server menambahkan "kode unik" 1-100 ke total, sementara
           aplikasi mobile menghitung kode 3 digit sendiri dari hash id pesanan.
           Dua angka berbeda itu tidak mungkin dicocokkan dengan mutasi bank, jadi
           verifikasi kini murni manual memakai nominal dan bukti transfer.
           Kolom `uniqueCode` tetap ada (usang, selalu 0) agar data lama terbaca. */
        const uniqueCode = 0;
        const totalAmount = baseAmount;

        // 3. Setup QRIS jika metode QRIS
        let qrisPayload: string | null = null;
        let bankName = params.method === PaymentMethod.QRIS ? 'GOPAY' : null;
        if (params.method === PaymentMethod.BANK_TRANSFER) {
          bankName = 'BRI';
        }

        if (params.method === PaymentMethod.QRIS) {
          qrisPayload = generateDynamicQris(totalAmount);
        }

        // Batas waktu pembayaran 2 jam dari sekarang
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

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
            note: `Tagihan pembayaran dibuat via ${params.method} sebesar Rp ${totalAmount.toLocaleString('id-ID')}.`,
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

        return denganBuktiSegar(payment);
      }),
    );
  },

  /**
   * Mengambil detail pembayaran berdasarkan bookingId atau bookingCode.
   */
  async getPaymentByBookingId(bookingId: string, actor: PaymentActor) {
    const payment = await db.payment.findFirst({
      where: {
        OR: [{ bookingId: bookingId }, { booking: { bookingCode: bookingId } }],
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
        404,
      );
    }

    pastikanBolehAkses(payment.booking.customerId, actor);

    return denganBuktiSegar(payment);
  },

  /**
   * Mengambil pembayaran berdasarkan payment ID.
   */
  async getPaymentById(paymentId: string, actor: PaymentActor) {
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
        404,
      );
    }

    pastikanBolehAkses(payment.booking.customerId, actor);

    return denganBuktiSegar(payment);
  },

  /**
   * Unggah bukti transfer manual pelanggan (Bank Transfer).
   * Status berpindah menjadi PENDING_VERIFICATION.
   */
  async uploadPaymentProof(paymentId: string, params: UploadProofParams, actor: PaymentActor) {
    /*
     * Kepemilikan diperiksa lebih dulu, sebelum berkas apa pun ditulis ke
     * penyimpanan. Tanpa urutan ini, orang yang tidak berhak tetap bisa
     * menitipkan berkas ke disk lewat ID pembayaran milik orang lain.
     */
    const pemilik = await db.payment.findUnique({
      where: { id: paymentId },
      select: { booking: { select: { customerId: true } } },
    });

    if (!pemilik) {
      throw new AppError('PAYMENT_NOT_FOUND', `Pembayaran '${paymentId}' tidak ditemukan.`, 404);
    }

    pastikanBolehAkses(pemilik.booking.customerId, actor);

    const tautanBukti = await selesaikanBuktiTransfer(params, pemilik.booking.customerId);

    return db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });

      if (!payment) {
        throw new AppError('PAYMENT_NOT_FOUND', `Pembayaran '${paymentId}' tidak ditemukan.`, 404);
      }

      if (payment.status === PaymentStatus.PAID) {
        throw new AppError(
          'PAYMENT_ALREADY_SETTLED',
          'Pembayaran sudah lunas dan tidak perlu mengunggah bukti lagi.',
          400,
        );
      }

      pastikanBolehAkses(payment.booking.customerId, actor);

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          proofImageUrl: tautanBukti ?? payment.proofImageUrl,
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
            /*
             * Isi berkas sengaja TIDAK dicatat di sini. Sebelumnya seluruh
             * Base64 bukti transfer disalin ke audit_logs, sehingga satu foto
             * tersimpan dua kali dan ikut terbawa di respons admin.
             *
             * Yang dicatat sekarang hanya panjang tautan media yang tersimpan,
             * sebagai penanda bahwa bukti memang terlampir.
             */
            ukuranBukti: tautanBukti ? tautanBukti.length : 0,
            bankName: params.bankName ?? null,
          },
        },
      });

      return denganBuktiSegar(updated);
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
      items: await daftarDenganBuktiSegar(payments),
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
          404,
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
            notes: params.notes
              ? `${payment.notes ? payment.notes + ' | ' : ''}${params.notes}`
              : payment.notes,
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

        return denganBuktiSegar(updated);
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

        return denganBuktiSegar(updated);
      }
    });
  },
};
