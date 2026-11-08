-- Verifikasi kepemilikan nomor sebelum akun dibuat, plus kata sandi pelanggan.
--
-- `otp_verifications.userId` dibuat nullable karena OTP pendaftaran dibuat
-- SEBELUM baris `users` ada. Tanpa ini, tabel memaksa akun lahir lebih dulu —
-- persis pola write-before-verify yang menyebabkan akun pelanggan tertimpa.

ALTER TABLE `otp_verifications` MODIFY `userId` VARCHAR(191) NULL;

-- Kode lama yang di-revoke tetap disimpan sebagai jejak audit.
ALTER TABLE `otp_verifications` ADD COLUMN `revokedAt` DATETIME(3) NULL;

CREATE INDEX `otp_verifications_phoneNumber_purpose_consumedAt_idx`
  ON `otp_verifications`(`phoneNumber`, `purpose`, `consumedAt`);

-- Kapan nomor benar-benar terbukti milik pengguna.
ALTER TABLE `users` ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL;

-- Akun yang sudah ada dan sudah pernah login dianggap nomornya terverifikasi.
-- Hanya pelanggan: akun staf/admin dikelola lewat portal dan tidak lewat OTP.
UPDATE `users`
SET `phoneVerifiedAt` = `createdAt`
WHERE `phoneVerifiedAt` IS NULL
  AND `role` = 'CUSTOMER'
  AND `lastLoginAt` IS NOT NULL;

-- Pembatas percobaan & pengiriman OTP per nomor (lintas permintaan).
CREATE TABLE `phone_guards` (
  `phoneNumber`         VARCHAR(191) NOT NULL,
  `verifyFailures`      INTEGER      NOT NULL DEFAULT 0,
  `blockedUntil`        DATETIME(3)  NULL,
  `lastSentAt`          DATETIME(3)  NULL,
  `sendCount`           INTEGER      NOT NULL DEFAULT 0,
  `sendWindowStartedAt` DATETIME(3)  NULL,
  `updatedAt`           DATETIME(3)  NOT NULL,

  PRIMARY KEY (`phoneNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
