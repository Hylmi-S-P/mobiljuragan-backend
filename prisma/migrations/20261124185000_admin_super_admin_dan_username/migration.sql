-- 1. Tambah kolom username, buat phoneNumber nullable, dan perluas enum sementara agar data lama (STAFF/ADMIN) aman dimigrasikan
ALTER TABLE `users`
  ADD COLUMN `username` VARCHAR(191) NULL,
  MODIFY COLUMN `phoneNumber` VARCHAR(191) NULL,
  MODIFY COLUMN `role` ENUM('CUSTOMER', 'STAFF', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'CUSTOMER';

ALTER TABLE `booking_status_history`
  MODIFY COLUMN `actor` ENUM('CUSTOMER', 'STAFF', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM') NOT NULL;

-- 2. Petakan role lama ke struktur baru (ADMIN -> SUPER_ADMIN, STAFF -> ADMIN)
UPDATE `users` SET `role` = 'SUPER_ADMIN' WHERE `role` = 'ADMIN';
UPDATE `users` SET `role` = 'ADMIN' WHERE `role` = 'STAFF';

UPDATE `booking_status_history` SET `actor` = 'SUPER_ADMIN' WHERE `actor` = 'ADMIN';
UPDATE `booking_status_history` SET `actor` = 'ADMIN' WHERE `actor` = 'STAFF';

-- 3. Isi username awal untuk akun internal lama agar tetap bisa login ke dashboard berbasis username
UPDATE `users`
SET `username` = CASE
  WHEN `phoneNumber` IS NOT NULL AND TRIM(`phoneNumber`) <> '' THEN LOWER(TRIM(`phoneNumber`))
  ELSE CONCAT('admin_', SUBSTRING(`id`, 1, 8))
END
WHERE `role` IN ('ADMIN', 'SUPER_ADMIN') AND `username` IS NULL;

-- 4. Kunci enum final sesuai schema.prisma dan pasang indeks unik username
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('CUSTOMER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  ADD UNIQUE INDEX `users_username_key`(`username`);

ALTER TABLE `booking_status_history`
  MODIFY COLUMN `actor` ENUM('CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM') NOT NULL;
