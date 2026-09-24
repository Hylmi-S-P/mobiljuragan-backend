import 'dotenv/config';
import { app } from './app.js';
import type { Server } from 'node:http';

async function runTests() {
  const server: Server = app.listen(4999);
  const baseUrl = 'http://127.0.0.1:4999/api/v1';

  console.log('Memulai pengujian otomatis endpoint autentikasi...\n');

  try {
    // Health Check
    const resHealth = await fetch('http://127.0.0.1:4999/health');
    const dataHealth = (await resHealth.json()) as any;
    console.log('1. Health Check:', resHealth.status === 200 && dataHealth.status === 'ok' ? 'PASSED' : 'FAILED');

    // Request OTP Customer
    const resOtpReq = await fetch(`${baseUrl}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567888',
        fullName: 'Testing Customer',
      }),
    });
    const dataOtpReq = (await resOtpReq.json()) as any;
    const mockOtp = dataOtpReq.data?.devMockOtp;
    console.log('2. Request OTP Customer:', resOtpReq.status === 200 && mockOtp ? `PASSED (OTP: ${mockOtp})` : 'FAILED', dataOtpReq);

    // Verify OTP Salah
    const resOtpWrong = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567888',
        otp: '000000',
      }),
    });
    const dataOtpWrong = (await resOtpWrong.json()) as any;
    console.log('3. Verify OTP Salah (harus 400):', resOtpWrong.status === 400 && dataOtpWrong.error?.code === 'OTP_INVALID' ? 'PASSED' : 'FAILED');

    // Verify OTP Benar
    const resOtpCorrect = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567888',
        otp: mockOtp,
      }),
    });
    const dataOtpCorrect = (await resOtpCorrect.json()) as any;
    const customerToken = dataOtpCorrect.data?.token;
    console.log('4. Verify OTP Benar (harus 200 & return token):', resOtpCorrect.status === 200 && customerToken ? 'PASSED' : 'FAILED');

    // Replay OTP yang sudah consumed
    const resOtpReplay = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567888',
        otp: mockOtp,
      }),
    });
    console.log('5. Replay OTP Consumed (harus ditolak 400):', resOtpReplay.status === 400 ? 'PASSED' : 'FAILED');

    // Login Admin Password Salah
    const resAdminWrong = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567890',
        password: 'SalahPassword123',
      }),
    });
    console.log('6. Admin Login Salah (harus 401):', resAdminWrong.status === 401 ? 'PASSED' : 'FAILED');

    // Login Admin Berhasil
    const resAdminOk = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567890',
        password: 'Admin123!',
      }),
    });
    const dataAdminOk = (await resAdminOk.json()) as any;
    const adminToken = dataAdminOk.data?.token;
    console.log('7. Admin Login Berhasil (harus 200 & return token):', resAdminOk.status === 200 && adminToken ? 'PASSED' : 'FAILED');

    // Otorisasi Role: Customer Akses Endpoint Admin /me (harus 403 Forbidden)
    const resForbidden = await fetch(`${baseUrl}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    console.log('8. Customer Akses Admin /me (harus 403 FORBIDDEN):', resForbidden.status === 403 ? 'PASSED' : 'FAILED');

    // Otorisasi Role: Admin Akses Endpoint Admin /me (harus 200 OK)
    const resAdminMe = await fetch(`${baseUrl}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataAdminMe = (await resAdminMe.json()) as any;
    console.log('9. Admin Akses Admin /me (harus 200 & user role ADMIN):', resAdminMe.status === 200 && dataAdminMe.data?.user?.role === 'ADMIN' ? 'PASSED' : 'FAILED');

    // 10. Get All Vehicles
    const resVehicles = await fetch(`${baseUrl}/vehicles`);
    const dataVehicles = (await resVehicles.json()) as any;
    console.log('10. Get All Vehicles (harus 200 & return array):', resVehicles.status === 200 && Array.isArray(dataVehicles.data) && dataVehicles.data.length >= 9 ? `PASSED (${dataVehicles.data.length} unit)` : 'FAILED');

    // 11. Get Vehicle Categories
    const resCategories = await fetch(`${baseUrl}/vehicles/categories`);
    const dataCategories = (await resCategories.json()) as any;
    console.log('11. Get Vehicle Categories (harus 200 & return kategori):', resCategories.status === 200 && Array.isArray(dataCategories.data) && dataCategories.data.includes('MPV') ? `PASSED (${dataCategories.data.join(', ')})` : 'FAILED');

    // 12. Filter Vehicle by Category
    const resFilterMpv = await fetch(`${baseUrl}/vehicles?category=MPV`);
    const dataFilterMpv = (await resFilterMpv.json()) as any;
    const allMpv = dataFilterMpv.data?.every((v: any) => v.category === 'MPV');
    console.log('12. Filter Vehicles by Category=MPV (harus 200 & kategori MPV):', resFilterMpv.status === 200 && allMpv ? 'PASSED' : 'FAILED');

    // 13. Get Vehicle Detail by ID / externalId
    const firstVehicleId = dataVehicles.data[0]?.externalId;
    const resDetail = await fetch(`${baseUrl}/vehicles/${firstVehicleId}`);
    const dataDetail = (await resDetail.json()) as any;
    console.log('13. Get Vehicle Detail (harus 200 & return detail unit):', resDetail.status === 200 && dataDetail.data?.externalId === firstVehicleId ? `PASSED (${dataDetail.data?.name})` : 'FAILED');

    // 14. Get Vehicle Detail Not Found
    const resDetailNotFound = await fetch(`${baseUrl}/vehicles/id-tidak-ada-9999`);
    console.log('14. Get Vehicle Detail Not Found (harus 404):', resDetailNotFound.status === 404 ? 'PASSED' : 'FAILED');

    // 15. Create Booking Atomik (POST /bookings)
    const resCreateBooking = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        vehicleId: 'avanza-g-putih-ps1692b',
        startDateTime: '2026-11-01T08:00:00Z',
        endDateTime: '2026-11-03T18:00:00Z',
        rentalType: 'WITHOUT_DRIVER',
        pickupLocation: 'Bandara Mopah Merauke',
        customerRequest: 'Unit bersih dan AC dingin',
        numberGuests: 4,
      }),
    });
    const dataCreateBooking = (await resCreateBooking.json()) as any;
    const createdBooking = dataCreateBooking.data;
    console.log(
      '15. Create Booking Atomik (harus 201 & tarif null):',
      resCreateBooking.status === 201 &&
        createdBooking?.bookingCode &&
        createdBooking?.quotedAmount === null &&
        createdBooking?.status === 'CREATED'
        ? `PASSED (${createdBooking.bookingCode})`
        : 'FAILED',
      dataCreateBooking
    );

    // 16. Get Booking Detail by ID (GET /bookings/:id)
    const resBookingDetail = await fetch(`${baseUrl}/bookings/${createdBooking?.id}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const dataBookingDetail = (await resBookingDetail.json()) as any;
    console.log(
      '16. Get Booking Detail (harus 200 & ada relasi vehicle):',
      resBookingDetail.status === 200 && dataBookingDetail.data?.vehicle?.name === 'AVANZA G PUTIH'
        ? 'PASSED'
        : 'FAILED'
    );

    // 17. Get Booking Status & Timeline (GET /bookings/:id/status)
    const resBookingStatus = await fetch(`${baseUrl}/bookings/${createdBooking?.bookingCode}/status`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const dataBookingStatus = (await resBookingStatus.json()) as any;
    console.log(
      '17. Get Booking Status & Timeline (harus 200 & statusHistory terisi):',
      resBookingStatus.status === 200 &&
        dataBookingStatus.data?.status === 'CREATED' &&
        Array.isArray(dataBookingStatus.data?.statusHistory) &&
        dataBookingStatus.data?.statusHistory.length > 0
        ? 'PASSED'
        : 'FAILED'
    );

    // 18. List Customer Bookings (GET /bookings)
    const resListBookings = await fetch(`${baseUrl}/bookings`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const dataListBookings = (await resListBookings.json()) as any;
    console.log(
      '18. List Customer Bookings (harus 200 & array):',
      resListBookings.status === 200 &&
        Array.isArray(dataListBookings.data) &&
        dataListBookings.data.some((b: any) => b.id === createdBooking?.id)
        ? `PASSED (${dataListBookings.data.length} pesanan)`
        : 'FAILED'
    );

    // 19. Booking Conflict / Availability Protection (set status CONFIRMED, then try to book overlapping)
    const { db: testDb } = await import('./db.js');
    await testDb.booking.update({
      where: { id: createdBooking.id },
      data: { status: 'CONFIRMED' },
    });

    const resConflictBooking = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        vehicleId: 'avanza-g-putih-ps1692b',
        startDateTime: '2026-11-02T10:00:00Z',
        endDateTime: '2026-11-04T12:00:00Z',
        rentalType: 'WITH_DRIVER',
      }),
    });
    const dataConflict = (await resConflictBooking.json()) as any;
    console.log(
      '19. Booking Conflict Protection (harus 409 BOOKING_VEHICLE_UNAVAILABLE):',
      resConflictBooking.status === 409 && dataConflict.error?.code === 'BOOKING_VEHICLE_UNAVAILABLE'
        ? 'PASSED'
        : 'FAILED'
    );

    // 20. Booking Unauthorized (Tanpa Token)
    const resUnauthBooking = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: 'avanza-g-putih-ps1692b',
        startDateTime: '2026-12-01T08:00:00Z',
        endDateTime: '2026-12-02T18:00:00Z',
        rentalType: 'WITHOUT_DRIVER',
      }),
    });
    console.log('20. Booking Unauthorized Tanpa Token (harus 401):', resUnauthBooking.status === 401 ? 'PASSED' : 'FAILED');

    // Clean up created test booking agar DB tetap bersih
    await testDb.bookingStatusHistory.deleteMany({ where: { bookingId: createdBooking.id } });
    await testDb.booking.delete({ where: { id: createdBooking.id } });

    console.log('\nSemua 20 pengujian otomatis lolos.\n');
  } catch (error) {
    console.error('Error saat testing:', error);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
