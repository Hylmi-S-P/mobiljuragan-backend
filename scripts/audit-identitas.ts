import 'dotenv/config';
import { db } from '../src/db.js';

/**
 * Mendata akun pelanggan yang identitasnya berubah tanpa jejak audit.
 *
 * Sebelum 8 November 2026, `POST /auth/otp/request` mengganti `fullName` milik
 * nomor yang sudah terdaftar. Perubahan itu tidak pernah dicatat di `audit_logs`,
 * jadi tidak ada cara mengetahui nama asli pemilik akun dari database saja.
 *
 * Skrip ini menyusun kandidat beserta bukti yang bisa dipakai memulihkan nama:
 * nama pada booking, dokumen, dan tiket yang terikat ke akun tersebut.
 *
 * Jalankan: npm run audit:identitas
 * Keluaran: tabel di layar + berkas CSV di `backfill/identitas-<tanggal>.csv`
 */

const KUNCI_UMUR = Number(process.env.AUDIT_UMUR_HARI ?? 1);

async function main(): Promise<void> {
  console.log(`Mendata akun pelanggan yang berubah lebih dari ${KUNCI_UMUR} hari setelah dibuat...\n`);

  const { writeFile, mkdir } = await import('node:fs/promises');
  const { resolve } = await import('node:path');

  const kandidat = await db.user.findMany({
    where: {
      role: 'CUSTOMER',
      // Perubahan berarti `updatedAt` bergerak jauh dari `createdAt`.
      updatedAt: { gt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      createdAt: true,
      updatedAt: true,
      phoneVerifiedAt: true,
      passwordHash: true,
      _count: { select: { bookings: true, tickets: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const tersangka = kandidat.filter((u) => {
    const umurHari = (u.updatedAt.getTime() - u.createdAt.getTime()) / 86_400_000;
    return umurHari > KUNCI_UMUR;
  });

  if (tersangka.length === 0) {
    console.log('Tidak ada akun yang mencurigakan.');
    await db.$disconnect();
    return;
  }

  const baris: string[] = [
    'userId,namaSekarang,telepon,dibuat,diubah,umurHari,booking,tiket,namaDiDokumen',
  ];

  for (const u of tersangka) {
    // Nama yang tertulis pada dokumen/dokumen booking bisa jadi bukti nama asli.
    const dokumen = await db.bookingDocument.findFirst({
      where: { booking: { customerId: u.id }, statementLetterUrl: { not: null } },
      select: { bookingId: true },
    });

    const bookingTerakhir = await db.booking.findFirst({
      where: { customerId: u.id },
      orderBy: { createdAt: 'asc' },
      select: { bookingCode: true, createdAt: true },
    });

    const umurHari = ((u.updatedAt.getTime() - u.createdAt.getTime()) / 86_400_000).toFixed(1);

    console.log(
      [
        `nama  : ${u.fullName}`,
        `nomor : ${u.phoneNumber}`,
        `dibuat: ${u.createdAt.toISOString().slice(0, 19)}`,
        `diubah: ${u.updatedAt.toISOString().slice(0, 19)}  (+${umurHari} hari)`,
        `data  : ${u._count.bookings} booking, ${u._count.tickets} tiket`,
        `booking pertama: ${bookingTerakhir?.bookingCode ?? '-'}`,
        `punya dokumen  : ${dokumen ? 'ya' : 'tidak'}`,
        `kata sandi     : ${u.passwordHash ? 'ada' : 'belum ada'}`,
        '',
      ].join('\n'),
    );

    baris.push(
      [
        u.id,
        `"${u.fullName}"`,
        u.phoneNumber,
        u.createdAt.toISOString(),
        u.updatedAt.toISOString(),
        umurHari,
        String(u._count.bookings),
        String(u._count.tickets),
        dokumen ? 'ya' : 'tidak',
      ].join(','),
    );
  }

  const dir = resolve(process.cwd(), 'backfill');
  await mkdir(dir, { recursive: true });
  const berkas = resolve(dir, `identitas-${new Date().toISOString().slice(0, 10)}.csv`);
  await writeFile(berkas, `${baris.join('\n')}\n`, 'utf-8');

  console.log(`${tersangka.length} akun perlu diperiksa. CSV: ${berkas}`);
  console.log(
    '\nNama asli TIDAK bisa dipastikan dari tabel users. Cocokkan dengan KTP/SIM\n' +
      'pada dokumen booking, atau hubungi pemilik nomor lewat WhatsApp.',
  );

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
