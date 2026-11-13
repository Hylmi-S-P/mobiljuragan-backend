-- Pesanan bisa dibatalkan saat bukti transfer masih menunggu pemeriksaan.
-- Uangnya belum tentu masuk, jadi catatan refund perlu penanda bahwa kantor
-- harus mencocokkan mutasi bank sebelum mentransfer balik.
ALTER TABLE `booking_refunds`
  ADD COLUMN `danaTerverifikasi` BOOLEAN NOT NULL DEFAULT true;
