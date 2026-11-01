-- AlterTable
-- Rute perjalanan pada pesanan (dalam kota / luar kota), diisi saat konfirmasi tarif.
ALTER TABLE `bookings` ADD COLUMN `routeScope` ENUM('DALAM_KOTA', 'LUAR_KOTA') NULL;
