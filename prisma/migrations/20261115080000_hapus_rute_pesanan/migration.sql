-- Hapus kolom rute pesanan.
--
-- Rute perjalanan tidak pernah ditetapkan di sistem: dashboard tidak pernah
-- mengirimnya saat konfirmasi tarif, dan biaya rute dicatat sebagai baris
-- penyesuaian manual. Kolomnya selalu NULL, jadi tidak ada data yang hilang.
-- Rute kini hanya melekat pada supir sebagai spesialisasi (drivers.routeScope).
ALTER TABLE `bookings` DROP COLUMN `routeScope`;
