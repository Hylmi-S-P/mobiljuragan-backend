import 'dotenv/config';
import { db } from '../src/db.js';
import { mediaStorage } from '../src/lib/mediaStorage.js';

/*
 * Membersihkan rujukan berkas yang objeknya sudah tidak ada di penyimpanan.
 *
 * Latar belakang: tabel domain menyimpan URL (bukan objek penyimpanan itu
 * sendiri), jadi baris database bisa tetap mengklaim "Terverifikasi" atau
 * "Bukti transfer ada" padahal berkasnya sudah lenyap â€” misalnya karena
 * database dipulihkan dari mesin lain sementara bucket tidak ikut pindah.
 * Dashboard lalu menampilkan tombol "Lihat Berkas" yang selalu gagal, dan
 * status VERIFIED menjadi klaim yang tidak bisa dibuktikan.
 *
 * Aturan aman:
 * - Tidak pernah menghapus baris pesanan, pembayaran, atau nominal uang.
 * - Nominal (`baseAmount`, `totalAmount`) tidak disentuh sama sekali.
 * - Berkas yang rusak hanya dilaporkan, bukan ditebak isinya.
 * - Semua perubahan dicatat di `audit_logs` supaya bisa ditelusuri.
 *
 * Tanpa argumen hanya melapor. Tambahkan `--terapkan` untuk menulis.
 *
 * Jalankan: npx tsx scripts/rapikan-rujukan-berkas-hilang.ts [--terapkan]
 */

const terapkan = process.argv.includes('--terapkan');

/** URL dokumen pesanan berbentuk `/api/v1/documents/file/<bookingId>/<nama>`. */
function kunciDokumen(url: string): string | null {
  const awalan = '/api/v1/documents/file/';
  if (!url.startsWith(awalan)) return null;
  return `dokumen/${url.slice(awalan.length)}`;
}

async function main() {
  const hilang: string[] = [];
  const dokumenDiubah: { bookingCode: string; kolom: string[]; statusLama: string; statusBaru: string }[] = [];
  const mediaDihapus: { id: string; kategori: string; objectKey: string }[] = [];
  const pembayaranDibersihkan: { bookingCode: string; mediaId: string }[] = [];
  const templateDimatikan: { kode: string; objectKey: string }[] = [];

  // 1. Dokumen pesanan
  const dokumen = await db.bookingDocument.findMany({
    include: { booking: { select: { bookingCode: true } } },
  });

  for (const baris of dokumen) {
    const kolom = [
      ['statementLetterUrl', baris.statementLetterUrl],
      ['ktpUrl', baris.ktpUrl],
      ['simUrl', baris.simUrl],
    ] as const;

    const kosong: string[] = [];
    for (const [nama, url] of kolom) {
      if (!url) continue;
      const kunci = kunciDokumen(url);
      const ada = kunci ? await mediaStorage.ada(kunci) : false;
      if (!ada) kosong.push(nama);
    }
    if (kosong.length === 0) continue;

    const sisa = kolom.filter(([, url]) => url !== null).length - kosong.length;
    const statusBaru = sisa === 0 ? 'PENDING_UPLOAD' : 'PENDING_VERIFICATION';
    dokumenDiubah.push({
      bookingCode: baris.booking.bookingCode,
      kolom: kosong,
      statusLama: baris.status,
      statusBaru,
    });

    if (terapkan) {
      const data: Record<string, unknown> = { status: statusBaru, verifiedAt: null, verifiedBy: null };
      for (const nama of kosong) data[nama] = null;
      await db.bookingDocument.update({ where: { id: baris.id }, data });
    }
  }

  // 2. Objek media (bukti transfer dsb.)
  const media = await db.mediaObject.findMany();
  for (const objek of media) {
    if (await mediaStorage.ada(objek.objectKey)) continue;
    hilang.push(`media ${objek.kategori} ${objek.objectKey}`);
    mediaDihapus.push({ id: objek.id, kategori: objek.kategori, objectKey: objek.objectKey });

    const pembayaran = await db.payment.findMany({
      where: { proofImageUrl: { contains: objek.id } },
      select: { id: true, booking: { select: { bookingCode: true } } },
    });
    for (const p of pembayaran) {
      pembayaranDibersihkan.push({ bookingCode: p.booking.bookingCode, mediaId: objek.id });
      if (terapkan) {
        await db.payment.update({ where: { id: p.id }, data: { proofImageUrl: null } });
      }
    }
    if (terapkan) await db.mediaObject.delete({ where: { id: objek.id } });
  }

  // 3. Template dokumen resmi
  const template = await db.documentTemplate.findMany();
  for (const t of template) {
    if (await mediaStorage.ada(t.berkasObjectKey)) continue;
    hilang.push(`template ${t.kode} ${t.berkasObjectKey}`);
    if (t.isActive) {
      templateDimatikan.push({ kode: t.kode, objectKey: t.berkasObjectKey });
      if (terapkan) {
        await db.documentTemplate.update({ where: { id: t.id }, data: { isActive: false } });
      }
    }
  }

  // Ringkasan laporan
  console.log(`Mode: ${terapkan ? 'TERAPKAN' : 'COBA DULU (tanpa menulis)'}`);
  console.log(`Berkas yang objeknya hilang: ${hilang.length}`);
  for (const x of hilang) console.log(`  - ${x}`);

  console.log(`\nDokumen pesanan yang rujukannya dibersihkan: ${dokumenDiubah.length}`);
  for (const d of dokumenDiubah) {
    console.log(`  - ${d.bookingCode}: kolom ${d.kolom.join(', ')} -> null; status ${d.statusLama} -> ${d.statusBaru}`);
  }

  console.log(`\nObjek media yang barisnya dihapus: ${mediaDihapus.length}`);
  for (const m of mediaDihapus) console.log(`  - ${m.kategori} ${m.objectKey}`);

  console.log(`\nPembayaran yang tautan buktinya dikosongkan: ${pembayaranDibersihkan.length}`);
  for (const p of pembayaranDibersihkan) console.log(`  - ${p.bookingCode} (media ${p.mediaId})`);

  console.log(`\nTemplate yang dinonaktifkan: ${templateDimatikan.length}`);
  for (const t of templateDimatikan) console.log(`  - ${t.kode} ${t.objectKey}`);

  if (terapkan && (dokumenDiubah.length + mediaDihapus.length + templateDimatikan.length) > 0) {
    await db.auditLog.create({
      data: {
        action: 'BERSIHKAN_RUJUKAN_BERKAS_HILANG',
        entityType: 'System',
        metadata: {
          dokumenDiubah,
          mediaDihapus,
          pembayaranDibersihkan,
          templateDimatikan,
        },
      },
    });
    console.log('\nCatatan audit ditulis.');
  }

  if (!terapkan) console.log('\nJalankan ulang dengan --terapkan untuk menulis perubahan.');
}

await main();
await db.$disconnect();
