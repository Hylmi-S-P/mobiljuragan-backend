import { documentModel } from '../model/documentModel.js';
import { DocumentStatus, UserRole } from '../generated/prisma/client.js';
import { AppError } from '../lib/response.js';
import { documentTemplateService } from '../lib/documentTemplateService.js';
import type { IsiTemplateDokumen } from '../lib/documentTemplateDefault.js';

/** Identitas pemanggil yang sudah lolos `requireAuth`. */
export type DocumentActor = { userId: string; role: UserRole };

/**
 * Memastikan pemanggil berhak menyentuh dokumen pemesanan ini.
 *
 * Staf dan admin boleh memeriksa dokumen pelanggan karena pekerjaannya memang
 * memverifikasi. Pelanggan hanya boleh menyentuh pemesanannya sendiri; kalau
 * tidak, jawabannya 403 dan bukan 404, supaya pemilik yang sah tetap tahu
 * pemesanannya ada.
 */
function pastikanBolehAkses(customerId: string, actor: DocumentActor): void {
  const staf = actor.role === UserRole.ADMIN || actor.role === UserRole.STAFF;
  if (staf) return;

  if (customerId !== actor.userId) {
    throw new AppError(
      'FORBIDDEN',
      'Anda tidak memiliki hak akses untuk dokumen pemesanan ini.',
      403,
    );
  }
}

export const documentService = {
  /**
   * Teks ringkas template aktif, untuk pratinjau cepat di aplikasi mobile.
   *
   * Sumbernya sekarang tabel `document_templates`, bukan teks yang ditanam di
   * kode. Dengan begitu perubahan klausul oleh admin langsung terlihat di
   * pratinjau maupun di PDF yang diunduh pelanggan.
   */
  async getStatementTemplateText() {
    const template = await documentTemplateService.ambilAktif();
    const isi = template.isi as unknown as IsiTemplateDokumen;

    return {
      title: isi.judul,
      company: isi.kop.nama,
      versi: template.versi,
      introduction: isi.pembuka,
      pengantarDetail: isi.pengantarDetail,
      clauses: isi.butir.map((butir) => ({ number: butir.nomor, text: butir.teks })),
      penutup: isi.penutup,
      tempatTanggal: isi.tempatTanggal,
      catatanVersi: isi.catatanVersi,
    };
  },

  /**
   * Mengambil status dokumen pemesanan.
   */
  async getBookingDocuments(bookingIdOrCode: string, actor: DocumentActor) {
    const record = await documentModel.findByBookingIdOrCode(bookingIdOrCode);
    if (!record) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }

    pastikanBolehAkses(record.booking.customerId, actor);

    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      rentalType: record.booking.rentalType,
      isSelfDrive: record.booking.rentalType === 'WITHOUT_DRIVER',
      document: record.document ?? {
        status: DocumentStatus.PENDING_UPLOAD,
        statementLetterUrl: null,
        ktpUrl: null,
        simUrl: null,
        rejectionReason: null,
        verifiedAt: null,
        verifiedBy: null,
      },
    };
  },

  /**
   * Mengunggah dokumen persyaratan sewa lepas kunci dari pelanggan.
   */
  async uploadBookingDocuments(
    bookingIdOrCode: string,
    data: {
      statementLetterUrl?: string | null;
      ktpUrl?: string | null;
      simUrl?: string | null;
    },
    actor: DocumentActor,
  ) {
    const record = await documentModel.findByBookingIdOrCode(bookingIdOrCode);
    if (!record) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }

    pastikanBolehAkses(record.booking.customerId, actor);

    const updated = await documentModel.upsertDocument(record.booking.id, data);
    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      document: updated,
    };
  },

  /**
   * Verifikasi oleh admin / staf operasional.
   */
  async adminVerifyDocuments(
    bookingIdOrCode: string,
    input: {
      action: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
      verifierName?: string;
    },
  ) {
    const record = await documentModel.findByBookingIdOrCode(bookingIdOrCode);
    if (!record) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }

    if (input.action === 'APPROVE') {
      const doc = record.document;
      const isComplete = Boolean(doc?.statementLetterUrl && doc?.ktpUrl && doc?.simUrl);
      if (!isComplete) {
        throw new AppError(
          'INCOMPLETE_DOCUMENTS',
          'Semua berkas (e-KTP, SIM A, dan Surat Pernyataan) harus sudah diunggah oleh pelanggan sebelum dapat disetujui.',
          400,
        );
      }
    }

    const status = input.action === 'APPROVE' ? DocumentStatus.VERIFIED : DocumentStatus.REJECTED;

    const updated = await documentModel.updateVerification(record.booking.id, {
      status,
      rejectionReason:
        input.action === 'REJECT'
          ? (input.rejectionReason ?? 'Dokumen belum memenuhi syarat.')
          : null,
      verifiedAt: new Date(),
      verifiedBy: input.verifierName ?? 'Admin MobilJuragan',
    });

    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      document: updated,
    };
  },
};
