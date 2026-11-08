import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { db } from '../src/db.js';

/**
 * Menyusun **usulan** pemulihan nama untuk akun yang identitasnya pernah berubah.
 *
 * Latar belakang: sebelum 8 November 2026, `POST /auth/otp/request` mengganti
 * `fullName` milik nomor yang sudah terdaftar. Nama asli tidak tersimpan di mana
 * pun, sehingga harus direkonstruksi dari bukti yang tidak bisa dipalsukan lewat
 * formulir aplikasi.
 *
 * Urutan bukti (dari terkuat ke terlemah):
 *   1. Nama pada surat pernyataan / form kesanggupan (ditandatangani penyewa)
 *   2. Nama pemilik rekening pengirim pada pembayaran
 *   3. Nama pengirim pesan pada tiket bantuan
 *   4. Tidak ada bukti → perlu konfirmasi langsung ke pemilik nomor
 *
 * Skrip ini **tidak menulis apa pun** ke database. Ia menghasilkan CSV untuk
 * diperiksa manusia, lalu koreksi dilakukan lewat dashboard atau endpoint
 * `PATCH /admin/customers/:id/name` agar alasannya tercatat.
 *
 * Jalankan: npm run audit:pemulihan
 */

interface Bukti {
  sumber: string;
  nilai: string;
  tanggal: string;
}

async function main(): Promise<void> {
  console.log('Menyusun usulan pemulihan identitas...\n');

  /* Kandidat: pelanggan yang `updatedAt`-nya jauh setelah `createdAt`, atau yang
     sudah punya catatan audit tetapi belum pernah dipulihkan. */
  const kandidat = await db.user.findMany({
    where: { role: 'CUSTOMER' },
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      createdAt: true,
      updatedAt: true,
      passwordUpdatedAt: true,
      bookings: {
        select: {
          bookingCode: true,
          createdAt: true,
          document: {
            select: { statementLetterUrl: true, ktpUrl: true, status: true },
          },
          payment: { select: { senderAccount: true, acknowledgedBy: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 3,
      },
      tickets: {
        select: {
          ticketNumber: true,
          createdAt: true,
          messages: {
            where: { isCustomer: true },
            select: { body: true, sentAt: true },
            orderBy: { sentAt: 'asc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 2,
      },
      identityAudits: {
        select: { action: true, before: true, after: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const baris: string[] = [
    'userId,namaSekarang,telepon,dibuat,diubah,umurHari,buktiSumber,buktiNilai,usulanNama,catatan',
  ];
  let perluDiperiksa = 0;

  for (const user of kandidat) {
    const umurHari = (user.updatedAt.getTime() - user.createdAt.getTime()) / 86_400_000;
    const adaAudit = user.identityAudits.some((a) => a.action === 'PROFILE_NAME_CHANGED');

    /* Akun normal: dibuat dan tidak berubah, atau perubahannya sudah tercatat. */
    if (umurHari <= 1 || adaAudit) continue;

    perluDiperiksa++;

    const bukti: Bukti[] = [];

    const bookingDenganDokumen = user.bookings.find(
      (b) => b.document?.statementLetterUrl || b.document?.ktpUrl,
    );
    if (bookingDenganDokumen) {
      bukti.push({
        sumber: 'dokumen booking',
        nilai: `KTP/Form pada ${bookingDenganDokumen.bookingCode}`,
        tanggal: bookingDenganDokumen.createdAt.toISOString().slice(0, 10),
      });
    }

    const pembayaran = user.bookings.find((b) => b.payment?.senderAccount);
    if (pembayaran?.payment?.senderAccount) {
      bukti.push({
        sumber: 'nama pengirim pembayaran',
        nilai: pembayaran.payment.senderAccount,
        tanggal: pembayaran.createdAt.toISOString().slice(0, 10),
      });
    }

    const tiket = user.tickets.find((t) => t.messages.length > 0);
    if (tiket) {
      const pesan = tiket.messages[0].body.trim().replace(/\s+/g, ' ').slice(0, 60);
      const namaDariSapaan = /(?:nama saya|saya)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i.exec(pesan);
      bukti.push({
        sumber: `tiket ${tiket.ticketNumber}`,
        nilai: namaDariSapaan?.[1] ?? pesan,
        tanggal: tiket.createdAt.toISOString().slice(0, 10),
      });
    }

    const auditNama = user.identityAudits.find((a) => a.action === 'PROFILE_NAME_CHANGED');

    console.log(
      [
        `nama sekarang : ${user.fullName}`,
        `nomor         : ${user.phoneNumber}`,
        `dibuat        : ${user.createdAt.toISOString().slice(0, 19)}`,
        `diubah        : ${user.updatedAt.toISOString().slice(0, 19)}  (+${umurHari.toFixed(1)} hari)`,
        `bukti         : ${bukti.length > 0 ? bukti.map((b) => b.sumber).join(', ') : 'TIDAK ADA'}`,
        `audit         : ${auditNama ? `ada (${auditNama.before} -> ${auditNama.after})` : 'tidak ada'}`,
        '',
      ].join('\n'),
    );

    baris.push(
      [
        user.id,
        `"${user.fullName}"`,
        user.phoneNumber,
        user.createdAt.toISOString(),
        user.updatedAt.toISOString(),
        umurHari.toFixed(1),
        bukti.length > 0 ? bukti.map((b) => b.sumber).join('; ') : 'tidak ada',
        bukti.length > 0 ? `"${bukti[0].nilai.replace(/"/g, "'")}"` : '',
        '',
        bukti.length === 0
          ? 'Hubungi pemilik nomor untuk konfirmasi'
          : 'Cocokkan dengan berkas sebelum dikoreksi',
      ].join(','),
    );
  }

  if (perluDiperiksa === 0) {
    console.log('Tidak ada akun yang perlu dipulihkan.');
    await db.$disconnect();
    return;
  }

  const dir = resolve(process.cwd(), 'backfill');
  await mkdir(dir, { recursive: true });
  const berkas = resolve(dir, `usulan-pemulihan-${new Date().toISOString().slice(0, 10)}.csv`);
  await writeFile(berkas, `${baris.join('\n')}\n`, 'utf-8');

  console.log(`${perluDiperiksa} akun perlu diperiksa. CSV: ${berkas}`);
  console.log(
    '\nSkrip ini TIDAK mengubah database. Setelah bukti dicocokkan, koreksi lewat\n' +
      'dashboard (Akun Pelanggan) atau:\n' +
      '  PATCH /api/v1/admin/customers/:id/name { fullName, reason }\n' +
      'Alasan wajib diisi agar perubahan tercatat di identity_audits.',
  );

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
