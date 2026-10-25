-- Mengubah `ticket_messages.body` dari `varchar(191)` menjadi `TEXT`.
--
-- Alasan: Prisma memetakan `String` tanpa anotasi menjadi `varchar(191)` di MySQL.
-- Balasan asisten AI panjangnya bisa melewati 500 karakter, sehingga isinya
-- terpotong diam-diam tanpa galat. Ini sempat terjadi dan baru ketahuan saat
-- memeriksa isi tabel secara langsung: balasan AI tersimpan tepat 191 karakter.
ALTER TABLE `ticket_messages` MODIFY `body` TEXT NOT NULL;
