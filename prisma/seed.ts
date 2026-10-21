import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/db.js';
import {
  DriverReadiness,
  DriverRoute,
  OperationalStatus,
  UserRole,
} from '../src/generated/prisma/client.js';

/**
 * Roster supir resmi. Nomor kontak dan nomor SIM sengaja dikosongkan karena datanya
 * belum diverifikasi, dan status kesiapan dimulai dari SIAGA supaya tidak ada
 * penugasan yang dikarang di seed.
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
    operationalStatus: OperationalStatus.AVAILABLE,
  },
];

/**
 * 6 FAQ Resmi MobilJuragan (diekstraksi dari mobile HelpCenterScreen).
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
      'Pembayaran dapat diselesaikan langsung di aplikasi menggunakan QRIS Dinamis, Virtual Account / Transfer Bank (BRI / Mandiri), atau Tunai di Tempat (COD) saat serah terima unit di Merauke. Layanan konfirmasi manual melalui Chat CS juga siap membantu jika Anda memerlukan bantuan pembayaran.',
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

async function main() {
  console.log('Memulai seeding 9 armada resmi MobilJuragan...');

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
        operationalStatus: vehicle.operationalStatus,
      },
      create: vehicle,
    });
    console.log(`  - Tersimpan: ${record.name} (${record.licensePlate})`);
  }

  const count = await db.vehicle.count();
  console.log(`\nSeeding armada selesai. Total kendaraan di database: ${count}`);

  console.log('\nMemulai seeding roster supir...');
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

  const driverCount = await db.driver.count();
  console.log(`Seeding supir selesai. Total supir di database: ${driverCount}`);

  console.log('\nMemulai seeding akun staf/admin...');
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const admin = await db.user.upsert({
    where: { phoneNumber: '081234567890' },
    update: {
      fullName: 'Admin MobilJuragan',
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      isActive: true,
    },
    create: {
      phoneNumber: '081234567890',
      fullName: 'Admin MobilJuragan',
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });
  console.log(`  - Tersimpan admin: ${admin.fullName} (${admin.phoneNumber})`);

  const staffPasswordHash = await bcrypt.hash('Staf123!', 10);
  const staff = await db.user.upsert({
    where: { phoneNumber: '081234567899' },
    update: {
      fullName: 'Staf Operasional Merauke',
      role: UserRole.STAFF,
      passwordHash: staffPasswordHash,
      isActive: true,
    },
    create: {
      phoneNumber: '081234567899',
      fullName: 'Staf Operasional Merauke',
      role: UserRole.STAFF,
      passwordHash: staffPasswordHash,
      isActive: true,
    },
  });
  console.log(`  - Tersimpan staf: ${staff.fullName} (${staff.phoneNumber})`);

  console.log('\nMemulai seeding 6 FAQ awal resmi MobilJuragan...');
  for (const faq of INITIAL_FAQS) {
    const existing = await db.faq.findFirst({
      where: { question: faq.question },
    });
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
      await db.faq.create({
        data: faq,
      });
      console.log(`  - Dibuat FAQ: [${faq.category}] ${faq.question.slice(0, 40)}...`);
    }
  }
  const faqCount = await db.faq.count();
  console.log(`Seeding FAQ selesai. Total FAQ di database: ${faqCount}`);
}

main()
  .catch((e) => {
    console.error('Terjadi kesalahan saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
