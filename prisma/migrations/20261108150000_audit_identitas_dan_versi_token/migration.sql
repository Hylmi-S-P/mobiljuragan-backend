-- Jejak perubahan identitas + pencabutan sesi lewat versi token.

CREATE TABLE `identity_audits` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `actorType` VARCHAR(191) NOT NULL,
  `actorId`   VARCHAR(191) NULL,
  `action`    VARCHAR(191) NOT NULL,
  `field`     VARCHAR(191) NOT NULL,
  `before`    TEXT         NULL,
  `after`     TEXT         NULL,
  `reason`    TEXT         NULL,
  `ipAddress` VARCHAR(191) NULL,
  `userAgent` TEXT         NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `identity_audits_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `identity_audits_action_createdAt_idx`(`action`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `identity_audits`
  ADD CONSTRAINT `identity_audits_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Versi token: token lama otomatis gugur saat nilainya naik.
ALTER TABLE `users` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `passwordUpdatedAt` DATETIME(3) NULL;
