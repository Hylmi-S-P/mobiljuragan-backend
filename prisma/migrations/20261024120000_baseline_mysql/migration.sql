-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `role` ENUM('CUSTOMER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `passwordHash` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `users_phoneNumber_key`(`phoneNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `licensePlate` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `seatingCapacity` INTEGER NOT NULL,
    `transmission` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `pricePerDay` INTEGER NOT NULL DEFAULT 400000,
    `operationalStatus` ENUM('AVAILABLE', 'BOOKED', 'MAINTENANCE', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vehicles_externalId_key`(`externalId`),
    INDEX `vehicles_operationalStatus_idx`(`operationalStatus`),
    INDEX `vehicles_externalId_idx`(`externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drivers` (
    `id` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `licenseNumber` VARCHAR(191) NULL,
    `routeScope` ENUM('DALAM_KOTA', 'LUAR_KOTA') NOT NULL DEFAULT 'DALAM_KOTA',
    `readiness` ENUM('SIAGA', 'LIBUR', 'SEDANG_TUGAS') NOT NULL DEFAULT 'SIAGA',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `drivers_externalId_key`(`externalId`),
    INDEX `drivers_readiness_idx`(`readiness`),
    INDEX `drivers_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` VARCHAR(191) NOT NULL,
    `bookingCode` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NULL,
    `startDateTime` DATETIME(3) NOT NULL,
    `endDateTime` DATETIME(3) NOT NULL,
    `rentalType` ENUM('WITH_DRIVER', 'WITHOUT_DRIVER') NOT NULL,
    `pickupLocation` VARCHAR(191) NULL,
    `customerRequest` VARCHAR(191) NULL,
    `numberGuests` INTEGER NULL,
    `tariffStatus` ENUM('CONFIRMED', 'PENDING_TEAM_CONFIRMATION') NOT NULL DEFAULT 'PENDING_TEAM_CONFIRMATION',
    `quotedAmount` DECIMAL(12, 2) NULL,
    `status` ENUM('CREATED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'CREATED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_bookingCode_key`(`bookingCode`),
    INDEX `bookings_customerId_idx`(`customerId`),
    INDEX `bookings_vehicleId_idx`(`vehicleId`),
    INDEX `bookings_driverId_idx`(`driverId`),
    INDEX `bookings_status_idx`(`status`),
    INDEX `bookings_startDateTime_endDateTime_idx`(`startDateTime`, `endDateTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('CREATED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED') NULL,
    `toStatus` ENUM('CREATED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED') NOT NULL,
    `actor` ENUM('CUSTOMER', 'STAFF', 'ADMIN', 'SYSTEM') NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_status_history_bookingId_idx`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_verifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `otpHash` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_verifications_userId_phoneNumber_idx`(`userId`, `phoneNumber`),
    INDEX `otp_verifications_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` ENUM('GENERAL', 'PAYMENT_CONFIRMATION', 'VEHICLE_ISSUE', 'CANCELLATION', 'COMPLAINT', 'OTHER') NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `handledBy` ENUM('AI', 'HUMAN') NOT NULL DEFAULT 'HUMAN',
    `handoverAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `support_tickets_ticketNumber_key`(`ticketNumber`),
    INDEX `support_tickets_customerId_idx`(`customerId`),
    INDEX `support_tickets_status_idx`(`status`),
    INDEX `support_tickets_handledBy_idx`(`handledBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_messages` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NULL,
    `body` VARCHAR(191) NOT NULL,
    `isCustomer` BOOLEAN NOT NULL,
    `isAi` BOOLEAN NOT NULL DEFAULT false,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_messages_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    -- Ditulis sebagai JSON, sesuai yang dihasilkan Prisma. Di MariaDB kata kunci ini
    -- disimpan sebagai LONGTEXT + CHECK json_valid dengan collation utf8mb4_bin,
    -- sama seperti database sungguhan. Akibatnya `prisma migrate diff` selalu
    -- melaporkan satu selisih pada kolom ini; itu artefak introspeksi MariaDB,
    -- bukan drift. Lihat catatan di prisma/CATATAN-MIGRASI.md.
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `gatewayUrl` VARCHAR(191) NOT NULL DEFAULT 'http://localhost:20128/v1',
    `apiKey` VARCHAR(191) NULL DEFAULT '',
    `activeModel` VARCHAR(191) NOT NULL DEFAULT 'gemini-2.5-flash',
    `fallbackModel` VARCHAR(191) NOT NULL DEFAULT 'gemini-2.5-flash',
    `fallbackGatewayUrl` VARCHAR(191) NULL DEFAULT 'https://generativelanguage.googleapis.com/v1beta/openai',
    `fallbackApiKey` VARCHAR(191) NULL DEFAULT '',
    `autoFallbackEnabled` BOOLEAN NOT NULL DEFAULT true,
    `proxyUrl` VARCHAR(191) NULL DEFAULT '',
    `healthStatus` VARCHAR(191) NOT NULL DEFAULT 'HEALTHY',
    `lastLatencyMs` INTEGER NULL DEFAULT 0,
    `lastHealthCheckedAt` DATETIME(3) NULL,
    `systemPrompt` TEXT NOT NULL,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `maxTokens` INTEGER NOT NULL DEFAULT 1000,
    `enableRag` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_documents` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `knowledge_documents_category_idx`(`category`),
    INDEX `knowledge_documents_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faqs` (
    `id` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `faqs_category_idx`(`category`),
    INDEX `faqs_isActive_idx`(`isActive`),
    INDEX `faqs_orderIndex_idx`(`orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `baseAmount` DECIMAL(12, 2) NOT NULL,
    `uniqueCode` INTEGER NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('QRIS', 'BANK_TRANSFER', 'CASH') NOT NULL DEFAULT 'QRIS',
    `status` ENUM('UNPAID', 'PENDING_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    `qrisPayload` TEXT NULL,
    `proofImageUrl` TEXT NULL,
    `bankName` VARCHAR(191) NULL,
    `senderAccount` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `verifiedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_bookingId_key`(`bookingId`),
    INDEX `payments_bookingId_idx`(`bookingId`),
    INDEX `payments_status_idx`(`status`),
    INDEX `payments_totalAmount_idx`(`totalAmount`),
    INDEX `payments_method_idx`(`method`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_status_history` ADD CONSTRAINT `booking_status_history_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_verifications` ADD CONSTRAINT `otp_verifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
