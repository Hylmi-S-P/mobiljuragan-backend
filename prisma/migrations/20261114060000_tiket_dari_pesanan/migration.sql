-- Tiket bantuan bisa lahir dari satu pesanan (tombol "Chat dengan CS").
-- Satu pesanan hanya punya satu tiket terbuka; tiket lama yang sudah ditutup
-- tetap menyimpan tautannya supaya riwayat percakapan bisa ditelusuri.
ALTER TABLE `support_tickets` ADD COLUMN `bookingId` VARCHAR(191) NULL;

CREATE INDEX `support_tickets_bookingId_idx` ON `support_tickets`(`bookingId`);

ALTER TABLE `support_tickets`
  ADD CONSTRAINT `support_tickets_bookingId_fkey`
  FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
