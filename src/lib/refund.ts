import { BookingStatus, BookingStatusActor, PaymentStatus, RefundStatus } from '../generated/prisma/client.js';

/**
 * Potongan tetap saat pelanggan membatalkan pesanannya sendiri setelah membayar.
 *
 * Angka ini keputusan bisnis (B12): biaya administrasi + kerugian karena unit
 * sudah ditahan dari katalog. Pembatalan oleh admin atau sistem tidak memotong
 * apa pun karena bukan pelanggan yang berubah pikiran.
 */
export const POTONGAN_BATAL_PELANGGAN = 50_000;

export type PembatalOleh = 'PELANGGAN' | 'ADMIN' | 'SISTEM';

export function pembatalDari(actor: BookingStatusActor): PembatalOleh {
  if (actor === BookingStatusActor.CUSTOMER) return 'PELANGGAN';
  if (actor === BookingStatusActor.SYSTEM) return 'SISTEM';
  return 'ADMIN';
}

export interface HasilHitungRefund {
  totalDibayar: number;
  potongan: number;
  nominal: number;
}

/**
 * Menghitung uang yang harus dikembalikan.
 *
 * Potongan tidak pernah melebihi uang yang benar-benar masuk: pesanan murah
 * yang dibatalkan pelanggan bisa jadi tidak menghasilkan refund sama sekali,
 * bukan angka negatif yang menagih pelanggan.
 */
export function hitungNominalRefund(
  totalDibayar: number,
  dibatalkanOleh: PembatalOleh,
): HasilHitungRefund {
  const potonganMentah = dibatalkanOleh === 'PELANGGAN' ? POTONGAN_BATAL_PELANGGAN : 0;
  const potongan = Math.min(Math.max(potonganMentah, 0), Math.max(totalDibayar, 0));
  return {
    totalDibayar,
    potongan,
    nominal: Math.max(totalDibayar - potongan, 0),
  };
}

/** Pesanan yang boleh punya catatan refund: hanya yang uangnya sudah masuk. */
export function perluRefund(statusPembayaran: PaymentStatus | null | undefined): boolean {
  return statusPembayaran === PaymentStatus.PAID;
}

/**
 * Menentukan bentuk catatan pengembalian saat pesanan ditutup.
 *
 * - `TERVERIFIKASI`: uang sudah dinyatakan masuk, nominal langsung bisa ditransfer.
 * - `BELUM_DIVERIFIKASI`: bukti transfer sudah diunggah tetapi belum diperiksa.
 *   Pesanan tetap harus ditutup, dan catatan refund tetap dibuat supaya uang
 *   pelanggan tidak hilang dari pandangan kantor — hanya saja nominalnya wajib
 *   dicocokkan dengan mutasi bank lebih dulu.
 * - `null`: tidak ada uang yang perlu dikembalikan.
 */
export type JenisRefund = 'TERVERIFIKASI' | 'BELUM_DIVERIFIKASI';

export function jenisRefund(
  statusPembayaran: PaymentStatus | null | undefined,
): JenisRefund | null {
  if (statusPembayaran === PaymentStatus.PAID) return 'TERVERIFIKASI';
  if (statusPembayaran === PaymentStatus.PENDING_VERIFICATION) return 'BELUM_DIVERIFIKASI';
  return null;
}

/**
 * Status pesanan yang membuka hak refund. Pesanan yang masih hidup belum
 * kehilangan uang apa pun, jadi tidak perlu catatan pengembalian.
 */
export function statusMembukaRefund(status: BookingStatus): boolean {
  return (
    status === BookingStatus.CANCELLED ||
    status === BookingStatus.REJECTED
  );
}

/**
 * Mengonversi nilai Decimal pada catatan refund menjadi angka bulat murni
 * untuk serialisasi JSON ke klien Dashboard dan Mobile.
 */
export function normalkanRefund<
  T extends { totalDibayar: unknown; potongan: unknown; nominal: unknown },
>(
  refund: T | null | undefined,
): (Omit<T, 'totalDibayar' | 'potongan' | 'nominal'> & {
  totalDibayar: number;
  potongan: number;
  nominal: number;
}) | null {
  if (!refund) return null;
  return {
    ...refund,
    totalDibayar: Math.round(Number(refund.totalDibayar)),
    potongan: Math.round(Number(refund.potongan)),
    nominal: Math.round(Number(refund.nominal)),
  };
}

export { RefundStatus };
