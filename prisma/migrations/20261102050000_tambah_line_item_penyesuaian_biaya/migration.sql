-- Tabel booking_line_items: penyesuaian biaya manual (surcharge) per booking.
--
-- Sebelumnya rincian ini hanya hidup di state React. Admin mengisi deskripsi,
-- nominal, dan justifikasi audit, melihat barisnya muncul di tabel, lalu
-- semuanya hilang begitu halaman dimuat ulang. Justifikasi yang diminta sebagai
-- catatan internal tidak pernah tersimpan di mana pun, jadi tidak ada jejak
-- audit sama sekali.
--
-- Nominal disimpan sebagai angka POSITIF ditambah kolom `arah`, bukan sebagai
-- angka bertanda. Dua alasan:
--   1. laporan bisa menjumlahkan penambahan dan pengurangan secara terpisah;
--   2. tidak ada risiko tanda yang tertukar saat nilai dibaca balik atau
--      diformat, karena tidak pernah ada nilai negatif yang perlu dijelaskan.
--
-- Penghapusan bersifat lunak lewat `dibatalkanPada`, bukan DELETE. Baris yang
-- sudah pernah menagih pelanggan harus tetap bisa ditelusuri setelah dibatalkan.

CREATE TABLE `booking_line_items` (
  `id`              VARCHAR(191)  NOT NULL,
  `bookingId`       VARCHAR(191)  NOT NULL,
  `kategori`        VARCHAR(64)   NOT NULL,
  `deskripsi`       VARCHAR(200)  NOT NULL,
  `nominal`         DECIMAL(12,2) NOT NULL,
  `arah`            ENUM('TAMBAH', 'KURANG') NOT NULL DEFAULT 'TAMBAH',
  `justifikasi`     TEXT          NOT NULL,
  `dibatalkanPada`  DATETIME(3)   NULL,
  `dibatalkanOleh`  VARCHAR(191)  NULL,
  `dibuatOleh`      VARCHAR(191)  NULL,
  `createdAt`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)   NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `booking_line_items_bookingId_idx` (`bookingId`),
  INDEX `booking_line_items_bookingId_dibatalkanPada_idx` (`bookingId`, `dibatalkanPada`),
  CONSTRAINT `booking_line_items_bookingId_fkey`
    FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
