# Percakapan Pesanan — catatan diskusi

Status: **diputuskan 14 November 2026** — memakai model tiket otomatis (lihat §0).
Bagian 1–9 di bawah adalah catatan diskusi yang mendahului keputusan itu; isinya
tetap disimpan sebagai alasan, bukan sebagai rencana yang berlaku.

---

## 0. Keputusan

Tombol "Koordinasi Penjemputan via Chat CS" diganti menjadi **"Chat dengan CS"**
dan berperilaku seperti tiket bantuan biasa:

- **Tiket dibuat otomatis** saat tombol ditekan, dengan `bookingId` terisi. Tidak
  ada formulir. Satu pesanan hanya punya satu tiket terbuka; menekan tombol lagi
  membuka tiket yang sama.
- **Bot menjawab lebih dulu** dengan pesan default berisi data sewa (unit, plat,
  jadwal, titik jemput), data supir bila mode dengan supir, dan nomor WhatsApp
  kantor yang bisa dihubungi.
- **Alur tiket biasa berlaku**: bisa dialihkan ke CS manusia, memakai RAG,
  punya riwayat pesan, dan muncul di Customer Care.
- **Umur tiket 24 jam**, dan hitungannya ter-reset setiap ada pesan baru.

Model "tiket sebagai tugas tanpa ruang chat" (§3 pilihan C) **tidak dipakai**.
Model "tautan WhatsApp saja" (§3 pilihan A) juga tidak dipakai. WhatsApp tetap
ada, tetapi sebagai nomor yang disebutkan di dalam pesan bot — bukan sebagai
kanal utama.

Konsekuensi yang diterima: thread pesan, penanda belum dibaca, dan aturan
penutupan otomatis tetap perlu dibangun. Pekerjaannya lebih besar daripada model
tugas, tetapi pelanggan mendapat satu tempat menulis yang tercatat.

---

## 1. Keadaan sekarang

Di aplikasi pelanggan, pada tahap sewa berjalan, ada tombol
**"Koordinasi Penjemputan via Chat CS"**. Tombol itu membuka layar chat dengan
kunci percakapan `booking_<id>`.

Yang sebenarnya terjadi:

- **Pesan tidak pernah dikirim ke server.** `support_controller.dart` hanya
  mengirim ke backend bila kunci percakapan berawalan `ticket_`. Untuk
  `booking_<id>`, pesan hanya ditambahkan ke daftar di memori.
- **Percakapan tidak tersimpan.** Daftar percakapan adalah `Map` di memori,
  tanpa penyimpanan lokal. Aplikasi ditutup, percakapan hilang.
- **Yang menjawab hanya asisten AI umum.** Karena tidak ada `ticketId`,
  permintaan dikirim ke `POST /ai/chat` tanpa konteks tiket.
- **Tidak ada tiket yang lahir.** Customer Care hanya membaca tabel
  `support_tickets`, dan tabel itu tidak punya kolom `bookingId`.
- **Pesan "E-Ticket resmi" dikarang di HP.** `sendPickupCoordinationMessage`
  menyusun teks yang mengklaim "LUNAS Terverifikasi Otomatis" tanpa membaca
  status pembayaran dari server, dan masih menyebut COD yang sudah dihapus dari
  alur pelanggan.

Kesimpulan: tombol berlabel "via Chat CS" tidak terhubung ke CS, tidak menyimpan
apa pun, dan tidak meninggalkan jejak.

## 2. Kenapa ini penting

- Penyewa lepas kunci menghadapi ban bocor, unit mogok, kunci tertinggal, atau
  keterlambatan pengembalian **setelah** serah terima, dan tidak punya saluran
  resmi.
- Tidak ada bukti percakapan, sehingga sengketa tidak bisa ditelusuri.
- Staf tidak tahu ada pesan: tidak ada antrean, penanda, atau notifikasi.
- Label menjanjikan CS; yang datang adalah bot umum.

## 3. Pilihan yang dipertimbangkan

### A. Tombol langsung menjadi tautan WhatsApp

Tidak ada tiket. Sistem hanya mencatat "kanal dibuka", staf menulis catatan hasil
di pesanan.

- Kelebihan: paling murah, tidak ada antrean yang tercemar.
- Kekurangan: tidak ada pemegang, tidak ada status, mudah terlupakan.

### B. Tiket dengan penaut pesanan, pesan otomatisnya memuat tautan WhatsApp

Tiket tetap berupa thread percakapan; di dalamnya ada pesan sistem berisi konteks
dan tautan.

- Kelebihan: ada catatan, antrean, dan pemegang.
- Kekurangan: **dua tempat berbicara.** Thread di sistem tetap kosong atau hanya
  berisi satu pesan sistem. Penanda belum dibaca menyesatkan. Aturan penutupan
  otomatis 24 jam akan menutup tiket yang sebenarnya masih berjalan di WhatsApp.
  Kita tetap membayar harga penuh infrastruktur chat, tetapi hanya memakai
  sebagian manfaatnya.

### C. Tiket sebagai tugas, tautan WhatsApp sebagai aksi — **usulan**

Tiket lahir saat tombol ditekan, tetapi ia bukan ruang mengobrol. Ia daftar
pekerjaan: "pesanan ini butuh dihubungi".

- Kelebihan: ada antrean, pemegang, status, dan jejak waktu; tidak ada chat,
  penanda baca, atau aturan penutupan otomatis yang perlu dibangun.
- Kekurangan: isi percakapan tidak tersimpan di sistem (ada di WhatsApp).

## 4. Bentuk usulan C

**Saat pelanggan menekan tombol**, sistem membuat satu catatan tugas untuk
pesanan itu (aman dari duplikat: satu tugas aktif per pesanan), lalu langsung
membuka WhatsApp dengan pesan pertama yang sudah terisi kode pesanan, nama, unit
dan plat, jadwal, serta titik jemput.

**Di Customer Care**, tugas muncul sebagai baris ringkas — bukan percakapan:

```
MJ-20261113-9RTI · Yahya Pratama
Diminta 13 Nov 21.04 · Belum dihubungi
Unit: Toyota Rush · PA 1234 XY · Jemput 14 Nov 07.00

[ Buka WhatsApp ]  [ Sudah dihubungi ]  [ Selesai ]

Catatan: ______________________________________
```

Tidak ada kotak ketik, tidak ada pesan masuk, tidak ada status "belum dibaca".
Yang dilacak hanya tiga hal: apakah sudah dihubungi, kapan, dan apa hasilnya.

**Di aplikasi pelanggan**, tombol yang sama tetap ada di detail pesanan, dan
statusnya terlihat: "Permintaan koordinasi dikirim — tim akan menghubungi Anda".

**Pembagian peran:**

- WhatsApp — tempat berbicara: balasan, foto ban bocor, titik temu, pesan suara.
- Sistem — tempat mencatat: pesanan mana, kapan diminta, siapa menangani, apa
  hasilnya.

## 5. Kenapa WhatsApp, bukan chat dalam aplikasi

Yang didapat gratis: pesan sampai seketika, notifikasi bawaan HP, tanda dibaca,
kirim foto dan video, pesan suara, dan riwayat di HP kedua pihak.

Yang hilang: catatan isi percakapan di sistem. Akibatnya tidak ada transkrip
resmi saat sengketa; bukti yang ada adalah riwayat WhatsApp dan catatan singkat
di pesanan.

Untuk bisnis sewa kecil, itu biasanya cukup dan jauh lebih baik daripada keadaan
sekarang yang tidak punya apa pun. Kalau kantor memakai **WhatsApp Business** di
satu nomor kantor (gratis, bukan API berbayar), daftar chat bisa dicari
berdasarkan kode pesanan dan diberi label — WhatsApp Business berperan sebagai
daftar tiket de facto tanpa kita membangun daftar tiket.

## 6. Yang dipangkas dan yang tetap dibangun

**Tidak perlu:** thread pesan, penanda belum dibaca, pengecualian penutupan
otomatis, seksi percakapan di Pusat Bantuan, refactor kunci percakapan di
aplikasi, dan endpoint buat-atau-ambil thread.

**Tetap dibangun:** kolom penaut pesanan pada tiket, status tugas
(baru / dihubungi / selesai), tombol WhatsApp berkonteks, baris tugas di Customer
Care, dan penghapusan pesan "E-Ticket resmi" yang dikarang.

Ukurannya kira-kira sepertiga rencana penuh, dan tidak ada bagian yang harus
dibongkar kalau nanti tim memutuskan pindah ke chat dalam aplikasi.

## 7. Aturan penutupan 24 jam — analisis

Aturan yang berlaku sekarang:

- Tiket yang ditangani AI dan tidak bergerak 24 jam ditutup otomatis.
- Tiket berstatus selesai ditutup 24 jam kemudian.
- Tiket yang ditangani manusia dan masih terbuka tidak ikut ditutup.

Tiga cacat:

1. **Menghitung jam dinding, bukan jam kerja.** Tiket Jumat 17.00 ditutup Sabtu
   17.00, saat kantor tutup dan belum ada staf yang membacanya.
2. **Mengukur "ada tulisan baru", bukan "ada yang memperhatikan".** Staf yang
   hanya membaca tidak menghentikan jam; staf yang mengganti kategori justru
   me-reset jam.
3. **Memperlakukan semua tiket sama.** Tiket yang menunggu pelanggan dan tiket
   yang menunggu staf dihitung dengan angka yang sama.

Skenario yang gagal:

- Tiket yang menunggu staf ikut ditutup, padahal pelanggan mengira sedang
  ditangani.
- Setelah ditutup, pesan baru pelanggan ditolak; ia harus membuat tiket baru dan
  mengulang cerita.
- Akhir pekan menghapus antrean.

Untuk koordinasi, 24 jam salah di dua arah: terlalu lama untuk penjemputan besok
pagi, terlalu pendek untuk sewa tujuh hari.

### Usulan pengganti

| Objek | Kapan ditutup | Perilaku |
|---|---|---|
| Sesi AI yang ditinggalkan | Setelah beberapa jam tanpa balasan pelanggan | Ditutup dengan pesan jelas: "Sesi ini berakhir karena tidak ada balasan. Silakan buat tiket baru." |
| Tiket yang menunggu pelanggan | Setelah beberapa hari tanpa jawaban | Ditutup, tetapi bisa dibuka lagi oleh pelanggan |
| Tiket yang menunggu staf | **Tidak pernah otomatis** | Kalau terlalu lama, naikkan prioritas dan beri peringatan |
| Tiket selesai | Setelah beberapa hari | Diarsipkan; pesan baru dari pelanggan membukanya kembali |
| Tugas koordinasi | Saat pesanan selesai, atau saat jadwal jemput terlewat | Ditutup dengan catatan hasil |

Dua prinsip:

- **Tutup hanya yang menunggu pelanggan, jangan yang menunggu staf.**
- **Penutupan harus bisa dibatalkan.** Pesan baru dari pelanggan seharusnya
  membuka kembali tiket yang diarsipkan, bukan ditolak.

## 8. Keputusan yang sudah diambil

1. **Satu tiket terbuka per pesanan.** Setelah tiket ditutup, masalah baru membuat
   tiket baru. Tidak ada dua thread berjalan untuk satu pesanan.
2. **Cakupan: seluruh masa sewa** — koordinasi penjemputan, kendala armada
   (ban bocor, mogok, kecelakaan), pengaduan, dan pertanyaan lain. Kategori diisi
   bot dari isi pesan pertama, bukan dipilih pelanggan.
3. **Masa tenggang pasca-sewa: 7 hari** setelah `endDateTime`. Tombol tetap
   muncul di pesanan `COMPLETED` selama masa itu.
4. **Nomor WhatsApp: `0812-3456-7890`** — nomor dummy yang sudah dipakai di RAG
   (kategori darurat dan handoff staf). Diganti satu tempat saat nomor asli ada.
5. **Pelanggan boleh menutup tiketnya sendiri**; sistem menutup setelah 24 jam
   tanpa pesan.
6. **Staf tidak boleh menutup tiket** (sudah berlaku, `TICKET_CLOSE_BY_SYSTEM`).
   Karena pelanggan juga sering tidak menutup, **sistem yang menutup semuanya**:
   tiket AI maupun tiket yang sudah dialihkan ke manusia ditutup setelah 24 jam
   tanpa pesan. Bila pesan terakhir datang dari pelanggan dan belum dijawab,
   catatan penutupan menyebutkannya ("ditutup otomatis tanpa balasan petugas")
   dan tiket itu ditandai di arsip supaya bisa ditinjau.
7. **Tiket yang ditutup sistem bisa dibuka lagi oleh pesan pelanggan dalam 7
   hari.** Statusnya kembali `OPEN` pada thread yang sama, dan riwayatnya mencatat
   pembukaan ulang. Setelah 7 hari, pelanggan membuat tiket baru.

Keputusan 6 dan 7 saling menutup celah: pelanggan tidak perlu rajin menutup
tiket, dan tidak perlu membuat tiket baru hanya karena balasannya terlambat
sehari.

## 9. Urutan pengerjaan

1. **Backend** — kolom `bookingId`, endpoint buat-atau-ambil yang idempoten,
   pesan pembuka dari bot, aturan penutupan 24 jam untuk semua tiket, dan
   pembukaan ulang oleh pesan pelanggan.
2. **Dashboard** — badge kode pesanan, filter chip, konteks pesanan di panel
   detail tiket.
3. **Mobile** — tombol "Chat dengan CS", penghapusan pesan E-Ticket palsu,
   tiket pesanan di Pusat Bantuan.

Tiap tahap harus lulus pemeriksaan sebelum lanjut.
