import { db } from '../db.js';
import { RentalType } from '../generated/prisma/client.js';

/**
 * Perhitungan tarif pesanan.
 *
 * Sebelumnya nominal tarif diketik bebas oleh staf. Akibatnya dua pesanan untuk
 * unit dan durasi yang sama bisa punya harga berbeda, dan angka yang tampil di
 * dashboard tidak selalu sama dengan harga katalog. Sekarang komponen dasarnya
 * dihitung dari katalog dan tidak bisa diubah; staf hanya boleh menambah atau
 * mengurangi lewat baris penyesuaian biaya yang punya justifikasi.
 */

/** Tarif jasa supir per hari yang berlaku untuk semua armada. */
export async function getDriverDailyRate(): Promise<number> {
  const pengaturan = await db.tariffSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  return pengaturan.driverDailyRate;
}

/**
 * Jumlah hari sewa, dibulatkan ke atas dan minimal satu hari.
 *
 * Aturannya sama dengan yang dipakai dashboard (`countDays` di
 * `lib/operations.ts`), supaya angka di layar dan angka yang disimpan tidak
 * pernah berbeda.
 */
export function hitungHariSewa(start: Date, end: Date): number {
  const selisihMs = end.getTime() - start.getTime();
  const hari = Math.ceil(selisihMs / (1000 * 60 * 60 * 24));
  return hari > 0 ? hari : 1;
}

export interface KomponenTarif {
  hariSewa: number;
  hargaPerHari: number;
  hargaSewa: number;
  tarifSupirPerHari: number;
  jasaSupir: number;
  /** Harga sewa + jasa supir. Baris penyesuaian biaya dihitung terpisah. */
  subtotal: number;
}

export function hitungKomponenTarif(input: {
  pricePerDay: number;
  start: Date;
  end: Date;
  rentalType: RentalType;
  driverDailyRate: number;
}): KomponenTarif {
  const hariSewa = hitungHariSewa(input.start, input.end);
  const hargaSewa = input.pricePerDay * hariSewa;
  const jasaSupir =
    input.rentalType === RentalType.WITH_DRIVER ? input.driverDailyRate * hariSewa : 0;

  return {
    hariSewa,
    hargaPerHari: input.pricePerDay,
    hargaSewa,
    tarifSupirPerHari: input.rentalType === RentalType.WITH_DRIVER ? input.driverDailyRate : 0,
    jasaSupir,
    subtotal: hargaSewa + jasaSupir,
  };
}
