# Keputusan teknis

Catatan ringan keputusan yang **mengikat** pekerjaan berikutnya. Bukan diskusi
panjang: satu keputusan, satu alasan, satu konsekuensi. Aturan alur pesanan ada
di `booking-lifecycle.md`; keputusan bisnis bernomor B1–B13 ada di
`RENCANA-EKSEKUSI.md` §12.

## Uang dan tarif

**Tarif dihitung server, bukan diketik staf.** `quotedAmount` = harga sewa
(`Vehicle.pricePerDay × hari`) + jasa supir (`TariffSetting.driverDailyRate ×
hari`, hanya mode dengan supir). Staf tidak bisa menimpa komponen dasar; semua
diskon, cashback, biaya rute, dan tambahan medan dicatat sebagai
`BookingLineItem` (TAMBAH/KURANG + justifikasi). Alasannya: angka yang diketik
bebas tidak bisa diaudit, dan selisih antara layar pelanggan dan tagihan adalah
sumber sengketa. Konsekuensi: `routeScope` tidak lagi wajib saat konfirmasi
tarif, dan `routeFee` tidak pernah menjadi kolom.

**Batas bayar 2 jam, ditegakkan server.** `Payment.expiresAt` diisi saat tagihan
dibuat dan dibaca oleh `expireOverduePayments()` di job siklus hidup. Sebelumnya
kolom itu hanya ditulis dan tidak pernah dibaca, sehingga hitungan mundur di
aplikasi adalah satu-satunya penegak aturan.

**Refund selalu lewat transfer bank.** QRIS yang dipakai adalah QRIS statis
merchant, tanpa gateway dan tanpa transaction ID, jadi dana tidak bisa
dikembalikan ke sumbernya. Rekening diminta saat pelanggan membatalkan, dan
boleh dilengkapi setelahnya lewat `PATCH /bookings/:id/refund-account` selama
kantor belum menutup antreannya.

**Pembayaran tunai tidak dipilih pelanggan.** `PaymentMethod.CASH` tetap ada di
enum untuk data lama, tetapi `createPaymentSchema` menolaknya dan aplikasi tidak
lagi menampilkan tab "Bayar di Tempat". Tunai dicatat staf lewat aksi kantor.

## Waktu dan status

**Satu daftar status yang mengunci armada.** `BOOKING_BLOCKING_STATUSES` di
`src/lib/bookingStage.ts` dipakai katalog, cek bentrok, dan batas pesanan aktif.
Sebelumnya katalog memakai daftar yang lebih luas daripada cek bentrok, sehingga
pesanan yang ditinggalkan menyembunyikan unit tanpa batas sementara tanggal yang
sama masih bisa dipesan orang lain.

**Tenggat dokumen disimpan di `Booking`, bukan `BookingDocument`.** Baris
dokumen baru lahir saat unggah pertama, sedangkan tenggat harus ada sejak
pesanan dibuat. Tiga kolom: `documentDeadlineAt`, `documentDeadlineState`
(`RUNNING`/`PAUSED`/`NONE`), `documentRejectedAt`.

**Jam berhenti selama menunggu admin.** Tenggat unggah pertama 2 jam, lalu
`PAUSED` sampai admin memutuskan. Penolakan memberi 12 jam baru. Batas keras
`startDateTime − 12 jam` supaya dokumen tidak masuk setelah sewa dimulai.

**Penutupan tiket milik sistem.** Staf tidak bisa menutup tiket
(`409 TICKET_CLOSE_BY_SYSTEM`); pelanggan boleh. Sistem menutup semua tiket
setelah 24 jam tanpa pesan, dan pesan pelanggan dalam 7 hari membuka ulang.
Alasannya: pelanggan sering tidak menutup, dan tiket yang menggantung membuat
antrean tidak pernah bersih.

**Penutupan memakai `lastActivityAt`, bukan `updatedAt`.** `updatedAt` ikut
berubah saat admin mengganti kategori tiket, sehingga tiket yang belum dijawab
bisa terlihat baru disentuh dan lolos dari penutupan.

## Data dan cache

**Cache pesanan terikat pemiliknya di lapisan DAO.** Setiap pembacaan menerima
`userId`; `null` berarti mode tamu dan hanya melihat baris tanpa pemilik.
Sinkronisasi menghapus baris yang tidak ada di server, dan akun yang ditolak
server (401/403/404) membersihkan barisnya sendiri. Sebelumnya mode tamu
mengembalikan **semua** baris, sehingga riwayat akun yang sudah dihapus tetap
tampil.

**Tidak ada data karangan di perangkat.** Pesan "E-Ticket resmi", klaim "LUNAS
Terverifikasi Otomatis", nomor rekening contoh, koordinat titik jemput cadangan,
dan nominal refund 85% semuanya dihapus. Angka dan teks yang menyangkut uang
atau status datang dari server.

**Tiket pesanan lahir di server.** Tombol "Chat dengan CS" memanggil
`POST /tickets/booking/:id`; server membuat satu tiket per pesanan berisi
ringkasan sewa dan nomor kantor. Aplikasi tidak lagi menyusun percakapan sendiri
di memori, yang hilang begitu aplikasi ditutup.

**Peristiwa tiket lewat WebSocket, bukan SSE.** Saluran SSE memeriksa database
tiap dua detik per penonton; dua ratus pelanggan membuka tiket berarti sekitar
seratus kueri per detik hanya untuk menjawab "ada yang baru?". Server sekarang
menyiarkan peristiwa saat pesan atau status berubah
(`src/lib/ticketEvents.ts` → `src/ws/ticketSocket.ts`), dan klien berlangganan
ke `/api/v1/ws/tickets`. Klien membuang peristiwa `pesan` dengan `sequence` yang
sudah lewat supaya sambung ulang tidak menggandakan pesan. Rincian dan syarat
deploy ada di `docs/adr-websocket-tiket.md`.

## Alat dan proses

**Jangan pakai `Set-Content`/`Add-Content` PowerShell 5.1 untuk berkas kode.**
Keduanya menambah BOM dan mendouble-encode karakter non-ASCII. Pakai alat
`edit`/`write`, atau skrip Node dengan `fs.writeFileSync`.

**Setiap kolom baru yang harus ikut di respons perubahan status wajib
ditambahkan ke `include` di `updateStatusWithHistoryAndAudit`.** Respons dibaca
ulang dari transaksi yang sama; kolom yang tidak di-`include` akan tampak hilang
walaupun tersimpan.

**Test e2e tinggal di dalam repo** (`mobiljuragan-backend/test/e2e/`), memakai
database terpisah `mobiljuragan_test` dan port 4100. Harness di luar repo
(`.verify/`) sudah terbukti hilang dan tidak bisa dijalankan ulang.
