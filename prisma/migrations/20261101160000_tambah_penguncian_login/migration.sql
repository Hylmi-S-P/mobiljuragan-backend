-- Kolom penguncian login pada tabel users.
--
-- Tanpa ini, endpoint login hanya bisa dibatasi per alamat IP. Penyerang yang
-- memakai banyak IP tetap bisa menebak password satu akun tanpa batas. Kolom di
-- sini mengunci akun itu sendiri, dan karena tersimpan di database, penguncian
-- tidak hilang saat server restart.

ALTER TABLE `users`
  ADD COLUMN `failedLoginAttempts` INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN `lockedUntil`         DATETIME(3) NULL,
  ADD COLUMN `lastLoginAt`         DATETIME(3) NULL;
