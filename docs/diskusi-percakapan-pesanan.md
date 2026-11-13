# Percakapan Pesanan — catatan diskusi

Status: **belum diputuskan tim.** Dokumen ini mencatat keadaan, pilihan, dan usulan
supaya diskusi tidak perlu mengulang dari awal. Tidak ada kode yang mengikuti
dokumen ini sampai keputusan di bagian akhir diambil.

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

## 8. Yang belum diputuskan

1. Cakupan: hanya koordinasi penjemputan, atau seluruh masa sewa termasuk
   kendala (ban bocor, mogok, pengaduan)?
2. Masa tenggang pasca-sewa: 3 hari atau 7 hari sebelum percakapan dikunci?
3. Jalur darurat: cukup nomor kantor, atau perlu nomor petugas jaga di luar jam
   kerja?
4. Penandaan kendala: siapa yang menentukan sebuah percakapan menjadi "Kendala
   Armada" — staf, atau otomatis?
5. Siapa yang boleh membuka tugas: hanya pelanggan, atau staf juga bisa membuka
   lebih dulu saat menyerahkan unit?
6. Nomor WhatsApp: satu nomor kantor atau nomor petugas jaga?
7. Catatan hasil: wajib diisi sebelum tugas ditutup, atau sukarela?
8. Aturan penutupan: berapa lama sesi AI dibiarkan terbuka, berapa hari tiket
   selesai disimpan, dan apakah tiket yang menunggu staf perlu peringatan
   otomatis?

## 9. Urutan pengerjaan bila disetujui

1. **Backend** — kolom penaut pesanan, status tugas, endpoint buat-atau-ambil
   yang idempoten, aturan kedaluwarsa tugas.
2. **Dashboard** — baris tugas di Customer Care, filter dan badge kode pesanan.
3. **Mobile** — tombol WhatsApp berkonteks, status tugas di kartu pesanan,
   penghapusan pesan E-Ticket palsu.

Tiap tahap harus lulus pemeriksaan sebelum lanjut. Kalau tim memutuskan hal
berbeda setelah tahap 1, yang berubah hanya tampilan — bukan data.
