import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/db.js';
import { OperationalStatus, UserRole } from '../src/generated/prisma/client.js';

/**
 * 9 Kendaraan Resmi CV. Mobil Juragan Express Transport (Merauke)
 * Sumber data: Spesifikasi armada resmi CV. Mobil Juragan Express Transport
 * 
 * ATURAN MUTLAK (Hard Gate):
 *  - Tarif berupa angka TIDAK BOLEH di-hardcode.
 *  - Tidak ada data fiktif (rating, review, testimoni, atau nama pelanggan palsu).
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
    transmission: 'MANUAL',
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
    transmission: 'MANUAL',
    category: 'MPV',
    imageUrl: null,
    operationalStatus: OperationalStatus.AVAILABLE,
  },
];

async function main() {
  console.log('🚗 Memulai seeding 9 armada resmi MobilJuragan...');

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
    console.log(`  ✓ Tersimpan: ${record.name} (${record.licensePlate})`);
  }

  const count = await db.vehicle.count();
  console.log(`\n✅ Seeding armada selesai! Total kendaraan di database: ${count}`);

  console.log('\n👤 Memulai seeding user staf/admin...');
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
  console.log(`  ✓ Tersimpan admin: ${admin.fullName} (${admin.phoneNumber})`);

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
  console.log(`  ✓ Tersimpan staf: ${staff.fullName} (${staff.phoneNumber})`);
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
