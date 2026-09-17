# Context Dump: MobilJuragan MVP — Dari Lo-Fi ke Hi-Fi

> Tanggal pembaruan: 17 September 2026.
> Riwayat pembaruan: 31 Aug 2026 (baseline) → 07 Sep 2026 (Lo-Fi) → 15 Sep 2026 (Style Guide) → 16 Sep 2026 (Hi-Fi Booking Flow) → 17 Sep 2026 (Eksperimental Hi-Fi Mobile 11 Layar Penuh & Traveloka Trust Blue).
> Status dump: **lengkap berdasarkan bukti Figma live, screenshot, dan riwayat sesi Figma MCP**.
> Tujuan: menjadi snapshot mandiri agar agent berikutnya dapat melanjutkan pekerjaan Hi-Fi, memelihara konsistensi dengan Lo-Fi dan Style Guide, atau mengaudit hasil transformasi Lo-Fi → Hi-Fi tanpa menebak ulang struktur.
> Aturan: bagian berlabel **terverifikasi** berasal dari metadata Figma, screenshot, atau state live Figma MCP. Bagian berlabel **catatan/risiko** adalah interpretasi atau hal yang perlu dicek ulang.
> Keamanan: secret/API key tidak ditulis di dump ini.

---

## 0. Ringkasan eksekutif

Dokumen ini merangkut perjalanan desain MobilJuragan MVP dari tahap eksplorasi Information Architecture dan User Flow, kemudian Lo-Fi Wireframe, Style Guide Lo-Fi, dan akhirnya Hi-Fi Booking Flow.

Tiga lapisan utama:

1. **Information Architecture & User Flow** — pondasi produk sebelum menggambar.
2. **Lo-Fi Wireframe** — struktur monokrom untuk menguji Laws of UX.
3. **Hi-Fi Booking Flow & Ecosystem** — implementasi visual 11 layar penuh mengikuti token Traveloka Trust Blue (`#0194F3`).

File Figma utama:

- File key: `Rxdv5kRYC8NiQpdWJhoIGJ`
- Nama: **MobilJuragan MVP — UI UX Case Study**

Total page Figma: **15 page** (termasuk halaman master baru `EKSPERIMENTAL LOFI MOBILE` `1058:320` dan `EKSPERIMENTAL HIFI MOBILE` `1058:321`).

---

## 1. Tujuan akademik dan konteks bisnis

Mata kuliah: **Desain UI dan UX** (`VTK50017`), 3 SKS, metode CBL.

Bisnis: CV. Mobil Juragan Express Transport, Merauke, Papua Selatan.

Layanan: rental mobil, servis ringan, cuci & salon.

Sumber referensi bisnis: `https://mobiljuragan.com` dan `https://mobiljuragan.com/order_mobil_web`.

Arah desain (sumber: `DESIGN.md`):

> Reading this as: aplikasi layanan rental mobil lokal untuk pelanggan umum dan admin usaha di Merauke, dalam bahasa visual "layanan transportasi yang jelas, praktis, dapat dipercaya", dial ENERGY 2 / RHYTHM 2 / MOTION 1.

---

## 2. Tahap Information Architecture & User Flow (minggu ke-2)

Output minggu ke-2:

- Folder `IA/` berisi 8 diagram `.drawio`:
  - `00_Master_IA_MobilJuragan.drawio`
  - `01_IA_Beranda_Pelanggan.drawio`
  - `02_IA_Pemesanan_Mobil.drawio`
  - `03_IA_Status_Booking.drawio`
  - `04_IA_Bantuan_Pelanggan.drawio`
  - `05_IA_Operasional_Booking_Admin.drawio`
  - `06_IA_Manajemen_Armada.drawio`
  - `07_IA_Customer_Care_Admin.drawio`
- Folder `user-flow/` berisi 33 diagram `.drawio` hitam-putih, dibagi:
  - `primary flow/mobile app/` — 4 diagram.
  - `primary flow/dashboard web/` — 7 diagram.
  - `alternate flow/mobile app/` — 4 diagram.
  - `alternate flow/dashboard web/` — 7 diagram.
  - `error flow/mobile app/` — 4 diagram.
  - `error flow/dashboard web/` — 7 diagram.
- Dua dokumen Word: `MobilJuragan_IA_dan_User_Flow.docx` dan `Penjelasan_Naratif_IA_dan_User_Flow_MobilJuragan.docx`.

Validasi: semua file valid sebagai XML, tidak ada dangling connection, hanya fill `#FFFFFF` dan `#000000` di flowchart.

Tidak ada perubahan Figma pada tahap ini.

---

## 3. Tahap Lo-Fi Wireframe (minggu ke-3)

Status: **sudah dibangun di Figma, menunggu review dosen dan submission LMS**.

Brief: 3 layar customer mobile 390 × 844 px, monokrom, dengan anotasi Laws of UX.

### 3.1 Batch 1 (07/09/26)

Page Figma yang dibuat:

| Page ID | Nama |
|---|---|
| `641:308` | `Lo-Fi — Beranda` |
| `641:309` | `Lo-Fi — Pilih Kendaraan` |
| `641:310` | `Lo-Fi — Tinjau Pesanan` |
| `641:311` | `Lo-Fi — Anotasi` |

Frame dan node utama:

- `658:308` — `Screen / Lo-Fi — Beranda`, 390 × 844. App bar `MobilJuragan` / `Merauke`, image placeholder dengan diagonal X, heading, empty state `Belum ada booking aktif`, label `Data contoh`, CTA `Pesan Mobil` full-width 358 × 56 px di y=524, bottom nav 4 tab dengan `Beranda` aktif.
- `659:308` — `Screen / Lo-Fi — Pilih Kendaraan`, 390 × 844. Back, filter icon, chips `Semua / MPV / SUV / Pickup`, 4 kartu dari dataset resmi, panel `5 kendaraan lainnya`, bottom nav dengan `Pesan` aktif.
- `660:308` — `Screen / Lo-Fi — Tinjau Pesanan`, 390 × 844. Back, edit icon, 4 card `Kendaraan / Jadwal / Opsi Rental / Data Pemesan`, banner tarif, CTA `Konfirmasi Booking` full-width 358 × 56 px di y=598, link `Kembali ubah data`, bottom nav dengan `Status` aktif.
- `674:308` — `Ringkasan Anotasi Lo-Fi`, 1800 × 1080. Tabel 9 baris Laws of UX, user-goal per layar, catatan integritas data.

Distribusi Laws of UX:

1. Jakob's Law — bottom nav Beranda.
2. Fitts's Law — CTA Pesan Mobil.
3. Law of Proximity — image + heading layanan.
4. Hick's Law — empat filter chips.
5. Miller + Chunking — satu kartu per kendaraan.
6. Law of Proximity — nama + plat.
7. Miller + Chunking — empat section pada Tinjau Pesanan.
8. Law of Proximity — pasangan label : nilai.
9. Fitts's Law — CTA Konfirmasi Booking.

Aturan yang dipatuhi:

- Monokrom `#000`, `#4D4D4D`, `#B3B3B3`, `#E5E5E5`, `#FFFFFF`.
- Inter 12/14/20.
- Frame 390 × 844, margin 16 px.
- CTA full-width di area thumb.
- Tidak ada angka harga, rating, review, testimoni, atau data customer fiktif tanpa label.
- Tarif memakai `Tarif dikonfirmasi tim MobilJuragan` dan banner konfirmasi.
- Sembilan nama + plat mengikuti dataset resmi.

### 3.2 Batch 2 (09/09/26)

Page Figma yang dibuat:

| Page ID | Nama | Frame | Node sumber hi-fi |
|---|---|---|---|
| `721:309` | `Lo-Fi — Detail Kendaraan` | `721:312` (`Screen / Lo-Fi — Detail Kendaraan`, 390 × 844) | `Screen / Vehicle Detail` (`16:147`) |
| `721:310` | `Lo-Fi — Tanggal & Waktu` | `722:308` (`Screen / Lo-Fi — Tanggal & Waktu`, 390 × 844) | `Screen / Date & Time` (`17:70`) |
| `721:311` | `Lo-Fi — Opsi Rental` | `723:308` (`Screen / Lo-Fi — Opsi Rental`, 390 × 844) | `Screen / Rental Options` (`17:129`) |

Mulai batch 2, setiap layar baru memakai 5 callout dengan penomoran global 10–24 dan urutan Fitts → Hick → Jakob → Miller + Chunking → Proximity. Ringkasan anotasi di `Ringkasan Anotasi Lo-Fi` (`674:308`) ditambah 15 baris (10–24); baris 1–9 tidak diubah.

### 3.3 Koreksi lanjutan

Label `Data contoh` kedua ditambahkan di header bulan kalender `Lo-Fi — Tanggal & Waktu` (node `747:308`). Screenshot `lofi_exports/06_tanggal_waktu.png` diperbarui.

### 3.4 Pemisahan anotasi

| Frame | Node | Isi |
|---|---|---|
| `Ringkasan Anotasi Lo-Fi (Batch 1)` | `748:308` | 9 baris anotasi Batch 1 |
| `Ringkasan Anotasi Lo-Fi (Batch 1 + Batch 2)` | `674:308` | 24 baris gabungan Batch 1 dan Batch 2 |

Evidence: `lofi_blueprint.md` dan screenshot di `lofi_exports/`.

---

## 4. Tahap Style Guide & Component Library Lo-Fi (minggu ke-5)

Status: **sudah dibangun di Figma, node ID terverifikasi langsung via `use_figma`**.

Page Figma yang dibuat:

| Page ID | Nama | Tipe | Posisi |
|---|---|---|---|
| `825:47` | `Lo-Fi — Style Guide` | Page baru (Style Guide + Component Library) | Append setelah `Lo-Fi — Anotasi` |

Struktur root frame:

- Root `Style Guide — Lo-Fi` (`825:48`), 1440 × 2465, auto-layout VERTICAL, padding 64, item spacing 48.

Section:

| Node ID | Nama | Tinggi | Tujuan |
|---|---|---:|---|
| `825:49` | Title | 39 | `Lo-Fi Style Guide & Component Library` |
| `825:50` | Lead | 17 | Paragraf pembuka |
| `826:36` | Section / Color Tokens | 278 | 6 swatch grayscale + interactive |
| `834:66` | Section / Typography | 521 | 4 sample typography |
| `834:369` | Section / Components | 507 | Showcase 3 master component |
| `841:36` | Section / Accessibility Notes | 309 | 5 catatan WCAG & tap target |
| `841:337` | Section / Spacing Scale | 148 | 6 token spacing 8 px |
| `841:365` | Section / Implementation Notes | 182 | Catatan hard-coded token & font fallback |

### 4.1 Color Tokens (Section `826:36`)

| Token | Hex | Note |
|---|---|---|
| `grayscale/white` | `#FFFFFF` | Background |
| `grayscale/100` | `#F5F5F5` | Card / Input fill |
| `grayscale/300` | `#CCCCCC` | Border / Placeholder text |
| `grayscale/900` | `#1A1A1A` | Text primary |
| `interactive/default` | `#0066FF` | Active / Focus (default) |
| `interactive/mono` | `#000000` | Active / Focus (mono) |

Token `interactive/default` dan `interactive/mono` disimpan terpisah agar designer bisa memilih accent monokrom atau warna tanpa memecah komponen.

### 4.2 Typography Styles (Section `834:66`)

| Style | Ukuran | Weight |
|---|---:|---|
| `Type / Heading / Large` | 24 px | Bold |
| `Type / Heading / Medium` | 18 px | Medium |
| `Type / Body / Regular` | 14 px | Regular |
| `Type / Caption` | 12 px | Regular |

Caveat: Inter tidak menyediakan style `SemiBold`. Untuk `Heading/Medium` dipakai `Medium`.

### 4.3 Component Library (Section `834:369`)

- `WF Button` (Component Set, `835:43`):
  - `Style=Primary` (`835:37`)
  - `Style=Secondary` (`835:39`)
  - `Style=Disabled` (`835:41`)
- `WF Input Field` (Master, `835:45`).
- `WF Image Placeholder` (Master, `835:334`).

### 4.4 Spacing Scale

| Token | px |
|---|---:|
| `spacing/xs` | 8 |
| `spacing/sm` | 16 |
| `spacing/md` | 24 |
| `spacing/lg` | 32 |
| `spacing/xl` | 40 |
| `spacing/2xl` | 48 |

### 4.5 Catatan Implementasi

- Token warna disimpan hard-coded untuk eksplorasi Lo-Fi.
- Saat transisi ke Hi-Fi, token idealnya dipromosikan menjadi Figma Variables Collection `md.sys.color.*`.
- Naming Inter pakai Regular / Medium / Bold (SemiBold tidak tersedia).

---

## 5. Token Hi-Fi MobilJuragan (sumber: `DESIGN.md`)

Token visual yang dipakai di Hi-Fi:

| Token | Nilai | Penggunaan |
|---|---|---|
| `navy` | `#1E3A5F` | Struktur, header, primary button |
| `teal` | `#0E7C7B` | Aksi positif, status aktif, link |
| `gold` | `#D4A017` | Accent perhatian, terutama status menunggu |
| `neutral-bg` | `#F5F7FA` | Latar |
| `neutral-line` | `#E2E8F0` | Border/pemisah |
| `text-main` | `#0F172A` | Teks utama |
| `white` | `#FFFFFF` | Surface |

Aturan pemakaian:

- Maksimal 2–3 warna core + 1 accent.
- Gold hanya untuk satu momen perhatian utama per screen.
- Tidak ada gradient, glow, glassmorphism, atau dekorasi tanpa fungsi.
- Teks putih pada navy/teal harus lolos WCAG AA.

Typography:

- Inter, sentence case, heading tidak all-caps.
- H1 24 px mobile / 32 px desktop.
- H2 20 px mobile / 24 px desktop.
- Body 14–16 px.
- Caption 12 px.

Spacing, radius, elevation:

- Grid spacing kelipatan 8 px.
- Radius kecil 4 px (input, badge, chip).
- Radius sedang 8 px (kartu, tabel).
- Radius besar 12 px (primary CTA).
- Shadow level 1 dan 2, maksimal dua level elevasi.

Copywriting:

- Bahasa Indonesia.
- CTA spesifik produk: `Pesan Mobil`, `Pilih Tanggal`, `Kirim Pesanan`, `Konfirmasi Booking`, `Kirim Ticket`, `Coba Lagi`.
- Tidak ada em dash pada teks UI.
- Tidak ada buzzword seperti "AI Powered", "Seamless", "Next Generation".
- Tarif memakai `Tarif dikonfirmasi tim MobilJuragan` atau `Menunggu konfirmasi tarif`.
- Data contoh diberi label `Data contoh`.

---

## 6. Dataset armada (hard gate)

Hanya sembilan kendaraan berikut yang boleh digunakan:

1. `AVANZA G PUTIH` — `PS1692B`
2. `FORTUNER VRZ TRD HITAM` — `B8833AKU`
3. `HILUX G HITAM` — `PA8593GZ`
4. `INNOVA REBORN G HITAM` — `PA1504G`
5. `PICKUP SUZUKI CARRY HITAM` — `B9762BAY`
6. `RUSH G ALL NEW COKLAT` — `PA1696GG`
7. `TERIOS X HIJAU MATIC` — `B2534KRB`
8. `VELOZ MERAH` — `PS1693B`
9. `XPANDER EXCEED HITAM` — `PS1691B`

Aturan:

- Tidak mengarang harga, rating, review, testimonial, pendapatan, jumlah booking, nama pelanggan, atau waktu respons.
- Data contoh wajib diberi label `Data contoh`.

---

## 7. Page Hi-Fi Booking Flow (pekerjaan 16/09/26)

Page baru: `Hi-Fi — Booking Flow (dari LoFi)` (`890:2`).

Page ini berdiri sendiri di luar `Mobile App` (`4:10`), `Dashboard` (`4:11`), `Design System` (`0:1`), dan 8 page Lo-Fi. Page Hi-Fi baru tidak mengubah atau menduplikasi frame existing.

### 7.1 Struktur root

- Root `Hi-Fi — Booking Flow` (`890:3`), 2920 × 2400, berisi enam screen Hi-Fi + satu frame Journey Map.

### 7.2 Daftar screen Hi-Fi

| # | Screen | Node ID |
|---:|---|---|
| 1 | `01 / Hi-Fi — Beranda` | `911:2` |
| 2 | `02 / Hi-Fi — Pilih Kendaraan` | `973:17` |
| 3 | `03 / Hi-Fi — Detail Kendaraan` | `975:32` |
| 4 | `04 / Hi-Fi — Tanggal & Waktu` | `975:89` |
| 5 | `05 / Hi-Fi — Opsi Rental` | `976:62` |
| 6 | `06 / Hi-Fi — Tinjau Pesanan` | `977:77` |
| 7 | `Journey Map & Laws of UX` | `979:92` |

Semua screen Hi-Fi berukuran 390 × 844 px.

### 7.3 Pemetaan ke Lo-Fi sumber

| Hi-Fi | Lo-Fi sumber | Node Lo-Fi |
|---|---|---|
| `01 / Hi-Fi — Beranda` | `Screen / Lo-Fi — Beranda` | `658:308` |
| `02 / Hi-Fi — Pilih Kendaraan` | `Screen / Lo-Fi — Pilih Kendaraan` | `659:308` |
| `03 / Hi-Fi — Detail Kendaraan` | `Screen / Lo-Fi — Detail Kendaraan` | `721:312` |
| `04 / Hi-Fi — Tanggal & Waktu` | `Screen / Lo-Fi — Tanggal & Waktu` | `722:308` |
| `05 / Hi-Fi — Opsi Rental` | `Screen / Lo-Fi — Opsi Rental` | `723:308` |
| `06 / Hi-Fi — Tinjau Pesanan` | `Screen / Lo-Fi — Tinjau Pesanan` | `660:308` |

`Lo-Fi — Anotasi` tidak dijadikan screen aplikasi; isinya direpresentasikan pada frame dokumentasi `Journey Map & Laws of UX`.

---

## 8. Komposisi setiap screen Hi-Fi

### 8.1 `01 / Hi-Fi — Beranda` (`911:2`)

Struktur internal:

- `Header` (`928:2`), 390 × 80.
  - Brand `MobilJuragan`
  - Location `Merauke`
- `Content` (`928:5`), 390 × 692.
  - `Heading` `Sewa mobil dengan proses yang jelas`
  - `Intro` `Pilih kendaraan, tentukan jadwal, lalu tunggu konfirmasi tarif dari tim MobilJuragan.`
  - `Service Summary` (card teal soft): `Layanan MobilJuragan`, `Rental mobil • Servis ringan • Cuci & salon`, `Tarif dikonfirmasi tim MobilJuragan`.
  - `Booking Empty State`: `Belum ada booking aktif`, `Mulai pesanan pertama Anda. Status akan tampil di sini setelah permintaan dikirim.`, label `Data contoh`.
  - `CTA / Pesan Mobil` (full-width 342 × 52).
- `Bottom Navigation` (`928:18`), 390 × 72.
  - Tab `Beranda` aktif (indicator teal).
  - Tab `Pesan`, `Status`, `Bantuan`.

Mengikuti Lo-Fi `658:308`: hero layanan, empty booking state, CTA utama, bottom navigation.

### 8.2 `02 / Hi-Fi — Pilih Kendaraan` (`973:17`)

Struktur internal:

- `Header` (`973:18`), 390 × 80.
  - Back `<`
  - Title `Pilih kendaraan`
  - Context `Langkah 1 dari 5`
- `Content` (`973:22`), 390 × 692.
  - `Heading` `Pilih kendaraan`
  - `Subheading` `Bandingkan nama, plat nomor, dan status kendaraan.`
  - `Data note` `Data contoh`
  - `Filter Chips`: `Semua / MPV / SUV / Pickup` (Semua aktif teal).
  - Empat kartu kendaraan dari dataset resmi:
    - `AVANZA G PUTIH` (`PS1692B`) — MPV
    - `FORTUNER VRZ TRD HITAM` (`B8833AKU`) — SUV
    - `HILUX G HITAM` (`PA8593GZ`) — Pickup
    - `INNOVA REBORN G HITAM` (`PA1504G`) — MPV
  - Setiap kartu berisi nama, plat, tipe, dan status chip `Tersedia`.
  - `Remaining Vehicles` (panel teal soft): `5 kendaraan lainnya`, `Pilih filter untuk melihat pilihan lain.`
  - `Journey hint`: `Pilih satu kendaraan untuk melihat detail sebelum menentukan jadwal.`
- `Bottom Navigation` (`973:63`), 390 × 72.
  - Tab `Pesan` aktif.

Mengikuti Lo-Fi `659:308`.

### 8.3 `03 / Hi-Fi — Detail Kendaraan` (`975:32`)

Struktur internal:

- `Header` (`975:33`), 390 × 80.
  - Back `<`
  - Title `Detail kendaraan`
  - Context `Langkah 2 dari 5`
- `Content` (`975:34`), 390 × 692.
  - `Heading` `AVANZA G PUTIH`
  - `Plate` `Plat PS1692B`
  - `Data note` `Data contoh`
  - `Tariff note` `Tarif dikonfirmasi tim MobilJuragan`
  - `Vehicle Photo / Placeholder` (342 × 200) dengan label `Foto placeholder`.
  - Status chip `Tersedia` pada pojok kanan atas foto.
  - Dua baris spec card: `Kapasitas / 7 penumpang` dan `Transmisi / Manual`.
  - Dua baris spec card tambahan: `Tahun / Data contoh` dan `Tipe / MPV`.
  - `Journey hint`: `Pastikan mobil dan plat benar sebelum menentukan jadwal rental.`
  - `CTA / Pilih Tanggal` (full-width 342 × 52).
- `Bottom Navigation` (`975:62`), 390 × 72.

Mengikuti Lo-Fi `721:312`.

### 8.4 `04 / Hi-Fi — Tanggal & Waktu` (`975:89`)

Struktur internal:

- `Header` (`975:90`), 390 × 80.
  - Back `<`
  - Title `Tanggal & Waktu`
  - Context `Langkah 3 dari 5`
- `Content` (`975:91`), 390 × 692.
  - `Heading` `Tentukan jadwal rental`
  - `Subheading` `Pilih tanggal mulai dan perkiraan durasi rental.`
  - `Data note` `Data contoh`
  - `Calendar` (342 × 240): bulan `April 2026`, weekday row `Sen/Sel/Rab/Kam/Jum/Sab/Min`, grid tanggal 01–14 dengan tanggal 01 selected, legenda `• tersedia`.
  - `Time & Duration`: `Waktu mulai / 09.00 WIT` dan `Durasi rental / 2 hari`.
  - `Journey hint`: `Pastikan jadwal sesuai kebutuhan perjalanan Anda.`
  - `CTA / Lanjutkan` (full-width 342 × 52).
- `Bottom Navigation` (`976:54`), 390 × 72.

Mengikuti Lo-Fi `722:308`.

### 8.5 `05 / Hi-Fi — Opsi Rental` (`976:62`)

Struktur internal:

- `Header` (`976:63`), 390 × 80.
  - Back `<`
  - Title `Opsi Rental`
  - Context `Langkah 4 dari 5`
- `Content` (`976:64`), 390 × 692.
  - `Heading` `Pilih moda rental`
  - `Subheading` `Sopir dari tim MobilJuragan atau kendarai sendiri.`
  - `Opsi / Driver / Selected` (342 × 124, teal soft dengan border teal):
    - Title `Driver`
    - Subtitle `Sopir dari tim MobilJuragan`
    - Note `Tarif dikonfirmasi tim MobilJuragan`
    - Selected indicator (14 × 14, teal solid)
  - `Opsi / Self Drive` (342 × 124, white dengan border):
    - Title `Self Drive`
    - Subtitle `Kendarai sendiri sesuai kebutuhan.`
    - Note `Tarif dikonfirmasi tim MobilJuragan`
    - Unselected indicator (14 × 14, white dengan border)
  - `Helper` `Tarif final dikonfirmasi setelah pengajuan.`
  - `Journey hint`: `Pilih satu moda untuk melanjutkan ke data pemesan.`
  - `CTA / Lanjutkan` (full-width 342 × 52).
- `Bottom Navigation` (`976:78`), 390 × 72.

Mengikuti Lo-Fi `723:308`.

### 8.6 `06 / Hi-Fi — Tinjau Pesanan` (`977:77`)

Struktur internal:

- `Header` (`977:78`), 390 × 80.
  - Back `<`
  - Title `Tinjau Pesanan`
  - Context `Langkah 5 dari 5`
- `Content` (`977:79`), 390 × 692.
  - `Heading` `Tinjau Pesanan`
  - `Subheading` `Periksa detail pesanan sebelum mengirim permintaan.`
  - `Data note` `Data contoh`
  - Empat card ringkasan:
    - `Card Kendaraan`: `AVANZA G PUTIH` / `Plat PS1692B`
    - `Card Jadwal`: `Mulai: 01 April 2026` / `Durasi: 2 hari`
    - `Card Opsi Rental`: `Driver` / `Sopir dari tim MobilJuragan`
    - `Card Data Pemesan`: `Nama: Bambang (contoh)` / `WhatsApp: 0812-xxxx-xxxx`
  - `Banner Tarif` (gold soft dengan border gold): `Tarif dikonfirmasi tim MobilJuragan setelah pengajuan.`
  - `Journey hint`: `Pastikan semua data sudah benar. Setelah konfirmasi, tim akan memverifikasi dan menghubungi Anda.`
  - `CTA / Konfirmasi Booking` (full-width 342 × 52).
- `Bottom Navigation` (`977:104`), 390 × 72.

Mengikuti Lo-Fi `660:308`.

---

## 9. Journey Map & Laws of UX (`979:92`)

Frame dokumentasi 2800 × 540 px yang merangkut hubungan enam phase booking dengan Laws of UX.

Content:

- `Title`: `Journey Map & Laws of UX`
- `Lead`: `Setiap layar Hi-Fi mempertahankan Laws of UX yang sudah diuji pada tahap Lo-Fi.`

Enam card phase:

| Phase | Screen | Law | Description |
|---|---|---|---|
| 01 | Beranda | Jakob's Law | Bottom navigation 4 tab yang sudah familiar. |
| 02 | Pilih Kendaraan | Hick's Law | Empat pilihan utama + filter, bukan daftar panjang. |
| 03 | Detail Kendaraan | Fitts's Law | CTA Pilih Tanggal full-width di area thumb. |
| 04 | Tanggal & Waktu | Proximity + Chunking | Header bulan + grid tanggal + waktu/durasi. |
| 05 | Opsi Rental | Jakob's Law | Radio card Driver / Self Drive, pola familiar. |
| 06 | Tinjau Pesanan | Miller + Chunking | Empat card ringkasan sebelum konfirmasi. |

Data Integrity Strip:

- Judul: `Integritas Data`
- `9 kendaraan resmi dipakai; tarif memakai copy konfirmasi, bukan angka rekaan.`
- `Semua data contoh diberi label Data contoh. Tidak ada harga, rating, review, atau nama pelanggan fiktif.`
- `Palette: navy/teal/gold + neutral. Gold hanya untuk momen penting seperti banner tarif.`

---

## 10. Konsistensi Hi-Fi terhadap Lo-Fi

| Lo-Fi | Hi-Fi | Konsistensi |
|---|---|---|
| `Lo-Fi — Beranda` | `01 / Hi-Fi — Beranda` | Hero, empty state, CTA `Pesan Mobil`, bottom navigation 4 tab |
| `Lo-Fi — Pilih Kendaraan` | `02 / Hi-Fi — Pilih Kendaraan` | Filter chips, 4 kartu kendaraan, panel `5 kendaraan lainnya` |
| `Lo-Fi — Detail Kendaraan` | `03 / Hi-Fi — Detail Kendaraan` | Photo placeholder, nama/plat/status, 4 spec card, CTA `Pilih Tanggal` |
| `Lo-Fi — Tanggal & Waktu` | `04 / Hi-Fi — Tanggal & Waktu` | Kalender April 2026, waktu mulai, durasi rental, CTA `Lanjutkan` |
| `Lo-Fi — Opsi Rental` | `05 / Hi-Fi — Opsi Rental` | Radio card Driver / Self Drive, helper note, CTA `Lanjutkan` |
| `Lo-Fi — Tinjau Pesanan` | `06 / Hi-Fi — Tinjau Pesanan` | 4 card ringkasan, banner tarif, CTA `Konfirmasi Booking` |
| `Lo-Fi — Anotasi` | `Journey Map & Laws of UX` | Direpresentasikan sebagai dokumentasi, bukan screen aplikasi |

Struktur, urutan informasi, dan CTA spesifik produk dipertahankan persis seperti Lo-Fi sumber. Yang berubah hanya styling visual Hi-Fi (warna, typography, status, hierarchy).

---

## 11. Laws of UX yang dipertahankan di Hi-Fi

- **Jakob's Law**: bottom navigation 4 tab, pola radio card Driver/Self Drive.
- **Fitts's Law**: CTA utama full-width 342 × 52 di area thumb.
- **Hick's Law**: daftar kendaraan dan opsi rental dibatasi agar keputusan cepat.
- **Miller's Law + Chunking**: informasi kendaraan, jadwal, opsi rental, dan review pesanan dipecah menjadi card.
- **Law of Proximity**: nama, plat, status, label, dan nilai dikelompokkan rapat.
- **Progressive disclosure**: detail kendaraan dan detail booking muncul bertahap sesuai alur.

---

## 12. State matrix Hi-Fi (saat ini)

| Area | Default | Recovery |
|---|---|---|
| Beranda | Hero layanan + empty booking | CTA `Pesan Mobil` |
| Pilih Kendaraan | 4 kartu + panel `5 kendaraan lainnya` | Filter chips |
| Detail Kendaraan | Photo placeholder + spec | CTA `Pilih Tanggal` |
| Tanggal & Waktu | Kalender April 2026 + time/duration | CTA `Lanjutkan` |
| Opsi Rental | Driver selected + Self Drive | CTA `Lanjutkan` |
| Tinjau Pesanan | 4 card ringkasan + banner tarif | CTA `Konfirmasi Booking` |

Loading, empty, dan error state belum ditambahkan pada Hi-Fi baru. State tersebut masih tersedia pada screen referensi di page `Mobile App` (`4:10`) `Screen / Empty State` (`18:303`) dan `Screen / Error State` (`18:342`).

---

## 13. Accessibility Hi-Fi

- Semua tap target mobile minimal 44 × 44 px.
- Bottom navigation berlabel, bukan icon-only.
- Form input akan memiliki label terlihat (placeholder untuk Hi-Fi belum dibuat).
- Kontras teks mengikuti WCAG AA (putih pada navy/teal lolos).
- Motion terbatas pada perubahan state nyata; belum ditambahkan prototype reaction.

---

## 14. Delivery Gate untuk Hi-Fi

Checklist wajib:

- [x] Tidak ada em dash pada teks UI Hi-Fi.
- [x] Tidak ada overflow pada 390 × 844.
- [x] Tidak ada angka/statistik/nama/testimonial fiktif tanpa label `Data contoh`.
- [x] Kendaraan hanya memakai 9 dataset resmi.
- [x] Tarif memakai copy konfirmasi, bukan angka rekaan.
- [x] Semua placeholder foto berlabel `Foto placeholder`.
- [x] Bottom navigation 4 tab konsisten.
- [x] Palette ≤ 3 core + 1 accent, gold hanya untuk banner tarif.
- [x] Radius 4/8/12 dan shadow disiplin.
- [x] Tidak ada gradient/glow/glassmorphism/dekorasi tanpa fungsi.
- [x] CTA spesifik produk.
- [x] Microcopy Bahasa Indonesia, layer name English.
- [x] ENERGY 2 / RHYTHM 2 / MOTION 1 konsisten.
- [x] Design read sudah dipahami sebelum menggambar.
- [x] Page Hi-Fi baru terpisah dari page existing, tidak menghapus atau menduplikasi frame.

Belum selesai:

- [ ] Loading, empty, dan error state eksplisit pada Hi-Fi baru.
- [ ] Prototype reaction antar screen (saat ini hanya visual statis).
- [ ] Re-bind token Hi-Fi ke Figma Variables (saat ini hard-coded mengikuti `Lo-Fi — Style Guide`).
- [ ] Pembuatan Text Styles Figma untuk typography Hi-Fi.

---

## 15. Total page Figma setelah pekerjaan Hi-Fi

12 page:

1. `Mobile App` (`4:10`)
2. `Dashboard` (`4:11`)
3. `Design System` (`0:1`)
4. `Lo-Fi — Beranda` (`641:308`)
5. `Lo-Fi — Pilih Kendaraan` (`641:309`)
6. `Lo-Fi — Tinjau Pesanan` (`641:310`)
7. `Lo-Fi — Anotasi` (`641:311`)
8. `Lo-Fi — Detail Kendaraan` (`721:309`)
9. `Lo-Fi — Tanggal & Waktu` (`721:310`)
10. `Lo-Fi — Opsi Rental` (`721:311`)
11. `Lo-Fi — Style Guide` (`825:47`)
12. `Hi-Fi — Booking Flow (dari LoFi)` (`890:2`)

---

## 16. Bukti visual

Screenshot hasil tersimpan di workspace pada path:

- `figma_hifi_overview.png` — overview enam screen Hi-Fi dan Journey Map.
- `figma_hifi_01_beranda.png` — screen Hi-Fi Beranda.
- `figma_hifi_02_pilih_kendaraan.png` — screen Hi-Fi Pilih Kendaraan.

Screenshot lain (Detail Kendaraan, Tanggal & Waktu, Opsi Rental, Tinjau Pesanan) diambil saat verifikasi dan dapat diulang via `get_screenshot` dengan node ID masing-masing.

---

## 17. Status akhir dan unresolved items

### Selesai

- [x] Audit Lo-Fi dan Style Guide.
- [x] Perancangan struktur Hi-Fi proporsional.
- [x] Pembangunan enam screen Hi-Fi + Journey Map.
- [x] Validasi visual enam screen Hi-Fi.
- [x] Konsistensi terhadap Lo-Fi sumber dan Style Guide.

### Belum boleh dianggap final tanpa cek ulang

- [ ] Apakah prototype reaction Hi-Fi perlu ditambahkan (saat ini visual statis).
- [ ] Apakah loading, empty, dan error state perlu dibuat pada Hi-Fi baru.
- [ ] Apakah token Hi-Fi perlu di-bind ke Figma Variables Collection.
- [ ] Apakah Text Styles Figma untuk typography Hi-Fi perlu dibuat ulang.
- [ ] Apakah jumlah reaction/tools saat ini adalah snapshot historis, bukan fakta live.

---

## 18. Cara melanjutkan pekerjaan dengan aman

### Sebelum membaca/mengubah Figma Hi-Fi

1. Baca `DESIGN.md`.
2. Baca `CONTEXT_DUMP_semut_copilot_vscode_latest.md` untuk konteks baseline.
3. Baca dump ini untuk konteks transformasi Lo-Fi → Hi-Fi.
4. Buka file key `Rxdv5kRYC8NiQpdWJhoIGJ`.
5. Inspect node berdasarkan ID, jangan membuat duplikat.

### Untuk Hi-Fi

- Gunakan komponen dari `Design System` (`0:1`).
- Pertahankan token navy/teal/gold + neutral.
- Pertahankan CTA spesifik produk Bahasa Indonesia.
- Jaga data integrity 9 kendaraan dan copy tarif.
- Jangan menghapus screen Hi-Fi tanpa validasi.

### Prompt lanjutan yang aman

Gunakan pola:

> Continue from the last completed Figma write operation. Do not restart or duplicate existing frames. Inspect what already exists, then continue the remaining work according to the prompt and report progress.

---

## 19. Instruksi untuk agent berikutnya

Jika agent berikutnya diminta melanjutkan pekerjaan Hi-Fi:

1. Jangan membuat page atau screen Hi-Fi baru tanpa konfirmasi.
2. Jangan mengubah atau menghapus screen Hi-Fi existing.
3. Inspect node berdasarkan ID sebelum membuat mutasi.
4. Baca `DESIGN.md` dan dump ini sebelum perubahan visual.
5. Pertahankan konsistensi dengan Lo-Fi sumber dan Style Guide.
6. Pertahankan data integrity 9 kendaraan dan copy tarif.
7. Laporkan dengan jujur jika tool tidak dapat membaca prototype connections.
8. Gunakan pola raw Plugin API atau `$fig.frame(options, [children])` yang terbukti materialisasi pada sesi ini.
9. Setiap wrapper kosong harus dibersihkan berdasarkan ID persis, bukan dengan membuat wrapper baru.

---

## 20. Sumber evidence

- Metadata Figma live via `get_metadata` untuk setiap page dan screen.
- Screenshot visual via `get_screenshot` dan `save_screenshots` ($2\times$ scale) untuk 11 screen Hi-Fi.
- Riwayat sesi Figma MCP pada 16–17 Sep 2026.
- `CONTEXT_DUMP_semut_copilot_vscode_latest.md` (baseline).
- `docs/design/DESIGN.md` dan `docs/design-tokens.json`.
- 8 diagram `.drawio` IA, 33 diagram `.drawio` user flow.
- Page `Lo-Fi — Style Guide` (`825:47`) sebagai sumber struktur dan prinsip.

---

## 21. Migrasi ke Halaman Master `EKSPERIMENTAL HIFI MOBILE` (`1058:321`) & Sistem Traveloka Trust Blue

Pada 17 September 2026, seluruh rancangan mobile Hi-Fi dimigrasikan dan disempurnakan menjadi ekosistem 11 layar penuh di halaman kanvas master `EKSPERIMENTAL HIFI MOBILE` (Node ID: `1058:321`):

### 21.1 Daftar 11 Layar Hi-Fi Tervalidasi

1. **`01 / Hi-Fi : Beranda` (`1060:838`):** Zero-header, hero stage Avanza, live status card penjemputan Bandara Mopah, trust strip armada bersih & terawat.
2. **`02 / Hi-Fi : Katalog Armada` (`1060:890`):** Segmented capsule filter `#0194F3`, 4 kartu taktil armada nyata lengkap foto berlatar bersih, transmisi, dan pelat nomor PA Merauke.
3. **`03 / Hi-Fi : Detail Kendaraan` (`1060:960`):** Floating vehicle pedestal, 4 horizontal micro-spec chips, tarif sewa harian transparan, garansi armada pengganti, Sticky Action Dock.
4. **`04 / Hi-Fi : Tanggal & Durasi` (`1060:1019`):** Vehicle summary chip, visual calendar range picker 01–03 Apr `#0194F3`, siklus jam ambil/kembali 24 jam, Sticky Action Dock.
5. **`05 / Hi-Fi : Opsi Layanan Rental` (`1060:1081`):** Pilihan taktil *Dengan Supir* (aktif `#0194F3`) vs *Lepas Kunci*, jaminan bantuan siaga 24 jam, Sticky Action Dock.
6. **`06 / Hi-Fi : Tinjau Pesanan` (`1060:1136`):** Itemized breakdown kendaraan & supir, titik jemput Bandara Mopah, kartu rincian biaya transparan `#EBF5FE` tanpa biaya siluman, Sticky Action Dock.
7. **`07 / Hi-Fi : Status Pesanan` (`1060:1201`):** Live tracking penjemputan bandara, stepper 4 tahap terverifikasi, tombol kontak supir (Bpk. Yohanes) & admin, Bottom Navigation (Tab 3 Aktif).
8. **`08 / Hi-Fi : Riwayat Pesanan` (`1060:1269`):** Segmented tabs *Semua, Aktif, Selesai*, kartu Avanza aktif, kartu riwayat selesai Innova Reborn (rute Sota Trans-Papua), banner unduh kuitansi resmi/faktur SPPD dinas, Bottom Navigation (Tab 3 Aktif).
9. **`09 / Hi-Fi : Pusat Bantuan` (`1060:1328`):** Kolom pencarian kendala, pill topik bantuan, kartu status tiket aktif `#TCK-1042`, akordeon FAQ operasional Merauke (delay penerbangan & rute luar kota), banner bot AI siaga 24 jam, Bottom Navigation (Tab 4 Aktif).
10. **`10 / Hi-Fi : Buat Ticket` (`1060:1393`):** Pemilih pesanan terkait (*PA 1692 B*), pill kategori kendala (*Jadwal Jemput, Armada & Supir, Faktur & SPPD*), formulir subjek & pesan delay GA-656, kotak lampiran boarding pass, notice triage AI, Sticky Action Dock.
11. **`11 / Hi-Fi : Chat Bantuan - AI Handoff` (`1060:1431`):** Header status staf CS online & tiket `#TCK-1042`, pinned ticket context banner, alur percakapan dinamis: Tamu $\to$ AI Instant Triage $\to$ Divider Handoff Lapangan $\to$ Solusi CS Manusia Bpk. Bambang koordinasi supir di gate 2, composer taktil dengan lampiran & tombol kirim `#0194F3`.

### 21.2 Prinsip Desain & Arsitektur Navigasi
- **Funnel Isolation:** Layar transaksional berfokus tinggi (Layar 03, 04, 05, 06, 10, 11) meniadakan Bottom Navigation Bar dan menguncinya dengan *Sticky Action Dock* agar pengguna fokus menyelesaikan tindakan tanpa distraksi.
- **Global Hubs:** Layar beranda, katalog, pelacakan, riwayat, dan bantuan (Layar 01, 02, 07, 08, 09) menggunakan *4-tab Bottom Navigation* konsisten.
- **Kepatuhan Anti-Slop & Anti-Overkill:** Diksi bombastis dihapus, digantikan komitmen riil yang santun, sopan, dan berwibawa untuk melayani tamu dinas, pejabat kementerian/daerah, maupun keluarga dewasa di Merauke.

