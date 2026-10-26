-- Menambah kolom `sequence` pada `ticket_messages`.
--
-- Alasan: urutan pesan sebelumnya hanya bersandar pada `sentAt`. Di mesin lokal
-- itu cukup karena selisih waktunya masih terlihat, tetapi begitu pesan datang
-- bersamaan dari jaringan nyata, dua pesan bisa mendapat `sentAt` yang sama dan
-- urutannya menjadi tidak pasti. Kolom ini memberi urutan tegas per tiket.
--
-- Tiga langkah, berurutan. Tidak boleh digabung, karena kalau kolom langsung
-- diberi indeks unik sementara semua baris masih bernilai 0, indeksnya gagal
-- dibuat (banyak baris dalam satu tiket akan bentrok).

-- 1. Tambah kolom dengan nilai sementara 0.
ALTER TABLE `ticket_messages` ADD COLUMN `sequence` INTEGER NOT NULL DEFAULT 0;

-- 2. Isi ulang nomor urut untuk pesan yang sudah ada, per tiket, menurut `sentAt`.
--    `id` dipakai sebagai pemecah seri supaya hasilnya tetap sama tiap dijalankan.
UPDATE `ticket_messages` AS tm
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (PARTITION BY `ticketId` ORDER BY `sentAt` ASC, `id` ASC) AS `rn`
  FROM `ticket_messages`
) AS ranked ON ranked.`id` = tm.`id`
SET tm.`sequence` = ranked.`rn`;

-- 3. Baru pasang indeks unik gabungan.
CREATE UNIQUE INDEX `ticket_messages_ticketId_sequence_key`
  ON `ticket_messages`(`ticketId`, `sequence`);
