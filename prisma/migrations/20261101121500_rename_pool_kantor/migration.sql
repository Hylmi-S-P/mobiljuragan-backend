-- Data lama: titik serah terima masih memakai nama "Pool Kantor".
-- Diseragamkan ke nama resmi "Kantor MobilJuragan" (tempat yang sama).
UPDATE `bookings`
SET `pickupLocation` = 'Kantor MobilJuragan'
WHERE `pickupLocation` LIKE '%Pool Kantor%';
