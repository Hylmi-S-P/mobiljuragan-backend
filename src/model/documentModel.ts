import { db } from '../db.js';
import { DocumentDeadlineState, DocumentStatus } from '../generated/prisma/client.js';
import {
  parseDocumentTargets,
  serializeDocumentTargets,
  type DocumentTarget,
} from '../lib/documentTargets.js';

export const documentModel = {
  /**
   * Menemukan data dokumen berdasarkan ID booking atau kode booking.
   */
  async findByBookingIdOrCode(bookingIdOrCode: string) {
    const booking = await db.booking.findFirst({
      where: {
        OR: [{ id: bookingIdOrCode }, { bookingCode: bookingIdOrCode }],
      },
      select: {
        id: true,
        bookingCode: true,
        customerId: true,
        rentalType: true,
        status: true,
        startDateTime: true,
        documentDeadlineState: true,
      },
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

    /* Berkas mana yang benar-benar diunggah pada permintaan ini.
       Penting untuk dua hal: menandai berkas mana yang sudah diperbaiki, dan
       memastikan berkas lama tidak ikut terhapus. */
    const targetDiunggah: DocumentTarget[] = [
      ...(data.ktpUrl ? (['KTP'] as const) : []),
      ...(data.simUrl ? (['SIM'] as const) : []),
      ...(data.statementLetterUrl ? (['STATEMENT'] as const) : []),
    ];

    /*
     * Sisa berkas yang masih bermasalah.
     *
     * Admin bisa menolak dua berkas (mis. e-KTP dan SIM). Begitu pelanggan
     * mengunggah ulang keduanya, tidak boleh ada lagi yang ditandai merah.
     * Tapi kalau baru satu yang diunggah, berkas lain tetap perlu diperbaiki,
     * dan catatan admin masih berlaku untuknya.
     */
    const targetSisa = parseDocumentTargets(existing?.rejectionTargets).filter(
      (target) => !targetDiunggah.includes(target),
    );
    const masihAdaYangBermasalah = targetSisa.length > 0;

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
        /* Nilai yang sudah diresolusi, bukan nilai mentah dari permintaan.
           Dulu kolom yang tidak dikirim ikut ditulis sebagai `null`, sehingga
           mengunggah ulang dua berkas menghapus berkas ketiga yang sebelumnya
           sudah dinyatakan benar oleh staf. */
        statementLetterUrl,
        ktpUrl,
        simUrl,
        status,
        rejectionReason: masihAdaYangBermasalah ? existing?.rejectionReason ?? null : null,
        rejectionTargets: serializeDocumentTargets(targetSisa),
      },
    });
  },

  /**
   * Memastikan berkas tertentu memang milik dokumen pesanan pelanggan tersebut.
   *
   * Dipakai endpoint pengambilan berkas: tanpa pemeriksaan ini, siapa pun yang
   * menebak nama berkas bisa membaca KTP/SIM pelanggan lain.
   */
  async isFileOwnedByCustomer(key: string, customerId: string): Promise<boolean> {
    const found = await db.bookingDocument.findFirst({
      where: {
        booking: { customerId },
        OR: [
          { statementLetterUrl: { contains: key } },
          { ktpUrl: { contains: key } },
          { simUrl: { contains: key } },
        ],
      },
      select: { id: true },
    });
    return Boolean(found);
  },

  /**
   * Pembaruan verifikasi oleh staf/admin (VERIFIED atau REJECTED).
   */
  async updateVerification(
    bookingId: string,
    data: {
      status: DocumentStatus;
      rejectionReason?: string | null;
      /** JSON array target penolakan; null saat dokumen disetujui. */
      rejectionTargets?: string | null;
      verifiedAt?: Date | null;
      verifiedBy?: string | null;
    },
  ) {
    return db.bookingDocument.update({
      where: { bookingId },
      data: {
        status: data.status,
        rejectionReason: data.rejectionReason ?? null,
        rejectionTargets: data.rejectionTargets ?? null,
        verifiedAt: data.verifiedAt ?? new Date(),
        verifiedBy: data.verifiedBy ?? null,
      },
    });
  },

  /**
   * Mengubah keadaan tenggat unggah dokumen pada pesanan.
   *
   * Dipisah dari `updateVerification` karena tenggat hidup di tabel `bookings`,
   * bukan di `booking_documents`: baris dokumen baru ada setelah unggahan
   * pertama, sedangkan tenggat harus sudah berjalan sejak pesanan dibuat.
   */
  async updateDocumentDeadline(
    bookingId: string,
    data: {
      state: DocumentDeadlineState;
      deadlineAt?: Date | null;
      rejectedAt?: Date | null;
    },
  ) {
    return db.booking.update({
      where: { id: bookingId },
      data: {
        documentDeadlineState: data.state,
        ...(data.deadlineAt !== undefined ? { documentDeadlineAt: data.deadlineAt } : {}),
        ...(data.rejectedAt !== undefined ? { documentRejectedAt: data.rejectedAt } : {}),
      },
      select: {
        id: true,
        documentDeadlineAt: true,
        documentDeadlineState: true,
        documentRejectedAt: true,
      },
    });
  },
};
