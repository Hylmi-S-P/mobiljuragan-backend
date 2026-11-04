-- Template dokumen berubah dari isi terstruktur menjadi berkas unggahan admin.
--
-- Admin mengunggah PDF atau Word yang sudah jadi, dan pelanggan mengunduh
-- berkas itu apa adanya. Kolom `isi` yang menyimpan struktur JSON tidak dipakai
-- lagi, diganti rujukan ke berkas di penyimpanan objek.
--
-- Baris lama dihapus karena isinya hanya placeholder bawaan sistem yang dibuat
-- saat tabel ini pertama kali dipakai, dan tidak punya berkas yang bisa
-- diunduh. Template baru akan dibuat ulang dari berkas bawaan pada permintaan
-- pertama. Baris buatan admin tidak ikut terhapus.

DELETE FROM `document_templates` WHERE `dibuatOleh` = 'sistem';

ALTER TABLE `document_templates`
  DROP COLUMN `isi`,
  ADD COLUMN `berkasObjectKey` VARCHAR(255) NOT NULL,
  ADD COLUMN `berkasNama`      VARCHAR(255) NOT NULL,
  ADD COLUMN `berkasMime`      VARCHAR(100) NOT NULL,
  ADD COLUMN `berkasByte`      INTEGER      NOT NULL,
  ADD COLUMN `berkasSha256`    CHAR(64)     NOT NULL;
