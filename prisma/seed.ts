import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/db.js';
import {
  DriverReadiness,
  DriverRoute,
  OperationalStatus,
  UserRole,
} from '../src/generated/prisma/client.js';

/*
 * Seed menyiapkan akun admin pertama dan data induk resmi MobilJuragan:
 * 9 armada, 4 supir, dan 6 FAQ.
 *
 * Data induk diisi di sini karena itulah daftar resmi yang dipakai operasional
 * Merauke — bukan contoh karangan. Semuanya idempoten: dijalankan berulang kali
 * tidak menggandakan baris, hanya menyelaraskan isinya.
 *
 * Data transaksi (pemesanan, pembayaran, tiket) tetap TIDAK diisi di sini.
 * Untuk pengujian, pakai harness E2E di `test/e2e/` yang menyiapkan dan
 * membersihkan datanya sendiri.
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

/**
 * Roster supir resmi. Nomor kontak dan nomor SIM sengaja dikosongkan karena
 * datanya belum diverifikasi, dan status kesiapan dimulai dari SIAGA supaya
 * tidak ada penugasan yang dikarang di seed.
 */
const DRIVER_ROSTER = [
  { externalId: 'markus-gebze', fullName: 'Markus Gebze', routeScope: DriverRoute.DALAM_KOTA },
  { externalId: 'yohanes-mahuze', fullName: 'Yohanes Mahuze', routeScope: DriverRoute.LUAR_KOTA },
  {
    externalId: 'agustinus-balagaise',
    fullName: 'Agustinus Balagaise',
    routeScope: DriverRoute.DALAM_KOTA,
  },
  { externalId: 'bartho-kaize', fullName: 'Bartho Kaize', routeScope: DriverRoute.LUAR_KOTA },
];

/**
 * 9 Kendaraan Resmi CV. Mobil Juragan Express Transport (Merauke).
 * Catatan: Tarif sewa dikonfirmasi langsung oleh tim operasional (tidak di-hardcode).
 */
const OFFICIAL_FLEET = [
  {
    externalId: 'avanza-g-putih-ps1692b',
    name: 'AVANZA G PUTIH',
    licensePlate: 'PS1692B',
    brand: 'Toyota',
    model: 'Avanza G',
    seatingCapacity: 7,
    transmission: 'MANUAL',
    category: 'MPV',
    imageUrl: null,
    pricePerDay: 400000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
  {
    externalId: 'fortuner-vrz-trd-hitam-b8833aku',
    name: 'FORTUNER VRZ TRD HITAM',
    licensePlate: 'B8833AKU',
    brand: 'Toyota',
    model: 'Fortuner VRZ TRD',
    seatingCapacity: 7,
    transmission: 'AUTOMATIC',
    category: 'SUV',
    imageUrl: null,
    pricePerDay: 900000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
  {
    externalId: 'hilux-g-hitam-pa8593gz',
    name: 'HILUX G HITAM',
    licensePlate: 'PA8593GZ',
    brand: 'Toyota',
    model: 'Hilux G',
    seatingCapacity: 5,
    transmission: 'MANUAL',
    category: 'PICKUP',
    imageUrl: null,
    pricePerDay: 850000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
  {
    externalId: 'innova-reborn-g-hitam-pa1504g',
    name: 'INNOVA REBORN G HITAM',
    licensePlate: 'PA1504G',
    brand: 'Toyota',
    model: 'Innova Reborn G',
    seatingCapacity: 7,
    transmission: 'AUTOMATIC',
    category: 'MPV',
    imageUrl: null,
    pricePerDay: 600000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
  {
    externalId: 'pickup-suzuki-carry-hitam-b9762bay',
    name: 'PICKUP SUZUKI CARRY HITAM',
    licensePlate: 'B9762BAY',
    brand: 'Suzuki',
    model: 'Carry',
    seatingCapacity: 3,
    transmission: 'MANUAL',
    category: 'COMMERCIAL',
    imageUrl: null,
    pricePerDay: 350000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
  {
    externalId: 'rush-g-all-new-coklat-pa1696gg',
    name: 'RUSH G ALL NEW COKLAT',
    licensePlate: 'PA1696GG',
    brand: 'Toyota',
    model: 'Rush G All New',
    seatingCapacity: 7,
    transmission: 'MANUAL',
    category: 'SUV',
    imageUrl: null,
    pricePerDay: 500000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
  {
    externalId: 'terios-x-hijau-matic-b2534krb',
    name: 'TERIOS X HIJAU MATIC',
    licensePlate: 'B2534KRB',
    brand: 'Daihatsu',
    model: 'Terios X',
    seatingCapacity: 7,
    transmission: 'AUTOMATIC',
    category: 'SUV',
    imageUrl: null,
    pricePerDay: 500000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
  {
    externalId: 'veloz-merah-ps1693b',
    name: 'VELOZ MERAH',
    licensePlate: 'PS1693B',
    brand: 'Toyota',
    model: 'Veloz',
    seatingCapacity: 7,
    transmission: 'AUTOMATIC',
    category: 'MPV',
    imageUrl: null,
    pricePerDay: 450000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
  {
    externalId: 'xpander-exceed-hitam-ps1691b',
    name: 'XPANDER EXCEED HITAM',
    licensePlate: 'PS1691B',
    brand: 'Mitsubishi',
    model: 'Xpander Exceed',
    seatingCapacity: 7,
    transmission: 'AUTOMATIC',
    category: 'MPV',
    imageUrl: null,
    pricePerDay: 550000,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
];

/**
 * 6 FAQ Resmi MobilJuragan (diekstraksi dari mobile HelpCenterScreen).
 *
 * FAQ pembayaran tidak lagi menyebut COD: sejak keputusan B13, pembayaran
 * tunai hanya dicatat petugas di kantor, bukan pilihan di aplikasi.
 */
const INITIAL_FAQS = [
  {
    category: 'Booking & Sewa',
    question: 'Bagaimana prosedur penjemputan di Bandara Mopah Merauke?',
    answer:
      'Tim operasional kami akan menunggu di lobi kedatangan Bandara Mopah dengan papan nama penyewa atau menghubungi via WhatsApp 30 menit sebelum jadwal pesawat mendarat. Serah terima unit dilakukan langsung di area parkir bandara tanpa biaya tambahan antar-jemput.',
    orderIndex: 1,
    isActive: true,
  },
  {
    category: 'Booking & Sewa',
    question: 'Bagaimana verifikasi dokumen KTP dan SIM A untuk lepas kunci?',
    answer:
      'Verifikasi dokumen fisik asli (KTP elektronik dan SIM A aktif) dilakukan langsung di kantor operasional MobilJuragan atau saat serah terima unit di titik penjemputan Merauke.',
    orderIndex: 2,
    isActive: true,
  },
  {
    category: 'Armada',
    question: 'Bagaimana kebijakan bahan bakar (BBM) armada?',
    answer:
      'Mobil diserahterimakan dengan indikator BBM tertentu (umumnya terisi minimal setengah bar). Penyewa diharapkan mengembalikan unit dengan posisi BBM setara saat serah terima awal.',
    orderIndex: 3,
    isActive: true,
  },
  {
    category: 'Booking & Sewa',
    question: 'Berapa tarif jasa pengemudi dan durasi kerjanya?',
    answer:
      'Jasa pengemudi lokal Merauke bertarif Rp 150.000 per hari dengan durasi pemakaian normal hingga 12 jam per hari dalam wilayah perkotaan Merauke dan sekitarnya.',
    orderIndex: 4,
    isActive: true,
  },
  {
    category: 'Pembayaran',
    question: 'Metode pembayaran apa saja yang berlaku?',
    answer:
      'Pembayaran dapat diselesaikan langsung di aplikasi menggunakan QRIS Dinamis atau Virtual Account / Transfer Bank (BRI / Mandiri). Pembayaran tunai dilakukan langsung di kantor operasional Merauke dan dicatat oleh petugas. Layanan konfirmasi manual melalui Chat CS juga siap membantu jika Anda memerlukan bantuan pembayaran.',
    orderIndex: 5,
    isActive: true,
  },
  {
    category: 'Armada',
    question: 'Apakah tersedia bantuan jika terjadi kendala armada di jalan?',
    answer:
      'MobilJuragan siap membantu penanganan kendala armada selama jam operasional (06.00 - 22.00 WIT) untuk wilayah Merauke Kota, Kurik, Tanah Miring, hingga Semangga. Hubungi nomor operasional kami jika membutuhkan bantuan darurat.',
    orderIndex: 6,
    isActive: true,
  },
];

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

  console.log('\nMenyiapkan 9 armada resmi...');
  for (const vehicle of OFFICIAL_FLEET) {
    const record = await db.vehicle.upsert({
      where: { externalId: vehicle.externalId },
      update: {
        name: vehicle.name,
        licensePlate: vehicle.licensePlate,
        brand: vehicle.brand,
        model: vehicle.model,
        seatingCapacity: vehicle.seatingCapacity,
        transmission: vehicle.transmission,
        category: vehicle.category,
        pricePerDay: vehicle.pricePerDay,
        operationalStatus: vehicle.operationalStatus,
      },
      create: vehicle,
    });
    console.log(`  - Tersimpan: ${record.name} (${record.licensePlate})`);
  }

  console.log('\nMenyiapkan roster supir...');
  for (const driver of DRIVER_ROSTER) {
    const record = await db.driver.upsert({
      where: { externalId: driver.externalId },
      update: {
        fullName: driver.fullName,
        routeScope: driver.routeScope,
      },
      create: {
        externalId: driver.externalId,
        fullName: driver.fullName,
        routeScope: driver.routeScope,
        readiness: DriverReadiness.SIAGA,
        phoneNumber: null,
        licenseNumber: null,
      },
    });
    console.log(`  - Tersimpan supir: ${record.fullName} (${record.routeScope})`);
  }

  console.log('\nMenyiapkan 6 FAQ resmi...');
  for (const faq of INITIAL_FAQS) {
    const existing = await db.faq.findFirst({ where: { question: faq.question } });
    if (existing) {
      await db.faq.update({
        where: { id: existing.id },
        data: {
          answer: faq.answer,
          category: faq.category,
          orderIndex: faq.orderIndex,
          isActive: faq.isActive,
        },
      });
      console.log(`  - Diperbarui FAQ: [${faq.category}] ${faq.question.slice(0, 40)}...`);
    } else {
      await db.faq.create({ data: faq });
      console.log(`  - Dibuat FAQ: [${faq.category}] ${faq.question.slice(0, 40)}...`);
    }
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
