import {
  BookingStatus,
  DocumentStatus,
  OperationalStatus,
  PaymentStatus,
  RentalType,
  TariffStatus,
} from '../generated/prisma/client.js';
import { AppError } from './response.js';

/**
 * Aturan urutan tahap pesanan sewa.
 *
 * Alur resmi yang disepakati: permintaan masuk (cek dokumen) -> dokumen disetujui
 * -> konfirmasi tarif -> menunggu pembayaran -> sewa berjalan -> selesai.
 *
 * Sebelum modul ini ada, status hanya diperiksa per-aksi, sehingga pesanan masih
 * di tahap permintaan masuk bisa langsung mendapat tarif lalu meloncat ke tahap
 * pembayaran. Semua pemeriksaan urutan sekarang lewat satu tempat ini supaya
 * controller, model, dan service tidak punya versi aturan masing-masing.
 */

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.CREATED]: [BookingStatus.PENDING_CONFIRMATION, BookingStatus.CANCELLED],
  [BookingStatus.PENDING_CONFIRMATION]: [
    BookingStatus.CONFIRMED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.REJECTED]: [],
  [BookingStatus.CANCELLED]: [],
};

export const FINAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.COMPLETED,
  BookingStatus.REJECTED,
  BookingStatus.CANCELLED,
];

export function isFinalBookingStatus(status: BookingStatus): boolean {
  return FINAL_BOOKING_STATUSES.includes(status);
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (from === to) {
    throw new AppError(
      'BOOKING_STATUS_UNCHANGED',
      `Pesanan sudah berstatus ${from}.`,
      409,
    );
  }

  if (!canTransitionBooking(from, to)) {
    throw new AppError(
      'INVALID_BOOKING_TRANSITION',
      `Status pesanan tidak bisa berpindah dari ${from} ke ${to}. Selesaikan tahap sebelumnya lebih dulu.`,
      409,
    );
  }
}

/** Dokumen tidak boleh diubah setelah pesanan masuk tahap berjalan atau final. */
export function assertBookingDocumentsMutable(status: BookingStatus): void {
  if (isFinalBookingStatus(status) || status === BookingStatus.IN_PROGRESS) {
    throw new AppError(
      'BOOKING_FINAL',
      `Dokumen tidak bisa diubah karena pesanan sudah berstatus ${status}.`,
      409,
    );
  }
}

export type BookingBlockerCode =
  | 'DOKUMEN_BELUM_TERVERIFIKASI'
  | 'DOKUMEN_DITOLAK'
  | 'TARIF_BELUM_DIKONFIRMASI'
  | 'PEMBAYARAN_BELUM_DIVERIFIKASI'
  | 'ARMADA_IN_SERVICE';

export type BookingBlocker = {
  code: BookingBlockerCode;
  message: string;
};

type BlockerInput = {
  status: BookingStatus;
  rentalType: RentalType;
  tariffStatus: TariffStatus;
  quotedAmount: { toString(): string } | null;
  document?: { status: DocumentStatus } | null;
  payment?: { status: PaymentStatus } | null;
  vehicle?: { operationalStatus: OperationalStatus } | null;
};

/**
 * Daftar alasan pesanan belum bisa lanjut ke tahap berikutnya.
 *
 * Dikirim apa adanya ke dashboard dan mobile supaya tombol bisa dinonaktifkan
 * dengan alasan yang jelas, bukan pesan galat generik setelah tombol ditekan.
 */
export function computeBookingBlockers(input: BlockerInput): BookingBlocker[] {
  const blockers: BookingBlocker[] = [];
  const final = isFinalBookingStatus(input.status);

  if (final) return blockers;

  if (input.vehicle?.operationalStatus === OperationalStatus.IN_SERVICE) {
    blockers.push({
      code: 'ARMADA_IN_SERVICE',
      message: 'Armada sedang dalam masa pemeriksaan setelah sewa sebelumnya.',
    });
  }

  if (
    input.status === BookingStatus.CREATED ||
    input.status === BookingStatus.PENDING_CONFIRMATION
  ) {
    if (input.rentalType === RentalType.WITHOUT_DRIVER) {
      if (input.document?.status === DocumentStatus.REJECTED) {
        blockers.push({
          code: 'DOKUMEN_DITOLAK',
          message: 'Dokumen ditolak. Pelanggan perlu mengunggah ulang.',
        });
      } else if (input.document?.status !== DocumentStatus.VERIFIED) {
        blockers.push({
          code: 'DOKUMEN_BELUM_TERVERIFIKASI',
          message: 'Dokumen persyaratan belum lengkap atau belum diverifikasi.',
        });
      }
    }

    const quoted = input.quotedAmount === null ? 0 : Number(input.quotedAmount.toString());
    if (input.tariffStatus !== TariffStatus.CONFIRMED || !(quoted > 0)) {
      blockers.push({
        code: 'TARIF_BELUM_DIKONFIRMASI',
        message: 'Tarif sewa belum dikonfirmasi.',
      });
    }
  }

  if (input.status === BookingStatus.CONFIRMED && input.payment?.status !== PaymentStatus.PAID) {
    blockers.push({
      code: 'PEMBAYARAN_BELUM_DIVERIFIKASI',
      message: 'Pembayaran belum diverifikasi, armada belum bisa diserahkan.',
    });
  }

  return blockers;
}
