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
 * Status pesanan yang membuka hak refund. Pesanan yang masih hidup belum
 * kehilangan uang apa pun, jadi tidak perlu catatan pengembalian.
 */
export function statusMembukaRefund(status: BookingStatus): boolean {
  return (
    status === BookingStatus.CANCELLED ||
    status === BookingStatus.REJECTED
  );
}

export { RefundStatus };
