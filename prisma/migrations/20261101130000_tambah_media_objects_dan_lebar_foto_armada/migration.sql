-- Tabel media_objects dan pelebaran kolom foto armada.
--
-- Dua masalah nyata yang diselesaikan di sini:
--
-- 1. vehicles.imageUrl masih VARCHAR(191) sejak migrasi baseline. Foto armada
--    dikirim sebagai data URL Base64, dan Base64 sebuah foto 1 MB sudah sekitar
--    1,4 juta karakter. Kolom 191 karakter memotongnya, sehingga yang tersimpan
--    hanya potongan awal yang tidak bisa ditampilkan. Tes lama lolos karena
--    memakai PNG 1x1 berukuran 114 karakter.
--
-- 2. Foto dan dokumen selama ini disimpan langsung sebagai Base64 di kolom teks.
--    Satu baris bisa membengkak ratusan kilobyte, ikut terbawa pada setiap query
--    yang tidak selektif, dan tidak punya masa simpan. Tabel media_objects
--    memindahkan isi berkas ke penyimpanan objek; baris domain cukup menyimpan
--    pengenal pendek.

-- ---------------------------------------------------------------------------
-- 1. Pelebaran kolom foto armada
-- ---------------------------------------------------------------------------
ALTER TABLE `vehicles`
  MODIFY COLUMN `imageUrl` LONGTEXT NULL;

-- ---------------------------------------------------------------------------
-- 2. Tabel media_objects
-- ---------------------------------------------------------------------------
CREATE TABLE `media_objects` (
  `id`          VARCHAR(191) NOT NULL,
  `sha256`      CHAR(64)     NOT NULL,
  `objectKey`   VARCHAR(255) NOT NULL,
  `mimeType`    VARCHAR(64)  NOT NULL,
  `byteSize`    INTEGER      NOT NULL,
  `width`       INTEGER      NOT NULL,
  `height`      INTEGER      NOT NULL,
  `sourceType`  VARCHAR(16)  NOT NULL,
  `sourceBytes` INTEGER      NOT NULL,
  `kategori`    VARCHAR(32)  NOT NULL,
  `ownerUserId` VARCHAR(191) NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `media_objects_sha256_key` (`sha256`),
  INDEX `media_objects_kategori_idx` (`kategori`),
  INDEX `media_objects_ownerUserId_idx` (`ownerUserId`),
  INDEX `media_objects_createdAt_idx` (`createdAt`),

  CONSTRAINT `media_objects_ownerUserId_fkey`
    FOREIGN KEY (`ownerUserId`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
