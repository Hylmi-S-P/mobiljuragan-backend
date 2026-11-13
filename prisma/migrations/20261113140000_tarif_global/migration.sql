-- CreateTable
-- Tarif global. Satu baris saja (`id = 'default'`), dibuat oleh `getTariffSetting()`
-- saat pertama kali dibutuhkan, jadi migrasi ini tidak perlu mengisi data.
CREATE TABLE `tariff_settings` (
  `id` VARCHAR(191) NOT NULL,
  `driverDailyRate` INTEGER NOT NULL DEFAULT 150000,
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
