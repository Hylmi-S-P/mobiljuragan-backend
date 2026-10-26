-- Menambah kolom `lastActivityAt` pada `support_tickets`.
--
-- Alasan: tiket yang ditinggalkan pelanggan menumpuk di antrean tanpa batas.
-- Tidak ada cara membedakan percakapan yang masih hidup dari yang sudah mati,
-- jadi admin melihat daftar panjang berisi tiket yang sebenarnya sudah selesai.
--
-- Kolom ini dipakai penutupan otomatis: tiket yang tidak bergerak 24 jam
-- ditutup. Sengaja tidak memakai `updatedAt`, karena kolom itu ikut berubah saat
-- admin hanya mengganti kategori dan itu bukan tanda percakapan masih hidup.

-- 1. Tambah kolom. Nilai awalnya diisi waktu sekarang supaya baris lama tidak
--    langsung dianggap kedaluwarsa dan tertutup semua saat scheduler pertama
--    berjalan.
ALTER TABLE `support_tickets`
  ADD COLUMN `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- 2. Untuk tiket lama, pakai waktu pesan terakhir kalau ada. Ini membuat tiket
--    yang memang sudah lama diam ikut tertutup pada siklus pertama, sesuai maksud
--    aturannya, tanpa menutup tiket yang baru saja aktif.
UPDATE `support_tickets` AS st
JOIN (
  SELECT `ticketId`, MAX(`sentAt`) AS `terakhir`
  FROM `ticket_messages`
  GROUP BY `ticketId`
) AS tm ON tm.`ticketId` = st.`id`
SET st.`lastActivityAt` = tm.`terakhir`;

-- 3. Indeks untuk pencarian tiket yang sudah lama tidak bergerak.
CREATE INDEX `support_tickets_lastActivityAt_idx` ON `support_tickets`(`lastActivityAt`);