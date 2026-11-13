-- Penutupan tiket oleh sistem perlu bisa dibedakan dari penutupan oleh
-- pelanggan, karena hanya yang pertama boleh dibuka lagi oleh pesan baru.
ALTER TABLE `support_tickets`
  ADD COLUMN `closedAt` DATETIME(3) NULL,
  ADD COLUMN `closedBySystem` BOOLEAN NOT NULL DEFAULT false;
