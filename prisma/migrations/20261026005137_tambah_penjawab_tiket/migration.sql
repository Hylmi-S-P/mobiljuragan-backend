-- AlterTable
ALTER TABLE `support_tickets` ADD COLUMN `assignedAdminId` VARCHAR(191) NULL,
    ADD COLUMN `assignedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `support_tickets_assignedAdminId_idx` ON `support_tickets`(`assignedAdminId`);

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_assignedAdminId_fkey` FOREIGN KEY (`assignedAdminId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
