-- AlterTable
ALTER TABLE `payments` ADD COLUMN `acknowledgedAt` DATETIME(3) NULL,
    ADD COLUMN `acknowledgedBy` VARCHAR(191) NULL;
