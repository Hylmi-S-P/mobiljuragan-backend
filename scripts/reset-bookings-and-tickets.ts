import 'dotenv/config';
import { db } from '../src/db.js';
import { DriverReadiness, OperationalStatus } from '../src/generated/prisma/client.js';

async function main() {
  console.log('Memulai pembersihan data tiket dan pemesanan...');

  // 1. Hapus pesan tiket
  const deletedMessages = await db.ticketMessage.deleteMany({});
  console.log(`- Pesan tiket dihapus: ${deletedMessages.count}`);

  // 2. Hapus tiket bantuan
  const deletedTickets = await db.supportTicket.deleteMany({});
  console.log(`- Tiket bantuan dihapus: ${deletedTickets.count}`);

  // 3. Hapus data pembayaran
  const deletedPayments = await db.payment.deleteMany({});
  console.log(`- Data pembayaran dihapus: ${deletedPayments.count}`);

  // 4. Hapus dokumen booking lepas kunci
  const deletedDocuments = await db.bookingDocument.deleteMany({});
  console.log(`- Dokumen persyaratan dihapus: ${deletedDocuments.count}`);

  // 5. Hapus riwayat status booking
  const deletedHistories = await db.bookingStatusHistory.deleteMany({});
  console.log(`- Riwayat status booking dihapus: ${deletedHistories.count}`);

  // 6. Hapus pemesanan (bookings)
  const deletedBookings = await db.booking.deleteMany({});
  console.log(`- Data pemesanan (bookings) dihapus: ${deletedBookings.count}`);

  // 7. Kembalikan status seluruh armada ke AVAILABLE
  const updatedVehicles = await db.vehicle.updateMany({
    data: {
      operationalStatus: OperationalStatus.AVAILABLE,
    },
  });
  console.log(`- Status unit armada dikembalikan ke AVAILABLE: ${updatedVehicles.count} unit`);

  // 8. Kembalikan status seluruh staf pengemudi ke SIAGA
  const updatedDrivers = await db.driver.updateMany({
    data: {
      readiness: DriverReadiness.SIAGA,
    },
  });
  console.log(`- Kesiapan pengemudi dikembalikan ke SIAGA: ${updatedDrivers.count} supir`);

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
