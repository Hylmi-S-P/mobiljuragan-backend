import 'dotenv/config';
import { db } from '../src/db.js';
import { DriverReadiness, OperationalStatus } from '../src/generated/prisma/client.js';

async function resetTestData() {
  console.log('--- Memulai Penghapusan Data Uji (Reset Database) ---');

  // 1. Hitung data sebelum dihapus
  const countsBefore = {
    payments: await db.payment.count(),
    bookingDocuments: await db.bookingDocument.count(),
    bookingStatusHistory: await db.bookingStatusHistory.count(),
    bookings: await db.booking.count(),
    ticketMessages: await db.ticketMessage.count(),
    supportTickets: await db.supportTicket.count(),
    otpVerifications: await db.otpVerification.count(),
    auditLogs: await db.auditLog.count(),
    customers: await db.user.count({ where: { role: 'CUSTOMER' } }),
    staffAndAdmins: await db.user.count({ where: { role: { not: 'CUSTOMER' } } }),
    vehicles: await db.vehicle.count(),
    drivers: await db.driver.count(),
  };

  console.log('Data sebelum reset:', JSON.stringify(countsBefore, null, 2));

  // 2. Hapus dokumen, pembayaran, dan riwayat status booking
  const deletedPayments = await db.payment.deleteMany({});
  console.log(`- Terhapus ${deletedPayments.count} data pembayaran (payments)`);

  const deletedDocs = await db.bookingDocument.deleteMany({});
  console.log(`- Terhapus ${deletedDocs.count} data dokumen booking (booking_documents)`);

  const deletedHistory = await db.bookingStatusHistory.deleteMany({});
  console.log(`- Terhapus ${deletedHistory.count} data riwayat booking (booking_status_history)`);

  // 3. Hapus booking utama
  const deletedBookings = await db.booking.deleteMany({});
  console.log(`- Terhapus ${deletedBookings.count} data pesanan (bookings)`);

  // 4. Hapus tiket dan pesan tiket
  const deletedMessages = await db.ticketMessage.deleteMany({});
  console.log(`- Terhapus ${deletedMessages.count} pesan tiket (ticket_messages)`);

  const deletedTickets = await db.supportTicket.deleteMany({});
  console.log(`- Terhapus ${deletedTickets.count} tiket bantuan (support_tickets)`);

  // 5. Hapus OTP verifikasi & audit logs
  const deletedOtp = await db.otpVerification.deleteMany({});
  console.log(`- Terhapus ${deletedOtp.count} verifikasi OTP (otp_verifications)`);

  const deletedAudit = await db.auditLog.deleteMany({});
  console.log(`- Terhapus ${deletedAudit.count} catatan audit (audit_logs)`);

  // 6. Hapus akun pengguna pelanggan (CUSTOMER) agar bisa registrasi / login ulang dari awal
  const deletedCustomers = await db.user.deleteMany({
    where: { role: 'CUSTOMER' },
  });
  console.log(`- Terhapus ${deletedCustomers.count} akun pelanggan (users CUSTOMER)`);

  // 7. Kembalikan seluruh status armada ke AVAILABLE dan supir ke SIAGA
  const updatedVehicles = await db.vehicle.updateMany({
    data: { operationalStatus: OperationalStatus.AVAILABLE },
  });
  console.log(`- Di-reset ${updatedVehicles.count} status kendaraan menjadi AVAILABLE`);

  const updatedDrivers = await db.driver.updateMany({
    data: { readiness: DriverReadiness.SIAGA },
  });
  console.log(`- Di-reset ${updatedDrivers.count} status kesiapan supir menjadi SIAGA`);

  // 8. Hitung data setelah reset
  const countsAfter = {
    payments: await db.payment.count(),
    bookingDocuments: await db.bookingDocument.count(),
    bookingStatusHistory: await db.bookingStatusHistory.count(),
    bookings: await db.booking.count(),
    ticketMessages: await db.ticketMessage.count(),
    supportTickets: await db.supportTicket.count(),
    otpVerifications: await db.otpVerification.count(),
    auditLogs: await db.auditLog.count(),
    customers: await db.user.count({ where: { role: 'CUSTOMER' } }),
    staffAndAdmins: await db.user.count({ where: { role: { not: 'CUSTOMER' } } }),
    vehicles: await db.vehicle.count(),
    drivers: await db.driver.count(),
  };

  console.log('\nData setelah reset:', JSON.stringify(countsAfter, null, 2));
  console.log('--- Reset database selesai dengan sukses! ---');
  process.exit(0);
}

resetTestData().catch((err) => {
  console.error('Terjadi kesalahan saat mereset data uji:', err);
  process.exit(1);
});
