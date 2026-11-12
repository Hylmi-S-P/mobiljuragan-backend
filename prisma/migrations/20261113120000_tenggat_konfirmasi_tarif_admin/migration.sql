-- AlterTable
-- Kolom aditif pada bookings. Baris lama bernilai NULL, artinya tidak punya
-- tenggat admin; penjadwal hanya menyapu pesanan yang tenggatnya terisi, jadi
-- pesanan lama tidak ikut dibatalkan saat migrasi ini dijalankan.
ALTER TABLE `bookings`
  ADD COLUMN `adminDeadlineAt` DATETIME(3) NULL;

-- CreateIndex
-- Penjadwal menyaring berdasarkan status dan tenggat sekaligus.
CREATE INDEX `bookings_status_adminDeadlineAt_idx`
  ON `bookings`(`status`, `adminDeadlineAt`);
