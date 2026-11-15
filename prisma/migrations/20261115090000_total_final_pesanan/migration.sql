-- Total yang dikunci saat admin menetapkan tarif.
--
-- Sebelumnya tagihan pembayaran memakai `quotedAmount` mentah, sehingga baris
-- penyesuaian (diskon, cashback, biaya tambahan) tidak pernah ikut terhitung.
-- Kolom ini menyimpan hasil akhirnya sekali, pada saat "Tetapkan Tarif &
-- Lanjutkan" ditekan, lalu tidak berubah lagi.
ALTER TABLE `bookings` ADD COLUMN `finalAmount` DECIMAL(12, 2) NULL;
