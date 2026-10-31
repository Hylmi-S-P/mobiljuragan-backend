-- AlterEnum
-- Menambah IN_SERVICE: masa pemeriksaan/pembersihan setelah sewa selesai.
ALTER TABLE `vehicles`
  MODIFY `operationalStatus` ENUM('AVAILABLE', 'BOOKED', 'IN_SERVICE', 'MAINTENANCE', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
-- Kolom aditif: kapan masa in-service mulai dan kapan diperkirakan selesai.
ALTER TABLE `vehicles`
  ADD COLUMN `serviceStartedAt` DATETIME(3) NULL,
  ADD COLUMN `serviceExpectedDoneAt` DATETIME(3) NULL;
