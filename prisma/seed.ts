import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/db.js';
import { UserRole } from '../src/generated/prisma/client.js';

/*
 * Seed hanya menyiapkan akun admin pertama.
 *
 * Data operasional — armada, supir, FAQ, basis pengetahuan, pemesanan — sengaja
 * TIDAK diisi di sini. Aplikasi harus mulai dari keadaan kosong supaya setiap
 * angka yang tampil di dashboard benar-benar berasal dari data yang diinput
 * sendiri, bukan dari contoh yang menempel di kode.
 *
 * Kalau butuh data contoh untuk pengujian, buat lewat dashboard atau jalankan
 * skrip E2E di `.verify/` yang memang menyiapkan dan membersihkan datanya
 * sendiri.
 *
 * Nilai bawaan bisa diganti lewat environment:
 *   SEED_ADMIN_PHONE     nomor login admin
 *   SEED_ADMIN_PASSWORD  kata sandi admin
 *   SEED_ADMIN_NAME      nama yang tampil di dashboard
 */

const NOMOR_ADMIN = process.env.SEED_ADMIN_PHONE ?? '081234567890';
const SANDI_ADMIN = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
const NAMA_ADMIN = process.env.SEED_ADMIN_NAME ?? 'Admin MobilJuragan';

/*
 * Apakah kata sandi boleh ditimpa.
 *
 * Aturannya: hanya kalau `SEED_ADMIN_PASSWORD` benar-benar diisi. Kalau tidak,
 * akun yang sudah ada dibiarkan apa adanya dan sandinya tidak pernah direset
 * diam-diam — menjalankan seed ulang di server yang sedang dipakai tidak boleh
 * mengunci orang luar dari akunnya sendiri hanya karena lupa mengisi variabel.
 */
const TIMPA_SANDI = Boolean(process.env.SEED_ADMIN_PASSWORD);

async function main(): Promise<void> {
  console.log('Menyiapkan akun admin...');

  const sudahAda = await db.user.findUnique({ where: { phoneNumber: NOMOR_ADMIN } });
  const hashBaru = await bcrypt.hash(SANDI_ADMIN, 10);

  const admin = await db.user.upsert({
    where: { phoneNumber: NOMOR_ADMIN },
    update: {
      fullName: NAMA_ADMIN,
      role: UserRole.ADMIN,
      isActive: true,
      ...(TIMPA_SANDI ? { passwordHash: hashBaru } : {}),
    },
    create: {
      phoneNumber: NOMOR_ADMIN,
      fullName: NAMA_ADMIN,
      role: UserRole.ADMIN,
      passwordHash: hashBaru,
      isActive: true,
    },
  });

  console.log(`  - Admin siap: ${admin.fullName} (${admin.phoneNumber})`);

  if (!sudahAda) {
    /*
     * Akun baru memakai sandi yang barusan dipakai untuk membuatnya. Kalau itu
     * sandi bawaan, siapa pun yang tahu nomornya bisa masuk. Peringatan ini
     * hanya relevan untuk akun baru: akun lama sandinya tidak disentuh.
     */
    if (TIMPA_SANDI) {
      console.log('  - Akun dibuat dengan kata sandi dari SEED_ADMIN_PASSWORD.');
    } else {
      console.log('');
      console.log('  PERHATIAN: akun baru memakai kata sandi bawaan "Admin123!".');
      console.log('  Sebelum dibuka ke publik, ganti lewat menu Manajemen Admin, atau');
      console.log('  jalankan ulang seed dengan SEED_ADMIN_PASSWORD yang kuat.');
    }
  } else if (TIMPA_SANDI) {
    console.log('  - Kata sandi disetel ulang sesuai SEED_ADMIN_PASSWORD.');
  } else {
    console.log('  - Akun sudah ada; kata sandinya tidak diubah.');
  }

  const jumlah = {
    armada: await db.vehicle.count(),
    supir: await db.driver.count(),
    faq: await db.faq.count(),
    pemesanan: await db.booking.count(),
  };

  console.log('');
  console.log('Keadaan database sekarang:');
  console.log(`  armada    : ${jumlah.armada}`);
  console.log(`  supir     : ${jumlah.supir}`);
  console.log(`  FAQ       : ${jumlah.faq}`);
  console.log(`  pemesanan : ${jumlah.pemesanan}`);
  console.log('');
  console.log('Data operasional tidak diisi oleh seed. Tambahkan lewat dashboard.');
}

main()
  .catch((error) => {
    console.error('Terjadi kesalahan saat seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
