import 'dotenv/config';
import { whatsappOtpService } from '../src/services/whatsappOtp.service.js';

/*
 * Menguji pengiriman OTP WhatsApp tanpa harus lewat aplikasi.
 *
 * Dipakai saat menyiapkan penyedia baru: isi kunci di `.env`, jalankan
 * `npm run uji:wa -- 0812xxxxxxx`, lalu periksa apakah pesan benar-benar masuk.
 * Kode yang dicetak di sini hanya untuk memastikan isi pesan sama dengan yang
 * dikirim — kode itu tidak disimpan di database.
 */

const nomor = process.argv[2]?.trim();

if (!nomor) {
  console.error('Pakai: npm run uji:wa -- 0812xxxxxxx');
  process.exit(1);
}

const penyedia =
  process.env.WA_PROVIDER?.trim() || (process.env.WAPI_API_KEY?.trim() ? 'wapi' : 'gowa');
const kode = String(Math.floor(100000 + Math.random() * 900000));

console.log(`Penyedia : ${penyedia}`);
console.log(`Tujuan   : ${nomor}`);
console.log(`Kode     : ${kode}`);
console.log('Mengirim...');

const berhasil = await whatsappOtpService.sendOtp({ phoneNumber: nomor, otpCode: kode });

if (berhasil) {
  console.log('TERKIRIM. Periksa WhatsApp pada nomor tujuan.');
  process.exit(0);
}

console.error('GAGAL. Lihat pesan galat di atas untuk penyebabnya.');
process.exit(1);
