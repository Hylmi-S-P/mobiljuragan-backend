-- Dokumen yang ditolak disimpan terpisah dari teks alasan.
-- Klien mobile sebelumnya menebak dari kata kunci pada rejectionReason, sehingga
-- alasan umum seperti "foto buram" menandai ketiga dokumen sebagai ditolak.
ALTER TABLE `booking_documents` ADD COLUMN `rejectionTargets` TEXT NULL;

-- Isi ulang baris lama dari awalan teks `[Foto SIM A]: ...` yang dipakai versi
-- sebelumnya. Baris tanpa kata kunci dibiarkan NULL; klien masih punya jalur
-- cadangan untuk data seperti itu.
UPDATE `booking_documents`
SET `rejectionTargets` = JSON_ARRAY_APPEND(COALESCE(`rejectionTargets`, JSON_ARRAY()), '$', 'KTP')
WHERE `status` = 'REJECTED'
  AND (`rejectionReason` LIKE '%ktp%' OR `rejectionReason` LIKE '%KTP%' OR `rejectionReason` LIKE '%identitas%');

UPDATE `booking_documents`
SET `rejectionTargets` = JSON_ARRAY_APPEND(COALESCE(`rejectionTargets`, JSON_ARRAY()), '$', 'SIM')
WHERE `status` = 'REJECTED'
  AND (`rejectionReason` LIKE '%sim%' OR `rejectionReason` LIKE '%SIM%');

UPDATE `booking_documents`
SET `rejectionTargets` = JSON_ARRAY_APPEND(COALESCE(`rejectionTargets`, JSON_ARRAY()), '$', 'STATEMENT')
WHERE `status` = 'REJECTED'
  AND (`rejectionReason` LIKE '%pernyataan%'
    OR `rejectionReason` LIKE '%surat%'
    OR `rejectionReason` LIKE '%ttd%'
    OR `rejectionReason` LIKE '%tanda tangan%'
    OR `rejectionReason` LIKE '%meterai%');
