# Analisis & Panduan Solusi: Kapasitas Database Bukti Transfer Pembayaran

**Target Komponen:** Database MariaDB & REST API (`backend/`)  
**Status:** Mitigasi Darurat Selesai (Migrasi `LONGTEXT`), Solusi Permanen Disiapkan  
**Terkait Tugas:** Paket 3 (Masalah Kapasitas DB Bukti Transfer)

---

## 1. Identifikasi Akar Masalah (Root Cause)

Pada arsitektur awal, kolom bukti transfer `proofImageUrl` pada model `Payment` (`backend/prisma/schema.prisma`) dideklarasikan sebagai:
```prisma
proofImageUrl String? @db.Text
```

### Karakteristik Tipe Data di MySQL / MariaDB:
- Tipe data `TEXT` memiliki batas ukuran biner maksimum **65.535 byte (~64 KB)**.
- Aplikasi mobile Android saat ini mengambil foto bukti transfer langsung dari kamera smartphone (kamera modern rata-rata 12–50 MP) yang menghasilkan file JPEG/PNG berukuran **1 s.d. 5 MB**.
- Saat aplikasi mobile meng-encode foto tersebut menjadi string Base64 (`data:image/jpeg;base64,...`), ukurannya membengkak sekitar **33%** (menjadi **1,3 s.d. 6,7 MB**).
- Ketika payload Base64 tersebut di-POST ke backend, MariaDB menolak penyimpanan dengan galat fatal:
  ```text
  Error 1406 (22001): Data too long for column 'proofImageUrl' at row 1
  ```
  yang berujung pada HTTP 500 (Internal Server Error) pada server Express.

---

## 2. Tindakan Penanganan Segera (Immediate Mitigation - SUDAH DILAKUKAN)

Untuk mencegah server crash dan memastikan pelanggan dapat segera mengirimkan bukti transfer tanpa terblokir truncation error:

1. **Migrasi Skema Prisma:**
   Mengubah anotasi tipe kolom pada `backend/prisma/schema.prisma`:
   ```prisma
   proofImageUrl String? @db.LongText
   ```
2. **Eksekusi DDL pada Database MariaDB:**
   ```sql
   ALTER TABLE `payments` MODIFY `proofImageUrl` LONGTEXT NULL;
   ```
3. **Penyimpanan Artefak Migrasi:**
   Disimpan pada `backend/prisma/migrations/20261025000000_ubah_proof_image_url_longtext/migration.sql`.
4. **Regenerasi Klien Prisma:**
   `prisma generate` dijalankan sehingga tipe TypeScript pada kode backend mengenali kapasitas kolom hingga 4 GB.

---

## 3. Evaluasi Risiko: Mengapa `LONGTEXT` Masih Menyisakan Masalah?

Meskipun migrasi ke `LONGTEXT` menghilangkan error fatal data truncation secara instan, menyimpan file biner Base64 berukuran megabyte di dalam database relasional merupakan **anti-pattern arsitektur jangka panjang**:

1. **Pembengkakan Tabel & InnoDB Buffer Pool:**
   Data string berukuran megabyte disimpan pada off-page overflow pages di InnoDB (`payments.ibd`). Ini menghabiskan cache memori (buffer pool) yang seharusnya dialokasikan untuk query transaksional cepat.
2. **Degradasi Performa Query Administratif:**
   Saat admin membuka daftar verifikasi pembayaran (`GET /api/v1/admin/payments`), transfer data jaringan antara database dan backend membengkak drastis jika payload Base64 ikut terambil.
3. **Ukuran Backup Database:**
   Ukuran dump basis data (`mysqldump`) akan meledak dari megabyte menjadi puluhan gigabyte dalam beberapa bulan operasional sewa, memperlambat proses replikasi dan backup otomatis.

---

## 4. Cetak Biru Solusi Permanen (Rekomendasi Arsitektur)

Untuk menyelesaikan masalah ini secara tuntas dan efisien, direkomendasikan implementasi dua lapis perbaikan berikut:

### Lapis 1: Kompresi Sisi Klien Mobile (Flutter)
Sebelum mengirimkan gambar ke backend, aplikasi Flutter harus melakukan kompresi di perangkat lokal:
- Menggunakan pustaka `flutter_image_compress`.
- Menetapkan batas resolusi maksimum 1280x720 atau 1920x1080 piksel, dengan kualitas WebP/JPEG 75–80%.
- **Dampak:** Ukuran file foto 4 MB akan turun menjadi **150–300 KB** tanpa mengurangi keterbacaan nomor referensi transfer, tanggal mutasi, dan nominal pembayaran.

### Lapis 2: Endpoint File Upload Multipart & Penyimpanan Terpisah (Backend)
1. **Endpoint Khusus Upload:**
   Buat endpoint `POST /api/v1/upload/payment-proof` menggunakan pustaka `multer`:
   - Validasi MIME type: hanya menerima `image/jpeg`, `image/png`, `image/webp`.
   - Batas maksimum ukuran file: 5 MB.
2. **Penyimpanan Berkas (Storage Engine):**
   - **Lingkungan Pengembangan / On-Premise Merauke:** Simpan ke folder lokal terpisah `backend/uploads/proofs/` dan sajikan secara statis melalui Express / Nginx dengan caching header.
   - **Lingkungan Produksi Cloud:** Unggah langsung ke Object Storage yang kompatibel dengan S3 (AWS S3, Google Cloud Storage, Cloudflare R2, atau MinIO).
3. **Penyimpanan di Basis Data:**
   Kolom `proofImageUrl` di basis data hanya menyimpan URL relatif atau tautan CDN publik berukuran < 255 karakter:
   ```text
   /uploads/proofs/2026/10/bukti-MJ-20261024-YYCZ.webp
   ```
   atau:
   ```text
   https://cdn.mobiljuragan.com/proofs/2026/10/bukti-MJ-20261024-YYCZ.webp
   ```

Dengan pendekatan dua lapis ini, performa database tetap optimal, biaya transfer jaringan minim, dan pelanggan tetap dapat mengunggah bukti pembayaran dengan lancar.
