-- Tabel pengembalian dana untuk pesanan yang dibatalkan setelah dibayar.
-- Nominal refund sebelumnya hanya dihitung di aplikasi mobile dan disimpan di
-- cache perangkat, sehingga kantor tidak punya catatan resmi atas uang yang
-- harus dikembalikan.

CREATE TABLE `booking_refunds` (
  `id` VARCHAR(191) NOT NULL,
  `bookingId` VARCHAR(191) NOT NULL,
  `paymentId` VARCHAR(191) NULL,
  `totalDibayar` DECIMAL(12, 2) NOT NULL,
  `potongan` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `nominal` DECIMAL(12, 2) NOT NULL,
  `dibatalkanOleh` VARCHAR(191) NOT NULL,
  `alasan` TEXT NULL,
  `namaBank` VARCHAR(191) NULL,
  `nomorRekening` VARCHAR(191) NULL,
  `namaPemilik` VARCHAR(191) NULL,
  `buktiMediaId` VARCHAR(191) NULL,
  `status` ENUM('MENUNGGU', 'DIPROSES', 'SELESAI') NOT NULL DEFAULT 'MENUNGGU',
  `dicatatOleh` VARCHAR(191) NULL,
  `dicatatPada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `diselesaikanPada` DATETIME(3) NULL,

  UNIQUE INDEX `booking_refunds_bookingId_key`(`bookingId`),
  UNIQUE INDEX `booking_refunds_paymentId_key`(`paymentId`),
  INDEX `booking_refunds_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `booking_refunds`
  ADD CONSTRAINT `booking_refunds_bookingId_fkey`
  FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `booking_refunds`
  ADD CONSTRAINT `booking_refunds_paymentId_fkey`
  FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
