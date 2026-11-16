import 'dotenv/config';
import { db } from '../src/db.js';
import { DriverReadiness, OperationalStatus } from '../src/generated/prisma/client.js';
import { mediaStorage } from '../src/lib/mediaStorage.js';

/**
 * Jalankan dengan `--dengan-pelanggan` untuk sekaligus menghapus akun pelanggan.
 *
 * Pemisahan ini disengaja: data sewa/tiket boleh direset kapan pun untuk
 * pengujian, sedangkan akun pelanggan adalah data nyata. Tanpa flag, akun
 * tetap utuh.
 *
 * Tambahkan `--dengan-audit` untuk ikut menghapus jejak audit. Catatan audit
 * menunjuk pesanan dan akun yang dihapus, jadi setelah reset penuh isinya hanya
 * riwayat yang tidak bisa ditelusuri lagi. Tanpa flag, catatan tetap disimpan.
 */
const hapusPelanggan = process.argv.includes('--dengan-pelanggan');
const hapusAudit = process.argv.includes('--dengan-audit');

async function main() {
  console.log('Memulai pembersihan data tiket dan pemesanan...');

  // 1. Hapus pesan tiket
  const deletedMessages = await db.ticketMessage.deleteMany({});
  console.log(`- Pesan tiket dihapus: ${deletedMessages.count}`);

  // 2. Hapus tiket bantuan
  const deletedTickets = await db.supportTicket.deleteMany({});
  console.log(`- Tiket bantuan dihapus: ${deletedTickets.count}`);

  // 3. Hapus pengembalian dana (sebelum pembayaran, karena merujuk ke sana)
  const deletedRefunds = await db.bookingRefund.deleteMany({});
  console.log(`- Data pengembalian dana dihapus: ${deletedRefunds.count}`);

  // 4. Hapus data pembayaran
  const deletedPayments = await db.payment.deleteMany({});
  console.log(`- Data pembayaran dihapus: ${deletedPayments.count}`);

  // 5. Hapus dokumen booking lepas kunci
  const deletedDocuments = await db.bookingDocument.deleteMany({});
  console.log(`- Dokumen persyaratan dihapus: ${deletedDocuments.count}`);

  // 6. Hapus penyesuaian biaya
  const deletedLineItems = await db.bookingLineItem.deleteMany({});
  console.log(`- Baris penyesuaian biaya dihapus: ${deletedLineItems.count}`);

  // 7. Hapus riwayat status booking
  const deletedHistories = await db.bookingStatusHistory.deleteMany({});
  console.log(`- Riwayat status booking dihapus: ${deletedHistories.count}`);

  // 8. Hapus pemesanan (bookings)
  const deletedBookings = await db.booking.deleteMany({});
  console.log(`- Data pemesanan (bookings) dihapus: ${deletedBookings.count}`);

  /* 9. Hapus objek media beserta berkasnya.
   *
   * Baris `media_objects` saja tidak cukup: berkasnya tetap memenuhi bucket
   * (atau disk) dan tidak bisa dipanggil dari mana pun karena tidak ada lagi
   * baris yang menunjuknya. Yang dihapus di sini adalah foto KTP, SIM, surat
   * pernyataan, dan bukti transfer dari pesanan yang barusan dihapus. */
  const objekMedia = await db.mediaObject.findMany({ select: { objectKey: true } });
  let berkasTerhapus = 0;
  for (const objek of objekMedia) {
    if (await mediaStorage.hapus(objek.objectKey)) berkasTerhapus++;
  }
  const deletedMedia = await db.mediaObject.deleteMany({});
  console.log(`- Objek media dihapus: ${deletedMedia.count} baris, ${berkasTerhapus} berkas di penyimpanan`);

  // 10. Kembalikan status seluruh armada ke AVAILABLE
  const updatedVehicles = await db.vehicle.updateMany({
    data: {
      operationalStatus: OperationalStatus.AVAILABLE,
    },
  });
  console.log(`- Status unit armada dikembalikan ke AVAILABLE: ${updatedVehicles.count} unit`);

  // 11. Kembalikan status seluruh staf pengemudi ke SIAGA
  const updatedDrivers = await db.driver.updateMany({
    data: {
      readiness: DriverReadiness.SIAGA,
    },
  });
  console.log(`- Kesiapan pengemudi dikembalikan ke SIAGA: ${updatedDrivers.count} supir`);

  /* 12. Hapus akun pelanggan beserta jejak autentikasinya.
   *
   * Staf dan admin TIDAK disentuh: akun portal dibutuhkan untuk masuk dashboard.
   * Urutannya penting — `otp_verifications` dan `identity_audits` merujuk ke
   * `users`, jadi harus dihapus lebih dulu agar tidak melanggar foreign key. */
  if (hapusPelanggan) {
    const otp = await db.otpVerification.deleteMany({});
    console.log(`- Kode OTP dihapus: ${otp.count}`);

    const guard = await db.phoneGuard.deleteMany({});
    console.log(`- Pembatas percobaan per nomor dihapus: ${guard.count}`);

    const audit = await db.identityAudit.deleteMany({});
    console.log(`- Jejak identitas dihapus: ${audit.count}`);

    const pelanggan = await db.user.deleteMany({ where: { role: 'CUSTOMER' } });
    console.log(`- Akun pelanggan dihapus: ${pelanggan.count}`);
  }

  if (hapusAudit) {
    const auditLog = await db.auditLog.deleteMany({});
    console.log(`- Catatan audit dihapus: ${auditLog.count}`);
  }

  const sisa = await db.user.findMany({
    select: { role: true, fullName: true, phoneNumber: true },
    orderBy: { role: 'asc' },
  });
  console.log('\nAkun yang tersisa (akun portal):');
  for (const u of sisa) console.log(`  ${u.role.padEnd(9)} ${u.phoneNumber.padEnd(15)} ${u.fullName}`);

  console.log('\nPembersihan data selesai dengan sukses!');
}

main()
  .catch((e) => {
    console.error('Terjadi galat saat pembersihan data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
