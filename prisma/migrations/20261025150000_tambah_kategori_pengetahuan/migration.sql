-- Tabel kategori dokumen pengetahuan untuk RAG.
--
-- Sebelumnya kategori hanya teks bebas pada `knowledge_documents`, dan daftar
-- pilihannya dipatri di kode tampilan. Admin tidak bisa menambah kategori baru
-- tanpa mengubah kode, dan kategori salah ketik tetap tersimpan apa adanya.
--
-- `slug` dipakai sebagai nilai yang disimpan dokumen, sehingga nama tampilan
-- bisa diubah tanpa menyentuh dokumen yang sudah ada.

CREATE TABLE `knowledge_categories` (
  `id`         VARCHAR(191) NOT NULL,
  `slug`       VARCHAR(191) NOT NULL,
  `label`      VARCHAR(191) NOT NULL,
  `orderIndex` INTEGER      NOT NULL DEFAULT 100,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `knowledge_categories_slug_key` (`slug`),
  INDEX `knowledge_categories_orderIndex_idx` (`orderIndex`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Isi lima kategori yang selama ini dipatri di kode, supaya dokumen yang sudah
-- ada tetap punya kategori yang sah dan tampilan tidak berubah setelah migrasi.
INSERT INTO `knowledge_categories` (`id`, `slug`, `label`, `orderIndex`, `updatedAt`) VALUES
  (UUID(), 'SOP',       'SOP & Regulasi Rental',          10, CURRENT_TIMESTAMP(3)),
  (UUID(), 'ROUTE',     'Rute & Wilayah Operasional',     20, CURRENT_TIMESTAMP(3)),
  (UUID(), 'TARIFF',    'Tarif Sewa & Penyesuaian Biaya', 30, CURRENT_TIMESTAMP(3)),
  (UUID(), 'EMERGENCY', 'Darurat & Handoff Staf',         40, CURRENT_TIMESTAMP(3)),
  (UUID(), 'GENERAL',   'Umum / FAQ',                     50, CURRENT_TIMESTAMP(3));