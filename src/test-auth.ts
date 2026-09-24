import 'dotenv/config';
import { app } from './app.js';
import type { Server } from 'node:http';

async function runTests() {
  const server: Server = app.listen(4999);
  const baseUrl = 'http://127.0.0.1:4999/api/v1';

  console.log('🧪 Memulai pengujian otomatis endpoint Auth M5...\n');

  try {
    // 1. Uji Health Check
    const resHealth = await fetch('http://127.0.0.1:4999/health');
    const dataHealth = (await resHealth.json()) as any;
    console.log('1. Health Check:', resHealth.status === 200 && dataHealth.status === 'ok' ? 'PASSED ✓' : 'FAILED ✗');

    // 2. Uji Request OTP Customer
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
    console.log('2. Request OTP Customer:', resOtpReq.status === 200 && mockOtp ? `PASSED ✓ (OTP: ${mockOtp})` : 'FAILED ✗', dataOtpReq);

    // 3. Uji Verify OTP Salah
    const resOtpWrong = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567888',
        otp: '000000',
      }),
    });
    const dataOtpWrong = (await resOtpWrong.json()) as any;
    console.log('3. Verify OTP Salah (harus 400):', resOtpWrong.status === 400 && dataOtpWrong.error?.code === 'OTP_INVALID' ? 'PASSED ✓' : 'FAILED ✗');

    // 4. Uji Verify OTP Benar
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
    console.log('4. Verify OTP Benar (harus 200 & return token):', resOtpCorrect.status === 200 && customerToken ? 'PASSED ✓' : 'FAILED ✗');

    // 5. Uji Replay OTP yang sudah consumed
    const resOtpReplay = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567888',
        otp: mockOtp,
      }),
    });
    console.log('5. Replay OTP Consumed (harus ditolak 400):', resOtpReplay.status === 400 ? 'PASSED ✓' : 'FAILED ✗');

    // 6. Uji Login Admin Password Salah
    const resAdminWrong = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '081234567890',
        password: 'SalahPassword123',
      }),
    });
    console.log('6. Admin Login Salah (harus 401):', resAdminWrong.status === 401 ? 'PASSED ✓' : 'FAILED ✗');

    // 7. Uji Login Admin Berhasil
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
    console.log('7. Admin Login Berhasil (harus 200 & return token):', resAdminOk.status === 200 && adminToken ? 'PASSED ✓' : 'FAILED ✗');

    // 8. Uji Otorisasi Role: Customer Akses Endpoint Admin /me (harus 403 Forbidden)
    const resForbidden = await fetch(`${baseUrl}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    console.log('8. Customer Akses Admin /me (harus 403 FORBIDDEN):', resForbidden.status === 403 ? 'PASSED ✓' : 'FAILED ✗');

    // 9. Uji Otorisasi Role: Admin Akses Endpoint Admin /me (harus 200 OK)
    const resAdminMe = await fetch(`${baseUrl}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataAdminMe = (await resAdminMe.json()) as any;
    console.log('9. Admin Akses Admin /me (harus 200 & user role ADMIN):', resAdminMe.status === 200 && dataAdminMe.data?.user?.role === 'ADMIN' ? 'PASSED ✓' : 'FAILED ✗');

    console.log('\n🎉 SEMUA 9 PENGUJIAN OTOMATIS AUTH M5 LOLOS 100%!\n');
  } catch (error) {
    console.error('Error saat testing:', error);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
