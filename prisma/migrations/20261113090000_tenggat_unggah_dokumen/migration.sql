-- AlterTable
-- Kolom aditif pada bookings. Baris lama otomatis berstatus NONE sehingga tidak
-- ada pesanan lama yang tiba-tiba dibatalkan oleh penjadwal baru.
--
-- MySQL tidak punya tipe enum terpisah seperti PostgreSQL; enum ditulis langsung
-- pada definisi kolom, sama seperti `operationalStatus` di tabel `vehicles`.
ALTER TABLE `bookings`
  ADD COLUMN `documentDeadlineAt` DATETIME(3) NULL,
  ADD COLUMN `documentDeadlineState` ENUM('NONE', 'RUNNING', 'PAUSED') NOT NULL DEFAULT 'NONE',
  ADD COLUMN `documentRejectedAt` DATETIME(3) NULL;

-- CreateIndex
-- Penjadwal menyaring berdasarkan keadaan dan waktu sekaligus.
CREATE INDEX `bookings_documentDeadlineState_documentDeadlineAt_idx`
  ON `bookings`(`documentDeadlineState`, `documentDeadlineAt`);
