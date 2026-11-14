-- Tambah kolom waktu serah terima armada.
--
-- Jam sewa yang diisi pelanggan adalah rencana, bukan kenyataan. Tanpa kolom
-- ini, tidak ada catatan kapan kunci benar-benar berpindah tangan.
ALTER TABLE `bookings` ADD COLUMN `handedOverAt` DATETIME(3) NULL;
