-- Tabel document_templates untuk template dokumen resmi yang diunduh pelanggan.
--
-- Isi surat pernyataan berubah seiring waktu, jadi tidak lagi ditanam di kode.
-- Setiap baris adalah satu versi. Saat template aktif diubah, baris baru dibuat
-- dengan versi bertambah dan baris lama dinonaktifkan, sehingga dokumen yang
-- sudah ditandatangani pelanggan tetap bisa ditelusuri memakai versi mana.

CREATE TABLE `document_templates` (
  `id`             VARCHAR(191) NOT NULL,
  `kode`           VARCHAR(64)  NOT NULL,
  `judul`          VARCHAR(200) NOT NULL,
  `versi`          INTEGER      NOT NULL DEFAULT 1,
  `isi`            JSON         NOT NULL,
  `isActive`       BOOLEAN      NOT NULL DEFAULT false,
  `catatan`        TEXT         NULL,
  `dibuatOleh`     VARCHAR(191) NULL,
  `diperbaruiOleh` VARCHAR(191) NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)  NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `document_templates_kode_versi_key` (`kode`, `versi`),
  INDEX `document_templates_kode_isActive_idx` (`kode`, `isActive`),
  INDEX `document_templates_isActive_idx` (`isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
