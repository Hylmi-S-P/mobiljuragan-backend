import { db } from '../db.js';
import { DocumentStatus } from '../generated/prisma/client.js';

export const documentModel = {
  /**
   * Menemukan data dokumen berdasarkan ID booking atau kode booking.
   */
  async findByBookingIdOrCode(bookingIdOrCode: string) {
    const booking = await db.booking.findFirst({
      where: {
        OR: [{ id: bookingIdOrCode }, { bookingCode: bookingIdOrCode }],
      },
      select: { id: true, bookingCode: true, customerId: true, rentalType: true },
    });

    if (!booking) return null;

    const document = await db.bookingDocument.findUnique({
      where: { bookingId: booking.id },
    });

    return {
      booking,
      document,
    };
  },

  /**
   * Mengambil detail lengkap pemesanan untuk pencetakan PDF surat pernyataan auto-filled.
   */
  async findBookingDetailForStatementPdf(bookingIdOrCode: string) {
    return db.booking.findFirst({
      where: {
        OR: [{ id: bookingIdOrCode }, { bookingCode: bookingIdOrCode }],
      },
      include: {
        customer: true,
        vehicle: true,
      },
    });
  },

  /**
   * Menyimpan atau memperbarui unggahan dokumen persyaratan sewa lepas kunci.
   */
  async upsertDocument(
    bookingId: string,
    data: {
      statementLetterUrl?: string | null;
      ktpUrl?: string | null;
      simUrl?: string | null;
    },
  ) {
    const existing = await db.bookingDocument.findUnique({
      where: { bookingId },
    });

    const statementLetterUrl = data.statementLetterUrl ?? existing?.statementLetterUrl ?? null;
    const ktpUrl = data.ktpUrl ?? existing?.ktpUrl ?? null;
    const simUrl = data.simUrl ?? existing?.simUrl ?? null;

    // Tentukan status: jika ada minimal 1 dokumen yang diunggah, status masuk PENDING_VERIFICATION
    const hasAnyDoc = Boolean(statementLetterUrl || ktpUrl || simUrl);
    const status: DocumentStatus = hasAnyDoc
      ? DocumentStatus.PENDING_VERIFICATION
      : DocumentStatus.PENDING_UPLOAD;

    return db.bookingDocument.upsert({
      where: { bookingId },
      create: {
        bookingId,
        statementLetterUrl,
        ktpUrl,
        simUrl,
        status,
        rejectionReason: null,
      },
      update: {
        ...(data.statementLetterUrl !== undefined ? { statementLetterUrl: data.statementLetterUrl } : {}),
        ...(data.ktpUrl !== undefined ? { ktpUrl: data.ktpUrl } : {}),
        ...(data.simUrl !== undefined ? { simUrl: data.simUrl } : {}),
        status,
        rejectionReason: null,
      },
    });
  },

  /**
   * Pembaruan verifikasi oleh staf/admin (VERIFIED atau REJECTED).
   */
  async updateVerification(
    bookingId: string,
    data: {
      status: DocumentStatus;
      rejectionReason?: string | null;
      verifiedAt?: Date | null;
      verifiedBy?: string | null;
    },
  ) {
    return db.bookingDocument.update({
      where: { bookingId },
      data: {
        status: data.status,
        rejectionReason: data.rejectionReason ?? null,
        verifiedAt: data.verifiedAt ?? new Date(),
        verifiedBy: data.verifiedBy ?? null,
      },
    });
  },
};
