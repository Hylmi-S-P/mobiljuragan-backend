-- CreateTable
CREATE TABLE `booking_documents` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `statementLetterUrl` LONGTEXT NULL,
    `ktpUrl` LONGTEXT NULL,
    `simUrl` LONGTEXT NULL,
    `status` ENUM('PENDING_UPLOAD', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING_UPLOAD',
    `rejectionReason` TEXT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `verifiedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `booking_documents_bookingId_key`(`bookingId`),
    INDEX `booking_documents_bookingId_idx`(`bookingId`),
    INDEX `booking_documents_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `booking_documents` ADD CONSTRAINT `booking_documents_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
