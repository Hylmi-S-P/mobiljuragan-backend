import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { db } from '../src/db.js';
import { PaymentMethod, PaymentStatus } from '../src/generated/prisma/client.js';
import { extractQrisAmount, generateDynamicQris } from '../src/utils/qris.js';

/*
 * Menyelaraskan tagihan lama yang masih memakai kode unik.
 *
 * Sebelumnya `totalAmount = baseAmount + uniqueCode`, dan aplikasi mobile
 * menambahkan kode 3 digitnya sendiri. Verifikasi sekarang manual memakai
 * nominal, jadi sisa-sisa kode pada tagihan yang belum dibayar harus dibuang —
 * kalau tidak, pelanggan melihat angka yang tidak pernah diminta siapa pun.
 *
 * Aturan aman:
 * - Hanya menyentuh UNPAID dan PENDING_VERIFICATION. Pembayaran yang sudah PAID
 *   adalah uang yang benar-benar masuk; nominalnya tidak boleh diubah.
 * - `baseAmount` tidak pernah diubah.
 * - Daftar perubahan ditulis ke CSV lebih dulu supaya bisa direkonsiliasi kalau
 *   keputusan ini perlu dibalik.
 *
 * Jalankan: npm run db:lepas-kode-unik
 */

type Perubahan = {
  paymentId: string;
  bookingCode: string;
  status: string;
  baseAmount: string;
  totalAmountLama: string;
  totalAmountBaru: string;
  uniqueCodeLama: number;
  qrisAmountLama: string;
};

async function main() {
  const kandidat = await db.payment.findMany({
    where: { status: { in: [PaymentStatus.UNPAID, PaymentStatus.PENDING_VERIFICATION] } },
    include: { booking: { select: { bookingCode: true } } },
    orderBy: { createdAt: 'asc' },
  });

  /* Tagihan dianggap perlu diselaraskan kalau nominalnya menyimpang dari tarif
     dasar, masih menyimpan kode, atau gambar QRIS-nya menagih angka lain —
     teks "Rp 1.600.000" dengan QR berisi 1.600.057 adalah kombinasi paling
     berbahaya karena pelanggan memindai yang mana pun. */
  const perluDiperbaiki = kandidat.filter((payment) => {
    const base = Number(payment.baseAmount);
    if (Number(payment.totalAmount) !== base || payment.uniqueCode > 0) return true;

    if (payment.method === PaymentMethod.QRIS && payment.qrisPayload) {
      const amountInQr = extractQrisAmount(payment.qrisPayload);
      return amountInQr !== null && amountInQr !== base;
    }

    return false;
  });

  if (perluDiperbaiki.length === 0) {
    console.log('Tidak ada tagihan lama yang perlu diselaraskan.');
    return;
  }

  const perubahan: Perubahan[] = perluDiperbaiki.map((payment) => ({
    paymentId: payment.id,
    bookingCode: payment.booking.bookingCode,
    status: payment.status,
    baseAmount: payment.baseAmount.toString(),
    totalAmountLama: payment.totalAmount.toString(),
    totalAmountBaru: payment.baseAmount.toString(),
    uniqueCodeLama: payment.uniqueCode,
    qrisAmountLama:
      payment.method === PaymentMethod.QRIS && payment.qrisPayload
        ? String(extractQrisAmount(payment.qrisPayload) ?? '')
        : '',
  }));

  const csv = [
    'paymentId,bookingCode,status,baseAmount,totalAmountLama,totalAmountBaru,uniqueCodeLama,qrisAmountLama',
    ...perubahan.map((row) =>
      [
        row.paymentId,
        row.bookingCode,
        row.status,
        row.baseAmount,
        row.totalAmountLama,
        row.totalAmountBaru,
        row.uniqueCodeLama,
        row.qrisAmountLama,
      ].join(','),
    ),
  ].join('\n');

  /* Berkas rekonsiliasi disimpan di folder terpisah dan tidak ikut di-commit:
     isinya nominal pelanggan. */
  const folder = resolve(process.cwd(), 'backfill');
  await mkdir(folder, { recursive: true });
  const berkas = resolve(
    folder,
    `kode-unik-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
  );
  await writeFile(berkas, `${csv}\n`, 'utf-8');
  console.log(`Daftar perubahan disimpan di ${berkas} (${perubahan.length} tagihan).`);

  for (const payment of perluDiperbaiki) {
    const catatanTambahan =
      'Kode unik dihapus; nominal tagihan disamakan dengan tarif sewa yang disepakati.';

    await db.$transaction(async (tx) => {
      /* QRIS hanya dibuat ulang untuk tagihan yang belum dibayar. Pada
         PENDING_VERIFICATION, pelanggan mungkin sudah memindai QR lama; gambar
         bukti transfer adalah acuan admin, bukan QR yang tersimpan di sini. */
      const perbaruiQris =
        payment.method === PaymentMethod.QRIS && payment.status === PaymentStatus.UNPAID;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          uniqueCode: 0,
          totalAmount: payment.baseAmount,
          ...(perbaruiQris
            ? { qrisPayload: generateDynamicQris(Number(payment.baseAmount)) }
            : {}),
          notes: payment.notes ? `${payment.notes} | ${catatanTambahan}` : catatanTambahan,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'REMOVE_UNIQUE_CODE',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: {
            bookingCode: payment.booking.bookingCode,
            totalAmountLama: payment.totalAmount.toString(),
            totalAmountBaru: payment.baseAmount.toString(),
            uniqueCodeLama: payment.uniqueCode,
            qrisDibuatUlang: perbaruiQris,
          },
        },
      });
    });

    const bagian = [`nominal ${payment.totalAmount} -> ${payment.baseAmount}`];
    if (payment.uniqueCode > 0) bagian.push(`kode ${payment.uniqueCode} dihapus`);
    if (payment.method === PaymentMethod.QRIS && payment.status === PaymentStatus.UNPAID) {
      bagian.push('QRIS dibuat ulang');
    }
    console.log(`- ${payment.booking.bookingCode}: ${bagian.join(', ')}`);
  }

  console.log('Selesai. Jalankan ulang script ini kapan saja; data yang sudah benar dilewati.');
}

main()
  .catch((error) => {
    console.error('Gagal menyelaraskan tagihan:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
