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

async function main(): Promise<void> {
  console.log('Menyiapkan akun admin...');

  const sudahAda = await db.user.findUnique({ where: { phoneNumber: NOMOR_ADMIN } });

  const admin = await db.user.upsert({
    where: { phoneNumber: NOMOR_ADMIN },
    update: {
      fullName: NAMA_ADMIN,
      role: UserRole.ADMIN,
      isActive: true,
      ...(sudahAda ? {} : { passwordHash: await bcrypt.hash(SANDI_ADMIN, 10) }),
    },
    create: {
      phoneNumber: NOMOR_ADMIN,
      fullName: NAMA_ADMIN,
      role: UserRole.ADMIN,
      passwordHash: await bcrypt.hash(SANDI_ADMIN, 10),
      isActive: true,
    },
  });

  console.log(`  - Admin siap: ${admin.fullName} (${admin.phoneNumber})`);

  /*
   * Peringatan ini penting. Kalau kata sandi masih bawaan, siapa pun yang tahu
   * nomor admin bisa masuk. Di server produksi, ganti sebelum dibuka ke publik.
   */
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('');
    console.log('  PERHATIAN: kata sandi admin masih memakai nilai bawaan.');
    console.log('  Sebelum dipakai di server yang bisa diakses publik, jalankan ulang');
    console.log('  dengan SEED_ADMIN_PASSWORD yang kuat, atau ubah lewat menu Manajemen Admin.');
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
