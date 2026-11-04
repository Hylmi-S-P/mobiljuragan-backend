import { documentModel } from '../model/documentModel.js';
import { DocumentStatus, UserRole } from '../generated/prisma/client.js';
import { assertBookingDocumentsMutable } from '../lib/bookingStage.js';
import { AppError } from '../lib/response.js';
import { documentTemplateService } from '../lib/documentTemplateService.js';
import {
  simpanMediaDariBase64,
  segarkanTautanMedia,
  tautanStabil,
  type KategoriMedia,
} from '../lib/mediaService.js';
import {
  documentTargetsFromLegacyReason,
  parseDocumentTargets,
  requireDocumentTargets,
  serializeDocumentTargets,
  type DocumentTarget,
} from '../lib/documentTargets.js';

/** Identitas pemanggil yang sudah lolos `requireAuth`. */
export type DocumentActor = { userId: string; role: UserRole };

/**
 * Mengubah kolom `rejectionTargets` (JSON) menjadi array untuk klien.
 *
 * Baris lama belum punya kolom ini. Kalau kosong tetapi statusnya REJECTED,
 * target diturunkan dari teks alasan supaya aplikasi versi lama tetap menandai
 * dokumen yang benar.
 */
function toClientDocument<
  T extends { rejectionReason?: string | null; rejectionTargets?: string | null; status?: string },
>(doc: T): Omit<T, 'rejectionTargets'> & { rejectionTargets: DocumentTarget[] } {
  const stored = parseDocumentTargets(doc.rejectionTargets);
  const targets =
    stored.length > 0 || doc.status !== 'REJECTED'
      ? stored
      : documentTargetsFromLegacyReason(doc.rejectionReason);

  return { ...doc, rejectionTargets: targets };
}

/**
 * Menentukan tautan dokumen yang akan disimpan.
 *
 * Menerima data URL Base64 dari aplikasi lama maupun tautan media yang sudah
 * jadi. Nilai kosong berarti dokumen itu tidak diunggah pada permintaan ini.
 *
 * Base64 tidak pernah ditulis ke kolom database: isinya dinormalkan sharp lebih
 * dulu, lalu disimpan sebagai berkas media. Satu foto e-KTP dari kamera HP bisa
 * mencapai 3 MB, dan menyimpannya sebagai teks Base64 membuat baris tabel
 * membengkak tiga kali lipat.
 */
async function selesaikanDokumen(
  nilai: string | null | undefined,
  kategori: KategoriMedia,
  ownerUserId: string,
): Promise<string | null> {
  if (!nilai) return null;

  const bersih = nilai.trim();
  if (!bersih) return null;

  if (bersih.startsWith('/api/v1/media/')) return bersih;

  if (bersih.startsWith('data:')) {
    const media = await simpanMediaDariBase64({ base64: bersih, kategori, ownerUserId });
    return tautanStabil(media.id);
  }

  throw new AppError(
    'DOCUMENT_INVALID',
    'Dokumen harus diunggah sebagai berkas gambar, bukan berupa alamat luar.',
    400,
  );
}

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
   * Keterangan dokumen aktif untuk pratinjau di aplikasi mobile.
   *
   * Dulu di sini dikirim daftar klausul sebagai teks. Itu tidak bisa
   * dipertahankan setelah dokumen menjadi berkas unggahan admin: isinya bisa
   * berupa PDF atau Word yang tidak bisa dibaca sebagai teks biasa.
   *
   * Yang dikirim sekarang adalah keterangan berkasnya, dan pelanggan mengunduh
   * berkasnya untuk membaca dan menandatangani.
   */
  async getStatementTemplateText() {
    return documentTemplateService.keteranganDokumenAktif();
  },

  /**
   * Menerjemahkan id atau kode booking menjadi rujukan kanonik.
   *
   * Klien mobile mengirim kode (mis. `MJ-W06`) sementara portal memakai id
   * database. Tanpa penyeragaman, berkas yang sama tersimpan di dua folder
   * berbeda dan URL lamanya berhenti berlaku.
   */
  async resolveBookingRef(bookingIdOrCode: string): Promise<{ id: string; bookingCode: string }> {
    const record = await documentModel.findByBookingIdOrCode(bookingIdOrCode);
    if (!record) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }
    return { id: record.booking.id, bookingCode: record.booking.bookingCode };
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

    /*
     * Tautan dokumen yang tersimpan adalah rujukan stabil tanpa tanda tangan.
     * Tanda tangan dibuat baru di sini supaya pratinjau di dashboard tetap bisa
     * dibuka walaupun data sudah lama tersimpan.
     */
    const dokumen = record.document
      ? toClientDocument({
          ...record.document,
          statementLetterUrl: await segarkanTautanMedia(record.document.statementLetterUrl),
          ktpUrl: await segarkanTautanMedia(record.document.ktpUrl),
          simUrl: await segarkanTautanMedia(record.document.simUrl),
        })
      : {
          status: DocumentStatus.PENDING_UPLOAD,
          statementLetterUrl: null,
          ktpUrl: null,
          simUrl: null,
          rejectionReason: null,
          rejectionTargets: [] as DocumentTarget[],
          verifiedAt: null,
          verifiedBy: null,
        };

    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      rentalType: record.booking.rentalType,
      isSelfDrive: record.booking.rentalType === 'WITHOUT_DRIVER',
      document: dokumen,
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

    /* Pesanan yang sudah berjalan/selesai tidak boleh menerima dokumen baru;
       sebelumnya aksi ini masih lolos di pesanan COMPLETED. */
    assertBookingDocumentsMutable(record.booking.status);

    pastikanBolehAkses(record.booking.customerId, actor);

    /*
     * Ketiga berkas diselesaikan lebih dulu, sebelum menyentuh database.
     *
     * Isinya bisa berupa data URL Base64 dari aplikasi lama atau tautan media
     * yang sudah jadi. Yang Base64 dinormalkan sharp lalu disimpan sebagai
     * media, sehingga kolom `statementLetterUrl`, `ktpUrl`, dan `simUrl` tidak
     * lagi menyimpan blok Base64 berukuran ratusan kilobita.
     */
    const [statementLetterUrl, ktpUrl, simUrl] = await Promise.all([
      selesaikanDokumen(data.statementLetterUrl, 'STATEMENT_LETTER', record.booking.customerId),
      selesaikanDokumen(data.ktpUrl, 'KTP', record.booking.customerId),
      selesaikanDokumen(data.simUrl, 'SIM', record.booking.customerId),
    ]);

    const updated = await documentModel.upsertDocument(record.booking.id, {
      statementLetterUrl,
      ktpUrl,
      simUrl,
    });
    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      document: toClientDocument({
        ...updated,
        statementLetterUrl: await segarkanTautanMedia(updated.statementLetterUrl),
        ktpUrl: await segarkanTautanMedia(updated.ktpUrl),
        simUrl: await segarkanTautanMedia(updated.simUrl),
      }),
    };
  },

  /**
   * Verifikasi oleh admin / staf operasional.
   */
  /** Cek kepemilikan berkas untuk endpoint pengambilan file dokumen. */
  async isFileOwnedByCustomer(key: string, customerId: string): Promise<boolean> {
    return documentModel.isFileOwnedByCustomer(key, customerId);
  },

  async adminVerifyDocuments(
    bookingIdOrCode: string,
    input: {
      action: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
      /** Dokumen yang ditolak; wajib berisi minimal satu saat action = REJECT. */
      targets?: unknown;
      verifierName?: string;
    },
  ) {
    const record = await documentModel.findByBookingIdOrCode(bookingIdOrCode);
    if (!record) {
      throw new AppError('BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan.', 404);
    }

    assertBookingDocumentsMutable(record.booking.status);

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

    let targets: DocumentTarget[] = [];
    if (input.action === 'REJECT') {
      try {
        targets = requireDocumentTargets(input.targets);
      } catch {
        throw new AppError(
          'INVALID_DOCUMENT_TARGET',
          'Dokumen yang ditolak harus dipilih dari e-KTP, SIM A, atau Surat Pernyataan.',
          400,
        );
      }

      /* Penolakan tanpa target membuat pelanggan menebak dokumen mana yang harus
         difoto ulang, dan dulu berakhir dengan semua baris ditandai merah. */
      if (targets.length === 0) {
        throw new AppError(
          'REJECTION_TARGET_REQUIRED',
          'Pilih minimal satu dokumen yang bermasalah sebelum menolak.',
          400,
        );
      }
    }

    const updated = await documentModel.updateVerification(record.booking.id, {
      status,
      rejectionReason:
        input.action === 'REJECT'
          ? input.rejectionReason ?? 'Dokumen belum memenuhi syarat.'
          : null,
      rejectionTargets: serializeDocumentTargets(targets),
      verifiedAt: new Date(),
      verifiedBy: input.verifierName ?? 'Admin MobilJuragan',
    });

    return {
      bookingId: record.booking.id,
      bookingCode: record.booking.bookingCode,
      document: toClientDocument({
        ...updated,
        statementLetterUrl: await segarkanTautanMedia(updated.statementLetterUrl),
        ktpUrl: await segarkanTautanMedia(updated.ktpUrl),
        simUrl: await segarkanTautanMedia(updated.simUrl),
      }),
    };
  },
};
