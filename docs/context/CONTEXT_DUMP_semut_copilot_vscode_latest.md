# Context Dump Lengkap: MobilJuragan MVP, Figma, Prototype, dan Workspace

> Tanggal pembaruan: 07 Sep 2026 (pembaruan Lo-Fi Wireframe Minggu ke-3).
> Riwayat pembaruan: 31 Aug 2026 (baseline) → 07 Sep 2026 (Lo-Fi Wireframe dibuat dan divalidasi di Figma).
> Status dump: **lengkap berdasarkan bukti yang tersedia dari workspace, file Figma, screenshot, dan riwayat sesi Copilot lokal**.
> Tujuan: menjadi snapshot mandiri agar agent berikutnya dapat melanjutkan pekerjaan tanpa mengulang pembuatan frame, menghapus desain, atau menebak flow yang sudah ada.
> Aturan penting: bagian yang diberi label **terverifikasi** berasal dari struktur/node Figma, screenshot, file workspace, atau riwayat sesi. Bagian yang diberi label **catatan/risiko** adalah interpretasi atau hal yang perlu dicek ulang di Figma UI.
> Keamanan: secret/API key sengaja **tidak** ditulis di dump ini.

---

## 0. Ringkasan eksekutif

Proyek ini adalah prototype UI/UX untuk layanan rental mobil lokal **MobilJuragan**, milik CV. Mobil Juragan Express Transport di Merauke, Papua Selatan. Produk memiliki dua permukaan:

1. **Mobile App pelanggan** pada frame 390 × 844.
   - Tujuan utama: pelanggan memilih kendaraan, memilih tanggal/waktu, memilih opsi rental, mengisi data pemesan, meninjau pesanan, melakukan verifikasi nomor telepon, melihat status booking, dan menghubungi bantuan.
   - Entry point prototype: `Screen / Home` (`16:4`).
2. **Dashboard admin/staf** pada frame 1440 × 900.
   - Tujuan utama: staf melihat antrean booking yang masuk, membuka detail, mengubah status booking, memeriksa kalender armada, memeriksa status kendaraan, serta menangani Customer Care.
   - Entry point prototype: `Screen / Dashboard Overview` (`19:4`).

File Figma utama:

- File key: `Rxdv5kRYC8NiQpdWJhoIGJ`
- Nama: **MobilJuragan MVP — UI UX Case Study**
- URL desain yang digunakan: `https://www.figma.com/design/Rxdv5kRYC8NiQpdWJhoIGJ/MobilJuragan-MVP-—-UI-UX-Case-Study?node-id=4-10&p=f&m=draw`
- Page Figma:
  - `Mobile App` (`4:10`)
  - `Dashboard` (`4:11`)
  - `Design System` (`0:1`)

Kondisi desain terakhir yang berhasil direkonstruksi:

- Mobile dan dashboard sudah memiliki satu alur prototype utama bernama **Flow 1** pada masing-masing page.
- Mobile booking flow dimulai dari Home dan berakhir pada Booking Status, dengan akses bantuan melalui bottom navigation.
- Dashboard flow dimulai dari Dashboard Overview dan memakai sidebar untuk berpindah antar area kerja.
- Dropdown bantuan mobile sudah direfactor dari screen clone menjadi component set dua variant: `State=Closed` dan `State=Open`.
- Dropdown dashboard pernah mengalami beberapa masalah layout dan sudah dipadatkan/refactor, tetapi status visual terakhir tetap perlu dipandang sebagai area sensitif yang harus dicek di Figma.
- Workspace berisi dua file HTML pendukung/eksperimen: `dashboard_kasir.html` dan `status_booking.html`. Keduanya bukan source aplikasi produksi; keduanya berfungsi sebagai referensi/prototype HTML dan validasi UI.

---

## 1. Tujuan akademik dan konteks tugas

### 1.1 Mata kuliah

Informasi dari `P1 Desain UI UX.txt`:

- Mata kuliah: **Desain UI dan UX** (`VTK50017`)
- Bobot: 3 SKS
- Metode: Case-Based Learning (CBL)
- Tugas mengarah pada produk digital end-to-end, prototype mobile interaktif, dashboard web desktop, studi kasus nyata, audit WCAG/PDP, dan handoff.
- Minggu 1 membahas modern UX workflow dan problem framing.
- Minggu 2 berfokus pada Information Architecture (IA) dan Advanced User Flow.
- Target tahap awal: prototype mobile high-fidelity.

### 1.2 Konteks bisnis

- Bisnis: CV. Mobil Juragan Express Transport.
- Lokasi: Merauke, Papua Selatan.
- Layanan yang dipakai dalam UI:
  - Rental mobil
  - Servis ringan
  - Cuci dan salon
- Sumber referensi bisnis yang ditulis di `DESIGN.md`:
  - `https://mobiljuragan.com`
  - `https://mobiljuragan.com/order_mobil_web`

### 1.3 Problem framing produk

Masalah inti yang disasar bukan sekadar “membuat aplikasi rental yang terlihat modern”. Produk harus membantu pelanggan memperoleh kepastian atas:

- kendaraan yang dipilih,
- plat nomor kendaraan,
- tanggal dan waktu rental,
- pilihan menggunakan sopir atau self-drive,
- data pemesan,
- tarif yang belum dapat di-hardcode karena belum tersedia,
- status booking setelah dikirim,
- kanal bantuan apabila terjadi kendala.

Dari sisi staf/admin, masalahnya adalah:

- booking mana yang perlu ditangani berikutnya,
- detail booking dan kendaraan yang terkait,
- perubahan status booking setelah verifikasi internal,
- kalender ketersediaan armada,
- status kendaraan,
- ticket/customer care pelanggan.

Prinsipnya adalah **problem-first**, bukan solution-first. Tidak boleh menambahkan fitur hanya karena terlihat menarik, misalnya chatbot AI atau dashboard penuh chart, jika tidak menjawab kebutuhan nyata.

---

## 2. Arah desain yang wajib dipertahankan

Sumber utama: `DESIGN.md`.

### 2.1 Design read

Kalimat pembacaan desain yang wajib dijadikan konteks sebelum menggambar:

> Reading this as: aplikasi layanan rental mobil lokal untuk pelanggan umum dan admin usaha di Merauke, dalam bahasa visual “layanan transportasi yang jelas, praktis, dapat dipercaya”, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

### 2.2 Karakter dan mood

| Aspek | Keputusan |
|---|---|
| Karakter | Jelas, praktis, dapat dipercaya |
| Mood | Tenang, informatif, bukan promosi berlebihan |
| Tema | Light theme |
| Identity motif | Plat nomor kendaraan sebagai penanda visual berulang |
| Audience | Pelanggan pribadi pada mobile dan admin/staf pada desktop |
| ENERGY | 2, Balanced |
| RHYTHM | 2, Balanced |
| MOTION | 1, Calm |

Plat nomor adalah identitas visual utama karena data bisnis paling nyata yang tersedia adalah nomor kendaraan. Gunakan pada vehicle card, detail mobil, daftar armada, booking card, dan booking context. Jangan mengganti identitas ini dengan rating, review, testimonial, atau statistik fiktif.

### 2.3 Warna dan token visual

| Token | Nilai | Penggunaan |
|---|---|---|
| `navy` | `#1E3A5F` | Struktur, header, primary button |
| `teal` | `#0E7C7B` | Aksi positif, status aktif, link |
| `neutral-bg` | `#F5F7FA` | Latar |
| `neutral-line` | `#E2E8F0` | Border/pemisah |
| `text-main` | `#0F172A` | Teks utama |
| `gold` | `#D4A017` | Accent perhatian, terutama status menunggu |

Aturan pemakaian:

- Maksimal 2–3 warna core dan 1 accent.
- Gold hanya dipakai pada satu momen perhatian utama per screen, misalnya `Menunggu Konfirmasi`.
- Tidak boleh ada gradient background, glow, glassmorphism, atau dekorasi visual tanpa alasan.
- Teks putih pada navy/teal harus lolos WCAG AA.

Catatan implementasi Figma yang juga terlihat pada struktur desain: beberapa frame memakai latar `#E2E8F0`, surface putih, navy, teal, dan neutral line. Jika melanjutkan desain, konsolidasikan penggunaan `neutral-bg` dan `#E2E8F0` agar tidak terjadi variasi token tanpa alasan.

### 2.4 Tipografi

Typeface: **Inter**.

| Token | Mobile | Desktop | Kegunaan |
|---|---:|---:|---|
| H1 | 24 px | 32 px | Judul utama |
| H2 | 20 px | 24 px | Judul section |
| Body | 14–16 px | 14–16 px | Konten |
| Caption | 12 px | 12 px | Keterangan kecil |

- Heading sentence case.
- Hindari all-caps dengan letter spacing lebar.
- Jangan memakai monospace sebagai gaya visual; angka plat nomor boleh diberi perlakuan data yang jelas, tetapi tetap konsisten.
- Pada komponen Figma yang sudah terdeteksi, style `Type/Label` memakai Inter Medium 14 px, weight 500, line height 20.

### 2.5 Spacing, radius, dan elevation

- Grid spacing: kelipatan 8 px.
- Radius kecil: 4 px untuk input, badge, chip.
- Radius sedang: 8 px untuk kartu dan tabel.
- Radius besar: 12 px terutama untuk primary CTA.
- Shadow level 1: `0 1px 3px rgba(15,23,42,.08)` untuk kartu yang terangkat.
- Shadow level 2: `0 4px 12px rgba(15,23,42,.14)` untuk primary CTA dan modal.
- Baris tabel, input, dan list biasa cukup memakai border, tanpa shadow.
- Maksimal dua level elevasi.
- Jangan menjadikan semua elemen pill atau semua kartu floating.

### 2.6 Copywriting

- Bahasa UI: Bahasa Indonesia.
- CTA harus spesifik produk:
  - `Pesan Mobil`
  - `Pilih Tanggal`
  - `Kirim Pesanan`
  - `Konfirmasi Booking`
  - `Kirim Ticket`
  - `Coba Lagi`
- Hindari CTA generik seperti `Get Started`, `Learn More`, atau `Explore`.
- Jangan gunakan em dash pada teks UI.
- Hindari emoji dekoratif dan buzzword seperti “AI Powered”, “Seamless”, atau “Next Generation”.
- Jangan mengarang harga rental. Gunakan:
  - `Tarif dikonfirmasi tim MobilJuragan`
  - `Menunggu konfirmasi tarif`
- Data contoh harus diberi label terlihat `Data contoh`.

---

## 3. Integritas data dan dataset armada

Ini adalah hard gate. Hanya sembilan kendaraan berikut yang boleh digunakan:

1. `AVANZA G PUTIH` — `PS1692B`
2. `FORTUNER VRZ TRD HITAM` — `B8833AKU`
3. `HILUX G HITAM` — `PA8593GZ`
4. `INNOVA REBORN G HITAM` — `PA1504G`
5. `PICKUP SUZUKI CARRY HITAM` — `B9762BAY`
6. `RUSH G ALL NEW COKLAT` — `PA1696GG`
7. `TERIOS X HIJAU MATIC` — `B2534KRB`
8. `VELOZ MERAH` — `PS1693B`
9. `XPANDER EXCEED HITAM` — `PS1691B`

Aturan data:

- Jangan mengarang harga, rating, review, testimonial, pendapatan, jumlah booking, nama pelanggan, atau waktu respons.
- Data booking yang tidak berasal dari sumber nyata wajib diberi `Data contoh`.
- Tarif pada mobile dan dashboard tetap berupa konfirmasi tim, bukan angka.
- Jika butuh empty state, angka yang aman adalah `0` atau tidak menampilkan angka sama sekali.
- Nama pelanggan fiktif tidak boleh dipakai sebagai data nyata. Gunakan `Data contoh` atau placeholder jujur.

---

## 4. Struktur file workspace dan peran masing-masing

Workspace:

`d:\tugas kuliah\semester 3\uiux\minggu kedua`

File/folder yang terdeteksi:

| Path | Peran/status |
|---|---|
| `CONTEXT_DUMP_semut_copilot_vscode.md` | Dump konteks yang sedang diperbarui oleh dokumen ini |
| `DESIGN.md` | Arah desain, token, aturan anti-slop, data integrity, delivery gate |
| `P1 Desain UI UX.txt` | Materi kuliah, konteks tugas, modern UX workflow, problem framing |
| `dashboard_kasir.html` | Prototype HTML POS/kasir terpisah, bukan dashboard MobilJuragan rental |
| `status_booking.html` | Prototype HTML tampilan update status booking admin |
| `Icon/Home.png` | Ikon Home mobile |
| `Icon/Car.png` | Ikon Car/Pesan mobile |
| `Icon/Status.png` | Ikon Status mobile |
| `Icon/Help.png` | Ikon Help mobile |
| `Foundations.png` | Export/screenshot foundations design system |
| `Button.png` | Export/screenshot komponen button |
| `Input.png` | Export/screenshot komponen input |
| `Badge.png` | Export/screenshot komponen badge |
| `Status Chip.png` | Export/screenshot komponen status chip |
| `Vehicle Card.png` | Export/screenshot komponen vehicle card |
| `Booking Card.png` | Export/screenshot komponen booking card |
| `Stepper.png` | Export/screenshot komponen stepper |
| `Modal.png` | Export/screenshot komponen modal |
| `mobile_page_overview.png` | Screenshot overview page mobile |
| `customer_care_check.png` | Screenshot validasi Customer Care |
| `help_*` | Screenshot iterasi dan validasi help/ticket/dropdown |
| `ecom_*` | Eksperimen terpisah membuat project home e-commerce, bukan bagian inti MobilJuragan |
| `screenshot_*` | Bukti screenshot iterasi dropdown/dashboard |
| `dashboard_kasir.svg` | Export SVG yang berkaitan dengan prototype kasir |
| `Analisis UX dan Perancangan Konsep Aplikasi MobilJuragan .pdf` | Dokumen analisis UX/konsep |
| `Tugas_1_*.docx` | Dokumen tugas/presentasi riset dan delivery |
| `P3 - Laws of UX & Wireframing Low-Fidelity.pptx` | Materi kuliah minggu ke-3. |
| `prompt-tugas-lofi-wireframe.md` | Brief, prompt, dan aturan tugas Lo-Fi. |
| `lofi_blueprint.md` | Blueprint 3 wireframe + tabel anotasi + integritas data. |
| `lofi_exports/01_beranda.png` | Bukti visual Screen Lo-Fi Beranda (390 × 844). |
| `lofi_exports/02_pilih_kendaraan.png` | Bukti visual Screen Lo-Fi Pilih Kendaraan (390 × 844). |
| `lofi_exports/03_tinjau_pesanan.png` | Bukti visual Screen Lo-Fi Tinjau Pesanan (390 × 844). |
| `lofi_exports/04_ringkasan_anotasi.png` | Bukti visual ringkasan anotasi (1800 × 1080). |
| `review ss/` | Folder screenshot review internal, bukan deliverable utama. |

Catatan: riwayat sesi sempat membuat file sementara `find_status_ui.ps1`. File tersebut tidak terlihat pada inventaris terakhir workspace; jangan mengandalkannya sebagai source.

---

## 5. Struktur file Figma utama

### 5.1 Page `Mobile App` (`4:10`)

Ukuran semua screen mobile utama: **390 × 844**.

Top-level dan screen yang diketahui dari metadata/riwayat:

| Screen | Node ID | Posisi canvas | Fungsi |
|---|---|---:|---|
| `Screen / Home` | `16:4` | `(0, 0)` | Hub pelanggan dan entry booking |
| `Screen / Available Vehicles` | `16:48` | `(450, 0)` | Daftar kendaraan setelah memilih pesan |
| `Screen / Vehicle Detail` | `16:147` | `(900, 0)` | Detail kendaraan dan CTA lanjut |
| `Screen / Date & Time` | `17:70` | `(0, 900)` | Memilih tanggal dan waktu rental |
| `Screen / Rental Options` | `17:129` | `(450, 900)` | Memilih tipe rental dan opsi layanan |
| `Screen / Booker Form` | `17:177` | `(900, 900)` | Data pemesan |
| `Screen / Order Review` | `18:145` | `(0, 1800)` | Review ringkasan booking |
| `Screen / Phone Verification` | `18:190` | `(450, 1800)` | Verifikasi OTP nomor telepon |
| `Screen / Booking Status` | `18:243` | `(900, 1800)` | Tracking/status booking |
| `Screen / Empty State` | `18:303` | `(0, 2700)` | Empty state reusable/reference |
| `Screen / Error State` | `18:342` | `(450, 2700)` | Error state reusable/reference |
| `Screen / Help - New Ticket` | `228:262` | `(1350, 901)` | Form membuat ticket bantuan |
| `Screen / Help - Ticket Chat` | `228:305` | `(1350, 1820)` | Ringkasan ticket dan percakapan bantuan |
| `Screen / Bantuan` | `273:336` | `(1350, 0)` pada metadata terakhir | Layar bantuan/FAQ lama; pernah menjadi target penghapusan, status final perlu dicek di Figma |

### 5.2 Komposisi screen mobile utama

#### `Screen / Home` (`16:4`)

- Header: `16:5`, ukuran 390 × 80.
  - Brand: `MobilJuragan` (`16:6`)
  - Location: `Merauke` (`16:7`)
- Content: `16:8`, ukuran 390 × 692.
  - Heading: `Sewa mobil dengan proses yang jelas` (`16:9`)
  - Intro: `Pilih kendaraan, kirim kebutuhan, lalu tunggu konfirmasi tarif dari tim MobilJuragan.` (`16:10`)
  - Primary Button: `Pesan Mobil` (`16:11`)
  - Service Summary: `16:13`, berisi `Layanan MobilJuragan` dan `Rental mobil • Servis ringan • Cuci & salon`
  - Booking Status Empty: `16:16`, berisi:
    - `Belum ada booking aktif`
    - `Belum ada permintaan yang sedang diproses.`
    - `Pesan mobil untuk melihat status di sini.`
- Bottom navigation: `16:20`, ukuran 390 × 72.
  - `Nav Item / Home` (`16:21`) → label `Beranda`
  - `Nav Item / Book` (`16:27`) → label `Pesan`
  - `Nav Item / Status` (`16:35`) → label `Status`
  - `Nav Item / Help` (`16:41`) → label `Bantuan`

#### `Screen / Available Vehicles` (`16:48`)

- Header sama: brand dan lokasi.
- Heading dan subheading menjelaskan pemilihan kendaraan.
- Input/component `16:55`, ukuran 342 × 100, dipakai untuk konteks tanggal/availability.
- Hint: `List Action Hint` (`53:250`).
- Vehicle List: `16:64`, sembilan baris kendaraan.
- Setiap row berisi nama kendaraan, plat nomor, `Status Chip`, dan aksi membuka detail.
- Row positions: y `0, 56, 112, 168, 224, 280, 336, 392, 448`.
- Bottom nav tetap empat item.

#### `Screen / Vehicle Detail` (`16:147`)

- Back Button: `62:250`, posisi x 24 y 24, ukuran 120 × 40.
- Heading: `16:152`.
- Vehicle Card: `16:153`, ukuran 342 × 320.
- Vehicle Specs: `16:159`, ukuran 342 × 120.
- Primary Button: `16:163`, ukuran 342 × 52.
- Back mengarah kembali ke `Available Vehicles`.
- CTA mengarah ke `Date & Time`.

#### `Screen / Date & Time` (`17:70`)

- Heading dan subheading.
- Calendar: `17:77`, ukuran 342 × 220.
- Calendar berisi label bulan, row weekday, satu minggu tanggal 01–07, dan availability dot.
- Input berikutnya: `17:90`, ukuran 342 × 100, untuk waktu/kebutuhan rental.
- Rental duration note: `65:255`.
- CTA: `17:99`, ukuran 342 × 52, untuk melanjutkan.

#### `Screen / Rental Options` (`17:129`)

- Heading/subheading.
- Rental Option Driver: `17:136`, ukuran 342 × 76.
- Rental Option Self Drive: `527:475`, ukuran 342 × 76.
- Subheading tambahan: `527:491`.
- Dua option tambahan:
  - `527:493`, nama layer masih `Rental Option / Self Drive` berdasarkan metadata.
  - `527:479`, nama layer masih `Rental Option / Driver` berdasarkan metadata.
- CTA: `17:147`, ukuran 342 × 52.
- Saat melanjutkan, masuk ke `Booker Form`.
- Area yang perlu dijaga: jangan mengubah nama layar hanya karena nama child layer kurang presisi; perubahan layer name bisa memutus referensi pencarian/hand-off bila dilakukan tanpa alasan.

#### `Screen / Booker Form` (`17:177`)

- Heading/subheading.
- Empat instance input, masing-masing ukuran 342 × 100:
  - `17:184`
  - `17:189`
  - `17:194`
  - `17:199`
- Button `17:204`, ukuran 342 × 52.
- Data yang secara konseptual perlu diisi:
  - Nama sesuai KTP
  - Nomor WhatsApp
  - Kebutuhan/alamat/jemput sesuai desain final
  - Informasi pemesan lain yang memang diperlukan
- Jangan menambahkan field identitas yang tidak dibutuhkan.

#### `Screen / Order Review` (`18:145`)

- Heading/subheading.
- Sample note: `18:152` untuk penanda data contoh/ketidakfinalan.
- Booking Card: `18:153`, ukuran 342 × 236.
- Button: `18:160`, ukuran 342 × 52.
- CTA mengarah ke `Phone Verification`.
- Review harus menampilkan kendaraan/plat, jadwal, tipe rental, data pemesan, dan status tarif tanpa mengarang angka.

#### `Screen / Phone Verification` (`18:190`)

- Heading/subheading.
- Enam OTP fields pada `18:197`, masing-masing 44 × 52:
  - `18:198`, `18:200`, `18:202`, `18:204`, `18:206`, `18:208`
- Countdown: `18:210`.
- Button verifikasi: `18:211`.
- Button resend/cancel/secondary: `18:213`.
- Setelah verifikasi sukses, masuk ke `Booking Status`.
- Jangan memakai OTP nyata; ini prototype interaksi.

#### `Screen / Booking Status` (`18:243`)

- Heading: `18:248`.
- Status Chip: `18:249`, contoh status `Menunggu Konfirmasi`.
- Explanation: `18:251`.
- Booking Card: `18:252`, ukuran 342 × 236.
- Stepper: `18:259`, ukuran 342 × 208.
- Button: `18:273`, ukuran 342 × 52.
- Stepper merepresentasikan:
  1. Permintaan diterima
  2. Cek kendaraan
  3. Konfirmasi tarif
  4. Siap
- Button selesai mengarah kembali ke `Home` menurut riwayat prototype.

#### `Screen / Empty State` (`18:303`)

- Heading.
- Empty Panel: `18:309`, ukuran 342 × 160.
- Cause dan next action.
- Button `18:312` pada y 237.
- Secara flow, tombol `Coba Tanggal Lain` diarahkan ke `Date & Time` menurut riwayat.

#### `Screen / Error State` (`18:342`)

- Heading.
- Error Panel: `18:348`, ukuran 342 × 160.
- Cause dan next action.
- Button `18:351` pada y 237.
- Secara flow, tombol `Coba Lagi` diarahkan ke `Order Review` menurut riwayat.

#### `Screen / Help - New Ticket` (`228:262`)

- Header `228:263`, 390 × 80.
- Bottom nav `228:277`, 390 × 72.
- Content `232:292`, 390 × 692.
  - Heading `232:293`.
  - Intro `232:294`.
  - Ticket Form Card `233:293`, x 24 y 136, ukuran 347 × 488.
  - Section title `233:292`.
  - Input ticket title `233:294`, x 16 y 56, ukuran 310 × 100.
  - Help Type Dropdown instance `406:302`, x 16 y 172, ukuran 310 × 232 menurut metadata terakhir.
  - Submit button `234:310`, x 16 y 420, ukuran 310 × 52.
- Ticket form konseptual:
  - Judul ticket
  - Jenis bantuan: `Pertanyaan`, `Keluhan`, atau `Lainnya`
  - Detail kendala/pertanyaan
  - Submit `Kirim Ticket`
- Submit mengarah ke `Help - Ticket Chat`.

#### `Screen / Help - Ticket Chat` (`228:305`)

- Header dan bottom nav sama.
- Content:
  - Heading/intro.
  - Ticket Summary `236:367`, ukuran 342 × 128.
  - Conversation Empty State `236:376`, ukuran 342 × 250.
  - Message input `236:379` dan field `243:366`.
  - Send Message button `236:384`.
- Ringkasan menampilkan judul ticket, jenis bantuan, dan penanda `Data contoh`.
- Pada metadata versi awal, chat memuat contoh percakapan/ticket aktif; setelah iterasi, struktur baru menampilkan empty conversation state untuk alur ticket baru. Jangan menganggap contoh chat sebagai data bisnis nyata.

#### `Screen / Bantuan` (`273:336`) dan statusnya

Metadata terakhir masih menunjukkan screen ini terdiri dari:

- Header `273:531`.
- Main `273:359`.
- Search bantuan.
- Quick categories: Booking, Pembayaran, Kendaraan.
- FAQ: pembatalan booking, metode pembayaran, keterlambatan supir.
- Ticket Saya dengan contoh ticket aktif dan selesai.
- Button `＋ Buat Ticket` (`273:434`).
- Bottom navigation `273:502`.

Namun riwayat sesi menyebut screen ini pernah dihapus untuk mengurangi duplikasi, lalu pengguna melakukan restore, dan kemudian flow bantuan sempat diubah lagi. Karena metadata terbaru masih mengembalikan `273:336`, status final yang aman adalah:

> `Screen / Bantuan` masih terdeteksi pada metadata terakhir. Jangan menghapus atau memindahkannya lagi tanpa validasi visual dan konfirmasi pengguna. Jika target final memang satu pintu bantuan, pilih salah satu struktur secara manual di Figma dan dokumentasikan keputusan itu.

---

## 6. Struktur page `Dashboard` (`4:11`)

Ukuran semua screen dashboard: **1440 × 900**.

Pola umum setiap screen:

- Sidebar x 0–240.
- Main x 240–1440.
- Topbar tinggi 72 px.
- Page Content berada di bawah topbar.
- Sidebar memiliki item:
  - Overview
  - Incoming Bookings
  - Fleet Calendar
  - Vehicle Status
  - Help atau Customer Care

### 6.1 `Screen / Dashboard Overview` (`19:4`)

- Sidebar `19:5`.
- Main `19:18`.
- Topbar `19:19`.
- Page Content `19:22`.
- Booking Queue `19:25`, ukuran 1136 × 268.
  - Table header columns:
    - Pemesan
    - Kendaraan
    - Tanggal
    - Status
    - Aksi
  - Queue Empty `19:38`.
- Dashboard Support Panels `19:41`, ukuran 1136 × 260.
  - Fleet Status Summary `19:42`.
  - Mini Calendar `19:53`.
- Tidak boleh mengisi antrean dengan angka/nama fiktif tanpa label `Data contoh`.
- Fokus dashboard adalah keputusan admin: booking mana yang harus dikonfirmasi berikutnya, bukan kumpulan statistik dekoratif.

### 6.2 `Screen / Incoming Bookings` (`19:59`)

- Booking Table `19:80`, ukuran 1136 × 260.
- Columns:
  - Pemesan
  - Kendaraan
  - Tanggal
  - Status
  - Aksi
- Ada satu `Booking Row / Data contoh` (`19:92`) dengan:
  - Pemesan cell `19:93`.
  - Kendaraan cell `19:97`.
  - Tanggal cell `19:99`.
  - Status cell `19:102`, instance status chip `19:100`.
  - Action cell `19:103`, button `19:104`.
- `Sample Note` `19:110`.
- Rule text `19:111`.
- Action utama secara riwayat: `Lihat Detail` → `Booking Detail`.

### 6.3 `Screen / Booking Detail` (`19:112`)

- Booking Detail Split `19:133`, ukuran 1136 × 376.
- Booking Summary `19:134`, ukuran 560 × 376.
  - Pemesan `19:136`.
  - WhatsApp `19:137`.
  - Jadwal `19:138`.
  - Kebutuhan khusus `19:139`.
  - Tarif `19:140`.
  - Status chip `19:141`.
- Vehicle Summary `19:143`, ukuran 560 × 376.
  - Vehicle Card `19:145`, ukuran 320 × 320.
- Detail Actions `19:151`.
  - Button `19:152`, 160 × 44.
  - Button `19:154`, 190 × 44.
- Riwayat flow: `Kembali` → Incoming Bookings; `Update Status` → Booking Status Update.

### 6.4 `Screen / Fleet Calendar` (`20:20`)

- Status Legend `20:42`, ukuran 1136 × 96.
- Fleet Calendar Table `20:51`, ukuran 1136 × 560.
- Columns:
  - Vehicle
  - Schedule
  - Availability
  - Status
- Sembilan fleet rows sesuai dataset kendaraan.
- Row pertama `Fleet Row / AVANZA G PUTIH` (`20:61`), kemudian:
  - `FORTUNER VRZ TRD HITAM` (`20:70`)
  - `HILUX G HITAM` (`20:79`)
  - `INNOVA REBORN G HITAM` (`20:88`)
  - `PICKUP SUZUKI CARRY HITAM` (`20:97`)
  - `RUSH G ALL NEW COKLAT` (`20:106`)
  - `TERIOS X HIJAU MATIC` (`20:115`)
  - `VELOZ MERAH` (`20:124`)
  - `XPANDER EXCEED HITAM` (`20:133`)
- Schedule/availability harus tetap diberi label data contoh jika bukan data real-time.

### 6.5 `Screen / Vehicle Status` (`20:142`)

- Status Filters `20:163`.
- Filter row memakai status chips.
- Vehicle Status Empty `20:172`, ukuran 1136 × 210.
- Fleet Status Note `20:177`, ukuran 1136 × 150.
- Button pada empty panel `20:175`.
- Riwayat menyebut button ini mengarah ke Fleet Calendar. Ini masuk akal hanya jika label CTA menjelaskan konteks, misalnya `Lihat Kalender`; jangan mempertahankan redirect jika labelnya tidak sesuai.

### 6.6 `Screen / Booking Status Update` (`20:180`)

- Status Update Split `20:201`, metadata terakhir ukuran 1130 × 366.
- Booking Context `20:202`, ukuran 279 × 214.
  - Pemesan `20:204`.
  - Kendaraan `20:205`.
  - Jadwal `20:206`.
  - Tarif `20:207`.
  - Status chip `20:208`.
- Status Form `20:210`, metadata terakhir ukuran 835 × 366.
  - Title `20:211`.
  - Status Select `20:212`.
  - Dropdown instance `178:605`, ukuran 280 × 33 pada desain setelah refactor.
  - Input `20:215`, ukuran 320 × 100, untuk catatan internal.
  - WhatsApp Confirmation `20:220`.
  - Checkbox `20:221`.
  - Label `20:222`.
  - Save button `20:223`, 200 × 44.
- Copy konseptual:
  - Status booking: Konfirmasi / Ditolak / Menunggu.
  - Catatan internal.
  - `Kirim konfirmasi WhatsApp setelah disimpan`.
  - `Simpan status`.
- Status update harus mengubah status booking, menyimpan catatan internal, lalu opsional mengirim konfirmasi WhatsApp. Ini adalah prototype logic/intent, bukan integrasi backend nyata.

### 6.7 `Screen / Empty State` (`20:225`)

- Empty Panel `20:245`, ukuran 1136 × 250.
- Cause, Next Action, Button `20:248`.
- Guidance `20:250`.
- Dipakai sebagai contoh state saat belum ada data.

### 6.8 `Screen / Error State` (`20:251`)

- Error Panel `20:271`, ukuran 1136 × 250.
- Cause, Next Action, Button `20:274`.
- Guidance `20:276`.
- Dipakai sebagai contoh state gagal memuat data.

### 6.9 `Screen / Customer Care` (`228:411`)

- Customer Care merupakan screen desktop tambahan yang dibuat pada page Dashboard.
- Sidebar `228:412`; item terakhir bernama `Sidebar Item / Customer Care` (`228:423`).
- Main `238:334`.
- Topbar `238:335`.
- Page Content `238:338`.
- Customer Care Workspace `240:334`, ukuran 1136 × 650.
- Conversation List `240:335`, ukuran 320 × 650.
  - Title.
  - Search Field `240:337`.
  - Ticket Row / Active `240:342`.
  - Avatar and initials.
  - Customer, ticket title, category.
  - Empty hint.
- Chat Panel `241:334`, ukuran 816 × 650.
  - Chat Header `241:335`.
  - Ticket Information `241:340`, ukuran 768 × 112.
  - Conversation Empty State `241:347`, ukuran 768 × 294.
  - Reply Composer `241:350`.
  - Reply Field `241:351`.
  - Send Reply button `241:353`.
- Customer Care menggunakan pola split view desktop: daftar ticket di kiri, percakapan/detail di kanan.
- Data ticket yang terlihat sebagai contoh wajib tetap diberi penanda `Data contoh`; jangan menganggap customer atau ticket tersebut nyata.

---

## 7. Design System page (`0:1`)

Page ini berisi fondasi dan reusable components. Jangan membuat komponen baru dari nol jika komponen yang relevan sudah ada.

### 7.1 Foundations (`4:12`)

Frame Foundations berukuran 1440 × 2992. Section yang tersedia:

- `Section/Overview` (`6:2`)
- `Section/Colors` (`6:6`)
  - Primitive swatches:
    - `Swatch/navy/500`
    - `Swatch/teal/500`
    - `Swatch/gold/500`
    - `Swatch/neutral/050`
    - `Swatch/neutral/200`
    - `Swatch/text/900`
    - `Swatch/white/000`
  - Semantic swatches:
    - `color/bg/canvas`
    - `color/bg/surface`
    - `color/structure/navy`
    - `color/action/primary`
    - `color/action/on-primary`
    - `color/attention`
    - `color/status/positive`
    - `color/status/neutral`
    - `color/text/primary`
    - `color/border/default`
- `Section/Typography` (`6:64`)
  - `Type/H1`
  - `Type/H2`
  - `Type/Body`
  - `Type/Body Small`
  - `Type/Label`
  - `Type/Caption`
- `Section/Spacing` (`6:91`)
  - `spacing/xs`
  - `spacing/sm`
  - `spacing/md`
  - `spacing/lg`
  - `spacing/xl`
  - `spacing/2xl`
- `Section/Radius` (`6:112`)
  - `radius/sm`
  - `radius/md`
  - `radius/lg`
- `Section/Elevation` (`6:125`)
  - `Elevation/Resting card`
  - `Elevation/Primary CTA`
- `Section/Component Inventory` (`6:135`)

### 7.2 Components and variants

#### Button (`8:10`)

Variants:

- `Style=Primary` (`8:2`)
- `Style=Secondary` (`8:4`)
- `Style=Ghost` (`8:6`)
- `Style=Danger` (`8:8`)

Component description yang terdeteksi: reusable button base untuk primary, secondary, ghost, dan danger. Gunakan sentence case dan satu primary action per view.

#### Input (`10:4`)

Variants:

- `State=Default` (`9:2`)
- `State=Filled` (`9:7`)
- `State=Error` (`9:12`)

#### Badge (`12:6`)

Variants:

- `Tone=Positive` (`12:2`)
- `Tone=Attention` (`12:4`)

#### Status Chip (`12:15`)

Variants:

- `Status=Tersedia` (`12:7`)
- `Status=Disewa` (`12:9`)
- `Status=Servis` (`12:11`)
- `Status=Menunggu Konfirmasi` (`12:13`)

#### Vehicle Card (`13:2`)

- Vehicle Card component `13:2`.
- Dipakai pada Vehicle Detail dan Vehicle Summary dashboard.
- Gunakan foto placeholder yang jelas labelnya bila foto final belum ada.

#### Stepper (`13:71`)

Variants:

- `Progress=1` (`13:15`)
- `Progress=2` (`13:29`)
- `Progress=3` (`13:43`)
- `Progress=4` (`13:57`)

#### Modal (`13:72`)

- Modal component `13:72`, ukuran 360 × 220.
- Modal untuk konfirmasi/detail ringkas dan harus bisa ditutup.

#### Mobile icons

- `Icon/Home` (`14:7`)
- `Icon/Car` (`14:13`)
- `Icon/Status` (`14:17`)
- `Icon/Help` (`14:22`)
- Semua icon functional, ukuran 24 × 24 pada bottom nav.
- Workspace juga menyimpan export icon PNG di folder `Icon/`.

#### Booking Card (`147:457`)

Variants:

- `Property 1=Default` (`13:8`)
- `Property 1=Variant2` (`147:458`)
- Variant tambahan: `Booking Card/Variant3` (`147:482`)

#### Status Select / Dropdown lama dan baru

Komponen/status select yang terdeteksi pada Design System:

- `Status Select` (`178:305`).
- `Frame 13` (`178:373`) berisi option variants:
  - `Property 1=Default` (`178:335`)
  - `Property 1=Hover` (`178:376`)
  - `Property 1=Selected` (`178:378`)
- `List of option` (`178:396`).
- `Frame 15` (`178:397`).
- `Dropdown` (`178:463`) dengan variants:
  - `Property 1=Default` (`178:461`)
  - `Property 1=Variant3` (`178:480`)
  - `Property 1=Yes` (`178:515`)
  - `Property 1=Variant4` (`178:495`)
  - `Property 1=Yes` (`178:519`)
  - `Property 1=Yes` (`178:464`)
- Test showcase `Frame 17` (`178:552`) dengan instance dropdown `178:595`.

Refactor dashboard mengubah sizing/layout perilaku beberapa variant, tetapi jangan langsung menganggap semua node di showcase harus selebar field pada screen produksi. Showcase component boleh tetap sempit; instance production mengikuti kebutuhan screen.

#### Dropdown / Help Type baru

Riwayat sesi mencatat component set baru:

- `Dropdown / Help Type` (`401:324`)
- `State=Closed` (`401:322`)
- `State=Open` (`401:323`)

Tujuan: membuat dropdown mobile menjadi interaktif tanpa menghubungkan screen ke page/screen clone.

---

## 8. Information Architecture, user flow, dan user journey

Bagian ini mendokumentasikan tiga lapisan yang berbeda tetapi saling berkaitan:

1. **Information Architecture (IA)**: struktur pengelompokan fitur, informasi, dan navigasi aplikasi.
2. **User flow**: urutan langkah pengguna untuk menyelesaikan tugas tertentu.
3. **User journey**: pengalaman pengguna dari konteks awal sampai hasil akhir, termasuk kebutuhan, pikiran, risiko, dan pain point.

### 8.1 Status dokumentasi

- **IA** sekarang terdokumentasi eksplisit berdasarkan tiga page Figma, bottom navigation mobile, sidebar dashboard, dan hirarki screen.
- **User flow** sudah terdokumentasi dan dihubungkan dengan node ID serta tujuan redirect pada bagian prototype Flow 1.
- **User journey** di bawah adalah rekonstruksi berbasis screen dan copy yang tersedia, bukan hasil wawancara baru. Journey ini harus diperlakukan sebagai hipotesis yang dapat diuji melalui usability testing.
- **Persona formal final** belum dapat dipastikan dari file workspace. Materi kuliah memuat format persona, tetapi jangan mengarang nama, umur, pekerjaan, atau kutipan persona sebagai data riset.

### 8.2 Information Architecture tingkat produk

```text
MobilJuragan MVP
├── Mobile App / Pelanggan
│   ├── Beranda
│   ├── Pesan mobil
│   │   ├── Available Vehicles
│   │   ├── Vehicle Detail
│   │   ├── Date & Time
│   │   ├── Rental Options
│   │   ├── Booker Form
│   │   ├── Order Review
│   │   ├── Phone Verification
│   │   └── Booking Status
│   ├── Status booking
│   │   ├── Status chip
│   │   ├── Booking Card
│   │   └── Stepper progres
│   └── Bantuan
│       ├── Pencarian bantuan dan FAQ
│       ├── Kategori Booking
│       ├── Kategori Pembayaran
│       ├── Kategori Kendaraan
│       ├── Help - New Ticket
│       └── Help - Ticket Chat
└── Dashboard / Admin dan staf
    ├── Dashboard Overview
    ├── Incoming Bookings
    │   └── Booking Detail
    │       └── Booking Status Update
    ├── Fleet Calendar
    ├── Vehicle Status
    └── Customer Care
        ├── Conversation List
        ├── Ticket Information
        ├── Conversation
        └── Reply Composer
```

### 8.3 Pemetaan IA ke page dan navigasi Figma

| Area IA | Page | Entry/navigation | Screen atau komponen terkait |
|---|---|---|---|
| Beranda pelanggan | `Mobile App` (`4:10`) | Bottom nav `Beranda` | `Screen / Home` (`16:4`) |
| Pemesanan | `Mobile App` | CTA `Pesan Mobil` atau bottom nav `Pesan` | `16:48`, `16:147`, `17:70`, `17:129`, `17:177`, `18:145`, `18:190` |
| Status booking | `Mobile App` | Bottom nav `Status` atau selesai submit | `Screen / Booking Status` (`18:243`) |
| Bantuan pelanggan | `Mobile App` | Bottom nav `Bantuan` | `273:336`, `228:262`, `228:305` |
| Ringkasan admin | `Dashboard` (`4:11`) | Sidebar `Overview` | `Screen / Dashboard Overview` (`19:4`) |
| Booking masuk | `Dashboard` | Sidebar `Incoming Bookings` | `Screen / Incoming Bookings` (`19:59`) |
| Detail booking | `Dashboard` | Aksi `Lihat Detail` | `Screen / Booking Detail` (`19:112`) |
| Update status | `Dashboard` | Aksi `Update Status` | `Screen / Booking Status Update` (`20:180`) |
| Jadwal armada | `Dashboard` | Sidebar `Fleet Calendar` | `Screen / Fleet Calendar` (`20:20`) |
| Status armada | `Dashboard` | Sidebar `Vehicle Status` | `Screen / Vehicle Status` (`20:142`) |
| Customer Care | `Dashboard` | Sidebar `Help` atau `Customer Care` | `Screen / Customer Care` (`228:411`) |
| Fondasi desain | `Design System` (`0:1`) | Area internal designer/developer | Foundations dan reusable components |

Batasan IA yang harus dipertahankan:

- Mobile dan Dashboard adalah surface berbeda untuk dua peran berbeda, bukan satu navigasi gabungan.
- Bottom navigation adalah navigasi primer mobile dengan empat item: `Beranda`, `Pesan`, `Status`, `Bantuan`.
- Sidebar adalah navigasi primer dashboard: `Overview`, `Incoming Bookings`, `Fleet Calendar`, `Vehicle Status`, dan `Customer Care/Help`.
- `Design System` bukan fitur pelanggan.
- `Empty State`, `Error State`, loading, dan dropdown open/closed adalah state, bukan kategori navigasi utama.
- `Customer Care` adalah area kerja admin; `Help - New Ticket` dan `Help - Ticket Chat` adalah area bantuan pelanggan.

### 8.4 User flow utama pelanggan, booking mobil

**Tujuan pengguna:** mengirim permintaan rental yang cukup lengkap, memastikan detailnya benar, lalu mengetahui status prosesnya.

```text
Home (16:4)
  ↓ tekan Pesan Mobil
Available Vehicles (16:48)
  ↓ pilih vehicle row
Vehicle Detail (16:147)
  ↓ lanjut
Date & Time (17:70)
  ↓ lanjut
Rental Options (17:129)
  ↓ pilih Driver atau Self Drive, lalu lanjut
Booker Form (17:177)
  ↓ Kirim Pesanan
Order Review (18:145)
  ↓ Konfirmasi
Phone Verification (18:190)
  ↓ OTP valid
Booking Status (18:243)
  ↓ Selesai
Home (16:4)
```

Logika dan alasan per langkah:

1. `Home` memberi konteks layanan dan lokasi sebelum pelanggan mulai.
2. `Available Vehicles` menampilkan pilihan armada nyata dan status kendaraan.
3. `Vehicle Detail` mengurangi risiko salah memilih kendaraan atau plat nomor.
4. `Date & Time` mengumpulkan tanggal, waktu, durasi, dan kebutuhan rental.
5. `Rental Options` membedakan rental dengan sopir dan self-drive.
6. `Booker Form` mengumpulkan nama, nomor WhatsApp, dan kebutuhan kontak yang diperlukan.
7. `Order Review` memberi checkpoint sebelum request dikirim.
8. `Phone Verification` memvalidasi kontak secara konseptual melalui OTP.
9. `Booking Status` menerangkan proses menggunakan status chip dan stepper.
10. Tombol selesai mengembalikan pelanggan ke Home sebagai hub aplikasi.

Precondition: pelanggan berada di Home atau masuk melalui bottom nav Pesan.
Postcondition: booking request telah dikirim secara prototype dan pelanggan berada pada status booking.
Batasan: tarif, availability, OTP, dan penyimpanan booking belum terhubung ke backend production.

### 8.5 User flow bantuan pelanggan

```text
Home (16:4)
  ↓ bottom nav Bantuan
Screen / Bantuan (273:336), jika versi landing FAQ dipakai
  ↓ Buat Ticket atau Kirim Pertanyaan
Help - New Ticket (228:262)
  ↓ Kirim Ticket
Help - Ticket Chat (228:305)
  ↓ tulis pesan lanjutan atau menunggu balasan
Percakapan ticket
```

Riwayat pekerjaan mencatat dua versi arsitektur bantuan:

- Versi A: `Home → Bantuan → Help - New Ticket → Help - Ticket Chat`.
- Versi B: `Home → Help - New Ticket → Help - Ticket Chat`, setelah screen Bantuan lama dianggap duplikat.

Keputusan final tidak boleh ditebak dari riwayat saja. Metadata terakhir masih menunjukkan `Screen / Bantuan` (`273:336`), sehingga target Nav Help dan keputusan satu entry bantuan harus diverifikasi ulang di prototype Figma sebelum menghapus screen atau reaction.

### 8.6 User flow admin, memproses booking

```text
Dashboard Overview (19:4)
  ↓ sidebar Incoming Bookings
Incoming Bookings (19:59)
  ↓ Lihat Detail
Booking Detail (19:112)
  ├─ Kembali → Incoming Bookings
  └─ Update Status → Booking Status Update (20:180)
                         ↓ pilih status
                         ↓ tulis catatan internal
                         ↓ pilih opsi konfirmasi WhatsApp
                         ↓ Simpan status
                       Dashboard Overview (19:4)
```

Flow administrasi lain:

```text
Dashboard Overview → Fleet Calendar
Dashboard Overview → Vehicle Status
Dashboard Overview → Customer Care
Customer Care → pilih ticket → Ticket Information → Conversation → Reply Composer
```

Tujuan admin bukan melihat statistik dekoratif, melainkan menemukan booking yang harus dikonfirmasi, memverifikasi data, memperbarui status, dan menindaklanjuti pelanggan.

### 8.7 User journey pelanggan

Journey ini merupakan hipotesis desain berdasarkan screen yang sudah dibuat.

| Fase | Kebutuhan dan konteks | Tindakan | Ekspektasi/pikiran pengguna | Dukungan UI | Risiko atau pain point |
|---|---|---|---|---|---|
| 1. Mulai | Membutuhkan rental mobil lokal yang terpercaya | Membuka aplikasi | “Apakah prosesnya jelas dan lokasinya sesuai?” | Brand, lokasi Merauke, ringkasan layanan | Kepercayaan turun jika informasi bisnis tidak jelas |
| 2. Mulai booking | Ingin melihat kendaraan secepatnya | Menekan `Pesan Mobil` | “Saya ingin langsung melihat pilihan.” | CTA utama di Home | CTA tersembunyi atau generik memperlambat tugas |
| 3. Pilih mobil | Membutuhkan kendaraan yang sesuai | Membandingkan daftar kendaraan | “Mobil dan plat mana yang bisa saya pilih?” | Vehicle list, nama, plat, status chip | Data contoh dapat disalahpahami sebagai availability live |
| 4. Pastikan detail | Takut salah kendaraan | Membuka Vehicle Detail | “Apakah ini mobil yang benar?” | Vehicle Card, specs, back button | Foto placeholder terlihat seperti foto final |
| 5. Tentukan jadwal | Perlu tanggal/waktu yang cocok | Memilih tanggal dan waktu | “Apakah jadwal saya tersedia?” | Calendar, availability dot, input | Kalender contoh harus diberi penanda |
| 6. Tentukan tipe rental | Memilih sopir atau mengemudi sendiri | Memilih option | “Mana yang sesuai kebutuhan dan syarat saya?” | Driver dan Self Drive cards | Deskripsi opsi mungkin belum cukup jelas |
| 7. Isi data | Tim perlu menghubungi pemesan | Mengisi Booker Form | “Data apa yang wajib saya berikan?” | Label dan placeholder input | Meminta data berlebih menurunkan rasa aman |
| 8. Periksa pesanan | Ingin mencegah kesalahan | Membaca Order Review | “Apakah semua detail sudah benar?” | Booking Card, sample note | Tarif belum final harus terlihat jelas |
| 9. Verifikasi | Memastikan kontak dapat digunakan | Mengisi OTP | “Apakah pesanan saya benar-benar tercatat?” | Enam OTP field, countdown | OTP masih simulasi prototype |
| 10. Menunggu | Membutuhkan kepastian progres | Melihat Booking Status | “Apa yang sedang dilakukan tim?” | Status chip, explanation, stepper | Jangan mengarang waktu respons |
| 11. Minta bantuan | Mengalami kendala atau punya pertanyaan | Membuka FAQ/ticket/chat | “Saya tidak ingin mengulang informasi.” | Search bantuan, kategori, ticket | Dua entry bantuan dapat membingungkan |
| 12. Selesai | Mendapat hasil atau ingin memulai lagi | Kembali ke Home/menutup ticket | “Saya tahu langkah berikutnya.” | CTA selesai dan status akhir | Success state tanpa hasil konkret tidak membantu |

### 8.8 User journey admin/staf

| Fase | Tujuan admin | Tindakan | Dukungan UI | Risiko/pain point |
|---|---|---|---|---|
| 1. Mulai kerja | Mengetahui prioritas | Membuka Dashboard Overview | Booking Queue menjadi konten utama | Statistik palsu mengaburkan prioritas |
| 2. Cari booking | Menemukan request yang harus diverifikasi | Membuka Incoming Bookings | Tabel Pemesan, Kendaraan, Tanggal, Status, Aksi | Kolom berlebih memperlambat keputusan |
| 3. Verifikasi | Memastikan data dan armada | Membuka Booking Detail | Booking Summary dan Vehicle Summary | Data contoh tidak diberi label |
| 4. Ubah status | Menyelesaikan verifikasi internal | Membuka Booking Status Update | Dropdown, catatan, checkbox WhatsApp | Dropdown overlap/terlalu panjang |
| 5. Komunikasikan | Memberi tahu pelanggan | Menyimpan status dan memilih opsi WhatsApp | `Kirim konfirmasi WhatsApp setelah disimpan` | Integrasi WhatsApp belum nyata |
| 6. Kelola armada | Memeriksa jadwal dan kondisi kendaraan | Membuka Fleet Calendar/Vehicle Status | Sembilan fleet rows dan filter | Availability contoh terlihat live |
| 7. Tangani kendala | Menjawab ticket | Membuka Customer Care dan membalas | Conversation List, Chat Panel, Reply Composer | Ticket contoh disalahpahami sebagai data nyata |

### 8.9 Perbedaan user flow, prototype routing, dan backend logic

| Lapisan | Contoh | Status |
|---|---|---|
| IA | Pengelompokan Pesan, Status, dan Bantuan | Sudah direkonstruksi dari struktur Figma |
| User journey | Pelanggan dari kebutuhan rental sampai melihat status | Hipotesis berbasis screen, perlu usability testing |
| User flow | Home → Vehicles → Detail → Date & Time → Review → Status | Sudah dipetakan di prototype Flow 1 |
| Prototype routing | `ON_CLICK`, `NAVIGATE`, `CHANGE_TO`, `SMART_ANIMATE` | Tercatat/terverifikasi pada snapshot riwayat, perlu cek ulang jika ada restore |
| Backend logic | Database, OTP, tarif, availability, WhatsApp | Belum ada, masih intent prototype |

### 8.10 Pertanyaan usability untuk validasi berikutnya

1. Apakah pengguna memahami perbedaan CTA `Pesan Mobil` dan bottom nav `Pesan`?
2. Apakah pengguna tahu status kendaraan mana yang benar-benar tersedia?
3. Apakah pengguna memahami bahwa tarif dikonfirmasi tim dan belum final?
4. Apakah perbedaan Driver dan Self Drive cukup jelas?
5. Apakah pengguna memahami alasan verifikasi nomor telepon?
6. Apakah arti empat tahap stepper dapat dipahami tanpa bantuan?
7. Apakah `Bantuan` dan `Help - New Ticket` terasa sebagai satu jalur atau dua menu yang tumpang tindih?
8. Apakah admin dapat menemukan booking berikutnya tanpa membaca dashboard terlalu lama?
9. Apakah dropdown status terbuka tanpa menutupi `Catatan internal`?
10. Apakah empty/loading/error state memberi sebab dan tindakan berikutnya dengan jelas?

---

## 9. Prototype Flow 1 dan routing yang telah dibuat

### 9.1 Prinsip flow

- Flow mobile berasal dari Home, bukan dari screen acak.
- Flow dashboard berasal dari Dashboard Overview.
- Bottom nav mobile konsisten pada screen mobile.
- Sidebar dashboard konsisten pada screen admin.
- State screen seperti Empty/Error adalah state pendukung, bukan harus menjadi starting point.
- Perubahan state component, seperti dropdown `CHANGE_TO`, bukan navigasi antar-screen.

### 9.2 Starting point yang terverifikasi dari riwayat prototype

Mobile:

- Page: `Mobile App` (`4:10`)
- Flow: `Flow 1`
- Starting point: `Screen / Home` (`16:4`)
- URL prototype sebelumnya memakai parameter `starting-point-node-id=16:4`.

Dashboard:

- Page: `Dashboard` (`4:11`)
- Flow: `Flow 1`
- Starting point: `Screen / Dashboard Overview` (`19:4`)
- URL prototype sebelumnya memakai parameter `starting-point-node-id=19:4`.

Riwayat juga menyebut `Customer Care` pernah dianalisis sebagai entry kedua secara konseptual karena dapat diakses langsung lewat sidebar, tetapi konfirmasi URL terakhir menyatakan starting point Flow 1 dashboard adalah `19:4`. Perlakukan `Customer Care` sebagai screen reachable/sub-menu, bukan starting point utama, kecuali Figma UI saat ini menunjukkan sebaliknya.

### 9.3 Mobile booking happy path

```text
Screen / Home (16:4)
  └─ Button "Pesan Mobil"
       → Screen / Available Vehicles (16:48)
            └─ Vehicle Row / pilih kendaraan
                 → Screen / Vehicle Detail (16:147)
                      └─ Button lanjut
                           → Screen / Date & Time (17:70)
                                └─ Button "Pilih Tanggal" / lanjut
                                     → Screen / Rental Options (17:129)
                                          └─ Pilih Driver atau Self Drive + lanjut
                                               → Screen / Booker Form (17:177)
                                                    └─ Button "Kirim Pesanan"
                                                         → Screen / Order Review (18:145)
                                                              └─ Button konfirmasi
                                                                   → Screen / Phone Verification (18:190)
                                                                        └─ Verifikasi OTP
                                                                             → Screen / Booking Status (18:243)
                                                                                  └─ Button selesai
                                                                                       → Screen / Home (16:4)
```

Detail logika konseptual:

1. Home memperkenalkan layanan dan menyediakan CTA booking.
2. Available Vehicles menampilkan 9 kendaraan dan status ketersediaan.
3. Vehicle Detail memastikan pelanggan melihat nama dan plat sebelum melanjutkan.
4. Date & Time mengumpulkan tanggal/waktu rental dan durasi/kebutuhan.
5. Rental Options membedakan rental dengan sopir dan self-drive.
6. Booker Form mengumpulkan identitas/kontak pemesan.
7. Order Review memberi kesempatan memeriksa semua data sebelum submit.
8. Phone Verification menahan proses sampai OTP tervalidasi.
9. Booking Status menampilkan status proses dan stepper.
10. Selesai mengembalikan pelanggan ke Home.

### 9.4 Mobile bottom navigation

Bottom nav memakai empat item pada screen mobile:

```text
Nav Item / Home   → Screen / Home (16:4)
Nav Item / Book   → Screen / Available Vehicles (16:48)
Nav Item / Status → Screen / Booking Status (18:243)
Nav Item / Help   → Screen / Bantuan (273:336) atau entry bantuan final yang dipilih manual
```

Riwayat menyebut nav Help pernah diarahkan ke `Help - New Ticket` langsung setelah screen Bantuan lama dihapus, lalu metadata terakhir kembali menampilkan `Screen / Bantuan`. Oleh karena itu, jangan melakukan refactor lanjutan tanpa memeriksa reaction target aktual pada node prototype.

### 9.5 Mobile help flow, versi sempat dibuat

Versi flow bantuan yang tercatat:

```text
Home (16:4)
  └─ Nav Help
       → Screen / Bantuan (273:336)
            └─ Button "Kirim Pertanyaan" / "＋ Buat Ticket"
                 → Screen / Help - New Ticket (228:262)
                      └─ Button "Kirim Ticket"
                           → Screen / Help - Ticket Chat (228:305)
```

Pada versi lain setelah screen Bantuan lama dihapus, flow diringkas menjadi:

```text
Home (16:4)
  └─ Nav Help
       → Help - New Ticket (228:262)
            └─ Kirim Ticket
                 → Help - Ticket Chat (228:305)
```

Status yang dapat dipercaya sekarang hanya: kedua screen `Help - New Ticket` dan `Help - Ticket Chat` ada; metadata terakhir juga masih menunjukkan `Screen / Bantuan`. Jika diminta “satu flow”, maksudnya adalah satu Flow 1 dan satu entry bantuan yang konsisten, bukan membuat screen bantuan baru.

### 9.6 Mobile Empty/Error routes

Riwayat flow mencatat:

- `Screen / Empty State` button `Coba Tanggal Lain` → `Screen / Date & Time`.
- `Screen / Error State` button `Coba Lagi` → `Screen / Order Review`.

Ini adalah state recovery route. Jika state tersebut hanya berupa contoh reference, tetap pertahankan label CTA dan tujuan yang nyata; jangan meninggalkan tombol mati.

### 9.7 Dashboard navigation flow

```text
Screen / Dashboard Overview (19:4)
  ├─ Sidebar Overview
  │    → Dashboard Overview (19:4)
  ├─ Sidebar Incoming Bookings
  │    → Incoming Bookings (19:59)
  │         └─ Button "Lihat Detail"
  │              → Booking Detail (19:112)
  │                   ├─ Button "Kembali"
  │                   │    → Incoming Bookings (19:59)
  │                   └─ Button "Update Status"
  │                        → Booking Status Update (20:180)
  │                             └─ Button "Simpan"
  │                                  → Dashboard Overview (19:4)
  ├─ Sidebar Fleet Calendar
  │    → Fleet Calendar (20:20)
  ├─ Sidebar Vehicle Status
  │    → Vehicle Status (20:142)
  │         └─ CTA calendar/status
  │              → Fleet Calendar (20:20) [tercatat sebagai route, cek label]
  └─ Sidebar Help / Customer Care
       → Customer Care (228:411)
            ├─ Sidebar Overview → Dashboard Overview
            ├─ Sidebar Incoming Bookings → Incoming Bookings
            ├─ Sidebar Fleet Calendar → Fleet Calendar
            └─ Sidebar Vehicle Status → Vehicle Status
```

Dashboard Overview juga memiliki CTA `Lihat Kalender` yang mengarah ke Fleet Calendar menurut riwayat.

### 9.8 Dashboard state routes

- `Screen / Empty State` button `Refresh` → `Incoming Bookings`.
- `Screen / Error State` button `Coba Lagi` → `Dashboard Overview`.
- Pastikan state action menyebut apa yang gagal dan langkah berikutnya.

### 9.9 Reactions yang dilaporkan

Riwayat validasi menyebut:

- Mobile: sekitar 11 navigasi utama pada trace tertentu.
- Dashboard: sekitar 11 navigasi utama plus state transitions komponen.
- Sebelum/selama refactor pernah dilaporkan 55 reactions dan kemudian 61 reactions, tetapi angka ini adalah snapshot riwayat, bukan hitungan yang boleh diasumsikan masih sama sekarang.
- Semua destination pada validasi saat itu dilaporkan `destExists: true` dan tidak ada dangling reference.

Jika perlu angka terbaru, jalankan validasi langsung di Figma; jangan menulis angka lama sebagai fakta terkini.

---

## 9. Logic dropdown mobile: Help Type

### 9.1 Masalah awal

Di `Screen / Help - New Ticket`, dropdown jenis bantuan awalnya tampak seperti opsi yang langsung terlihat sebagai teks. Pengguna menginginkan perilaku:

```text
Dropdown Closed → ditekan → Dropdown Open → pilih opsi → kembali Closed dengan nilai terpilih
```

### 9.2 Iterasi yang terjadi

1. **Percobaan pertama:** dropdown options/teks helper disembunyikan pada screen yang sama.
   - `Dropdown Field` tetap terlihat.
   - `Dropdown Options` diset `visible: false`.
   - Helper `Pilihan: Pertanyaan, Keluhan, atau Lainnya.` disembunyikan.
   - Hasil: closed visual state, tetapi belum interaktif.
2. **Percobaan kedua:** membuat screen clone `Screen / Help - New Ticket (Open)` (`376:302`) yang menampilkan opsi.
   - Closed → clone Open melalui `NAVIGATE`/On Click pada versi awal.
   - Masalah: prototype terhubung ke page/screen clone, bukan component state yang bersih.
3. **Refactor final yang tercatat:** membuat component set `Dropdown / Help Type` (`401:324`).
   - `State=Closed` (`401:322`): field tertutup, options tersembunyi.
   - `State=Open` (`401:323`): field terbuka dan options terlihat.
   - Instance di `Help - New Ticket` diganti menjadi instance component closed (`406:302`).
   - Clone `376:302` dihapus pada iterasi refactor tersebut.

### 9.3 Interaksi final yang dimaksud

```text
Instance Dropdown / Help Type, State=Closed
  └─ ON_CLICK + CHANGE_TO
       → State=Open (401:323)

State=Open
  ├─ ON_CLICK pada field
  │    └─ CHANGE_TO → State=Closed (401:322)
  ├─ ON_CLICK pada option "Pertanyaan"
  │    └─ CHANGE_TO → State=Closed
  ├─ ON_CLICK pada option "Keluhan"
  │    └─ CHANGE_TO → State=Closed
  └─ ON_CLICK pada option "Lainnya"
       └─ CHANGE_TO → State=Closed
```

Submit ticket tetap memakai navigasi screen:

```text
Submit Ticket → Help - Ticket Chat (228:305)
```

### 9.4 Catatan fidelity

- Jangan membuat screen clone baru hanya untuk open state jika component variant sudah tersedia.
- `CHANGE_TO` pada component variant adalah perubahan state, bukan routing halaman.
- Pastikan opsi open state tidak keluar dari card dan tidak menutupi field lain.
- Pastikan instance production memakai variant Closed saat pertama kali dibuka.
- Jika metadata saat ini kembali menunjukkan clone `376:302`, lakukan audit reaction sebelum menghapus apa pun.

---

## 10. Logic dropdown dashboard: Booking Status Update

### 10.1 Target screen

- Screen: `Screen / Booking Status Update` (`20:180`)
- Form: `Status Form` (`20:210`)
- Select wrapper: `Status Select` (`20:212`)
- Production dropdown instance: `178:605`

### 10.2 Perilaku interaktif

Versi yang pernah divalidasi memakai:

- Trigger: `ON_CLICK`.
- Action: `CHANGE_TO`.
- Destination variant: `Property 1=Yes` (`178:464`) pada komponen dropdown lama.
- Transition: `SMART_ANIMATE`, sekitar 0.1 detik.
- Ini adalah component variant transition, bukan `NAVIGATE` ke screen baru.

Konsepnya:

```text
Closed Dropdown
  └─ ON_CLICK + CHANGE_TO
       → Open/Yes variant
            └─ pilih Konfirmasi / Ditolak / Menunggu
                 → kembali ke variant closed/selected
```

### 10.3 Masalah layout dan diagnosis yang sudah terjadi

#### Masalah A: dropdown terlalu sempit

- Instance production awal hanya sekitar 163 px, sementara parent `Status Select` lebih lebar.
- Diagnosis: `layoutAlign: INHERIT` pada child, sedangkan parent auto-layout membutuhkan child horizontal stretch.
- Patch awal: `dropdown.layoutAlign = 'STRETCH'`.
- Hasil sementara: dropdown melebar hingga sekitar 504 px.

#### Masalah B: dropdown terbuka menutupi catatan internal

- `List of option` pada variant Yes memiliki `layoutPositioning: ABSOLUTE` dan lebar fixed sekitar 162 px.
- Parent variant Yes memakai `layoutMode: HORIZONTAL`.
- Akibat: list overlay ke luar dan menutupi field `Catatan internal`, bukan mendorong konten ke bawah.
- Patch:
  - `Frame 13`/`Frame 14` list option diset `layoutAlign: STRETCH`.
  - Parent variant Yes diubah `HORIZONTAL` → `VERTICAL`.
  - List option diubah `ABSOLUTE` → `AUTO` positioning.
  - List dibuat full-width terhadap parent.

#### Masalah C: setelah stretch, form terlalu besar/panjang

Refactor holistik yang tercatat:

- Dropdown: sekitar 504 px → 280 px.
- Status Form: auto-hug, sekitar 580 px → 360 px.
- Booking Context: auto-hug, sekitar 540 px → 279 px.
- Status Update Split: auto-hug, sekitar 1136 px → 655 px pada salah satu snapshot.
- Semua variant dropdown dikembalikan ke sizing fixed yang konsisten.
- Variant Yes tetap vertical dengan list options.

Snapshot hasil yang pernah dilaporkan:

| State | Ukuran yang dilaporkan |
|---|---:|
| Closed dropdown | 280 × 33 |
| Open dropdown | 280 × 83 |
| List options | full width sekitar 268 px |

### 10.4 Perbaikan HTML pendukung

`status_booking.html` dibuat sebagai referensi layout untuk masalah yang sama:

- Background `#dfe6ea`.
- Layout desktop dua kolom.
- Title besar `Update status booking`.
- Subtitle `Simpan perubahan setelah verifikasi internal selesai.`
- Card kiri `Booking dipilih`.
- Card kanan `Status baru`.
- Select status dengan opsi:
  - `Konfirmasi`
  - `Ditolak`
  - `Menunggu`
- Textarea `Catatan internal` dengan placeholder `Catatan untuk tim`.
- Checkbox `Kirim konfirmasi WhatsApp setelah disimpan`.
- Button `Simpan status`.
- CSS select memakai custom arrow, max-width 440 px, tinggi 44 px.
- Layout berubah menjadi satu kolom pada max-width 880 px.

File HTML ini memperbaiki presentational layout, tetapi native `<select>` tetap memiliki keterbatasan browser saat menu option dibuka. Untuk Figma, gunakan component variants, bukan mengandalkan native select behavior.

---

## 11. Riwayat pekerjaan dan perubahan penting

### 11.1 Setup awal dan verifikasi agent

- Pengguna bekerja dengan agent/Codex melalui VS Code dan meminta konfirmasi pekerjaan pada file Figma.
- Kesalahan awal terjadi karena hanya membaca metadata subtree yang tidak mencakup page Dashboard, sehingga Customer Care sempat salah dinyatakan tidak ada.
- Setelah query langsung ke node/page yang benar, ditemukan:
  - `Customer Care` (`228:411`) memang ada.
  - Dashboard page (`4:11`) memang ada.
  - Mobile App page (`4:10`) memang ada.
- Kesalahan lain: metadata static tidak menampilkan prototype connections. Validasi flow baru bisa dilakukan lewat JavaScript execution pada Figma file (`use_figma`) ketika tool tersedia.

### 11.2 Validasi jumlah tools MCP

Riwayat setup mencatat:

- Endpoint Figma MCP sempat melaporkan 34 tools setelah OAuth aktif.
- Pada sesi tertentu hanya sebagian tools yang ter-load atau terlihat.
- Remote Figma MCP di VS Code adalah jalur yang bisa dipakai untuk operasi tulis.
- Figma Desktop MCP lokal di Reasonix sebelumnya bersifat read-only dan jumlah tool lebih sedikit.
- Jangan menulis angka tools saat ini sebagai fakta tanpa discovery ulang. Yang penting secara operasional: gunakan `get_metadata`/screenshot untuk baca dan `use_figma` untuk inspect/mutate jika tersedia.

### 11.3 Perapihan flow

- Pengguna meminta tiga flow mobile dirapikan menjadi satu Flow 1.
- Salah satu iterasi menghapus `Screen / Bantuan` karena dianggap duplikat dengan Help New Ticket.
- Pengguna meminta jangan menghapus desain; dilakukan restore manual melalui Figma version history.
- Setelah restore, naming flow tidak dapat diubah melalui script karena properti flow name dilaporkan read-only/configurable false.
- Kesimpulan: penamaan flow harus diubah manual melalui UI Figma jika memang perlu.
- Flow URL terakhir yang pernah divalidasi:
  - Mobile memakai `starting-point-node-id=16:4`.
  - Dashboard memakai `starting-point-node-id=19:4`.
- URL prototype lama dapat berubah; jangan menganggap query parameter lama sebagai source of truth tanpa membuka prototype saat ini.

### 11.4 Eksperimen e-commerce

- Pengguna pernah meminta project Figma baru terpisah dari MobilJuragan untuk membuat home aplikasi e-commerce bergaya marketplace.
- Project tersebut bukan bagian dari file MobilJuragan dan bukan bagian dari flow rental.
- Asset `ecom_*` di workspace adalah bukti eksperimen/screenshot e-commerce, bukan screen MobilJuragan.

### 11.5 Iterasi dropdown mobile

Urutan: teks/options terlihat → disembunyikan → screen clone open → component set closed/open → clone dihapus dan production instance memakai component closed.

### 11.6 Iterasi dropdown dashboard

Urutan: dropdown 163 px → stretch menjadi 504 px → open list overlay/overlap → parent vertical + list auto positioning → refactor hug/compact → dibuat HTML referensi `status_booking.html`.

---

## 12. Prototype versus implementasi nyata

Ini adalah prototype UI/UX, bukan aplikasi backend production. Hal-hal berikut adalah simulasi/intent desain:

- Ketersediaan kendaraan bukan data live.
- Status booking bukan tersimpan ke database.
- OTP tidak benar-benar dikirim.
- Konfirmasi tarif bukan API nyata.
- WhatsApp confirmation hanya berupa pilihan/checkbox prototype.
- Customer Care tidak benar-benar mengirim pesan.
- Tombol/links harus memiliki tujuan prototype atau diberi label `Segera hadir`.
- Screenshot dan export asset adalah bukti visual, bukan database atau source code runtime.

Jika pekerjaan dilanjutkan ke implementasi aplikasi:

1. Buat model data booking.
2. Buat sumber kebenaran fleet/availability.
3. Tambahkan validasi field.
4. Implementasikan auth/OTP secara aman.
5. Integrasikan WhatsApp hanya setelah persetujuan dan kebutuhan bisnis jelas.
6. Pisahkan data contoh dari data produksi.
7. Pertahankan design tokens dan komponen dari Figma.

---

## 13. State matrix yang harus dipertahankan

### Mobile

| Area | Default | Empty | Loading | Error | Recovery |
|---|---|---|---|---|---|
| Home booking | Belum ada booking aktif | Booking list kosong | Memuat booking | Gagal memuat booking | Pesan mobil / Coba lagi |
| Available Vehicles | Sembilan kendaraan/availability | Tidak ada kendaraan untuk tanggal | Memuat daftar mobil | Gagal memuat data | Coba tanggal lain / Coba lagi |
| Booking Status | Menunggu Konfirmasi | Belum ada booking | Memuat status | Gagal memuat status | Kembali ke Home / Coba lagi |
| Help tickets | Ticket list / empty state | Belum ada ticket | Memuat ticket | Gagal memuat bantuan | Buat Ticket / Coba lagi |
| Chat | Percakapan atau empty state | Belum ada balasan | Memuat pesan | Gagal mengirim/memuat | Kirim lagi |

### Dashboard

| Area | Default | Empty | Error | Action |
|---|---|---|---|---|
| Booking Queue | Antrean booking | Belum ada booking untuk dikonfirmasi | Gagal memuat antrean | Refresh / buka Incoming Bookings |
| Incoming Bookings | Row `Data contoh` bila demo | Belum ada booking | Gagal memuat booking | Refresh |
| Fleet Calendar | 9 fleet rows | Jadwal belum tersedia | Gagal memuat kalender | Lihat ulang / Coba lagi |
| Vehicle Status | Filter status | Belum ada kendaraan pada filter | Gagal memuat status | Coba lagi / kalender |
| Booking Status Update | Booking context + form | Tidak ada booking dipilih | Gagal memuat detail | Kembali / refresh |
| Customer Care | Ticket list | Belum ada ticket | Gagal memuat ticket | Search / refresh |

---

## 14. Accessibility dan interaction requirements

- Semua tap target mobile minimal 44 × 44 px.
- Bottom nav mobile selalu berlabel, bukan icon-only.
- Konten tidak tertutup bottom nav dan menghormati safe area.
- Tidak boleh ada horizontal overflow pada 390 px.
- Form harus memiliki label yang selalu terlihat.
- Error ditampilkan inline di bawah field atau panel yang relevan.
- Focus state harus terlihat.
- Kontras teks memenuhi WCAG AA.
- Motion hanya untuk perubahan state nyata:
  - dropdown open/closed,
  - stepper maju,
  - status chip berubah,
  - modal buka/tutup.
- Tidak ada loop animation, floating decorative animation, glow, atau pulse dekoratif.
- Maksimal satu micro-interaction per screen.

---

## 15. Delivery Gate sebelum mengubah atau mengumpulkan

Checklist wajib:

- [ ] Tidak ada em dash pada teks UI.
- [ ] Tidak ada overflow pada 390 × 844 dan 1440 × 900.
- [ ] Tidak ada angka/statistik/nama/testimonial fiktif tanpa label `Data contoh`.
- [ ] Kendaraan hanya memakai 9 dataset resmi.
- [ ] Tarif memakai copy konfirmasi, bukan angka rekaan.
- [ ] Semua aset visual jujur: placeholder diberi label.
- [ ] Semua navigasi/tombol punya target nyata atau label `Segera hadir`.
- [ ] Kontras WCAG AA.
- [ ] Empty, loading, dan error state tersedia untuk list booking, kendaraan, dan table.
- [ ] Palette tidak melewati 3 core + 1 accent.
- [ ] Gold hanya pada momen penting.
- [ ] Radius 4/8/12 dan maksimal dua level shadow digunakan disiplin.
- [ ] Tidak ada gradient/glow/glassmorphism/dekorasi tanpa fungsi.
- [ ] CTA spesifik produk.
- [ ] Microcopy Bahasa Indonesia, layer name English.
- [ ] ENERGY 2 / RHYTHM 2 / MOTION 1 tetap konsisten.
- [ ] Design read sudah dipahami sebelum menggambar.
- [ ] Identitas tetap terasa MobilJuragan walau logo diganti.
- [ ] Jangan menghapus node sebelum pengguna menyetujui dan backup/version history tersedia.
- [ ] Jangan menyatakan flow/reaction valid hanya berdasarkan metadata static.

---

## 16. Cara melanjutkan pekerjaan dengan aman

### Sebelum membaca/mengubah Figma

1. Baca `DESIGN.md`.
2. Baca bagian relevan dari dump ini.
3. Buka file key `Rxdv5kRYC8NiQpdWJhoIGJ`.
4. Bedakan page `Mobile App`, `Dashboard`, dan `Design System`.
5. Inspect node target berdasarkan ID/nama, jangan membuat duplikat.
6. Ambil screenshot sebelum perubahan jika perubahan visual besar.
7. Minta/konfirmasi backup manual melalui Figma version history sebelum operasi destruktif.

### Untuk read-only inspect

- Metadata untuk inventaris node.
- Screenshot untuk validasi visual.
- JavaScript/Figma file execution untuk reaction/prototype data jika tersedia.
- Jangan simpulkan prototype connection dari metadata saja.

### Untuk operasi tulis

- Gunakan komponen dari Design System.
- Gunakan auto-layout.
- Ubah node kecil/incremental, bukan membangun ulang seluruh page.
- Setelah perubahan, screenshot dan cek ukuran/overlap.
- Jangan melakukan retry script yang sama jika error server; ubah pendekatan atau kecilkan batch.
- Jangan menggunakan screen clone untuk component state yang bisa direpresentasikan dengan variant.
- Jangan menghapus backup/snapshot internal/manual.

### Prompt lanjutan yang aman

Gunakan pola:

> Continue from the last completed Figma write operation. Do not restart or duplicate existing frames. Inspect what already exists, then continue the remaining work according to the prompt and report progress.

Untuk masalah spesifik, selalu sertakan:

- file key atau URL,
- page,
- screen/node ID,
- gejala visual,
- target behavior,
- apakah perubahan boleh destruktif,
- bukti screenshot sebelum/sesudah.

---

## 17. Catatan setup model/agent yang masih relevan

Bagian ini dipertahankan dari dump lama karena menjelaskan lingkungan kerja agent yang digunakan untuk membangun/mengecek Figma.

### 17.1 Provider

- Provider custom: `semut`
- Model: `semut-auto`
- Base URL: `https://ai.semutssh.com/v1`
- Context window: 1,000,000 input tokens
- Max output: 65,535 tokens
- Endpoint yang pernah terverifikasi 200:
  - `/v1/messages`
  - `/v1/chat/completions`
  - `/v1/responses`
- Tool calling: terverifikasi bisa.
- Thinking/effort: `none`, `low`, `medium`, `high`, `xhigh`, `max` pernah diterima.
- Backend model yang terlihat di stream: `deepseek-v4-flash-flex`.

### 17.2 Lokasi konfigurasi

| Item | Lokasi |
|---|---|
| VS Code model config | `C:\Users\Hylmi\AppData\Roaming\Code\User\chatLanguageModels.json` |
| VS Code settings | `C:\Users\Hylmi\AppData\Roaming\Code\User\settings.json` |
| Reasonix config | `C:\Users\Hylmi\AppData\Roaming\Reasonix\config.toml` |
| Reasonix env | `C:\Users\Hylmi\AppData\Roaming\Reasonix\.env` |
| VS Code MCP | `C:\Users\Hylmi\AppData\Roaming\Code\User\mcp.json` |
| Figma Desktop MCP | `http://127.0.0.1:3845/mcp` |

VS Code yang tercatat: `1.135.0`.

### 17.3 Konfigurasi VS Code yang bekerja

```json
[
  {
    "name": "Semut",
    "vendor": "customendpoint",
    "apiKey": "${input:chat.lm.secret.<secret-id>}",
    "apiType": "messages",
    "models": [
      {
        "id": "semut-auto",
        "name": "Semut Auto",
        "url": "https://ai.semutssh.com/v1/messages",
        "toolCalling": true,
        "vision": true,
        "thinking": true,
        "supportsReasoningEffort": ["none", "low", "medium", "high", "xhigh", "max"],
        "maxInputTokens": 1000000,
        "maxOutputTokens": 65535
      }
    ]
  }
]
```

Jangan menyalin secret-id/key literal dari konfigurasi lama ke dokumen publik.

### 17.4 Konfigurasi Reasonix yang bekerja

```toml
[[providers]]
name        = "semut"
kind        = "anthropic"
base_url    = "https://ai.semutssh.com/v1"
chat_url    = "https://ai.semutssh.com/v1/messages"
request_url = "https://ai.semutssh.com/v1/messages"
models      = ["semut-auto"]
api_key_env = "SEMUT_API_KEY"
vision_models = ["semut-auto"]
model_overrides = { "semut-auto" = { supported_efforts = ["disabled", "low", "medium", "high", "xhigh", "max"], default_effort = "medium", context_window = 1000000 } }
```

### 17.5 Error yang pernah diselesaikan

| Error | Penyebab | Solusi |
|---|---|---|
| `No api key passed in` | Plaintext/env reference tidak di-resolve VS Code | Simpan API key melalui UI dan pakai `${input:chat.lm.secret.<id>}` |
| `401 authentication_error` | Vendor built-in Anthropic memanggil endpoint Anthropic | Pakai `vendor: customendpoint` |
| `500` | `apiType: responses` mengirim field yang gateway tidak dukung | Pakai `apiType: messages` dan endpoint `/v1/messages` |
| `400 content[].thinking` | Passback thinking block bermasalah pada client lama | Turunkan effort ke `none`/`disabled` sementara |
| `401 spend_limit_error` | Kuota/spend limit provider | Test gateway langsung; jika gateway sehat, tunggu/restart/cek saldo |

### 17.6 Checklist troubleshooting agent

1. Cek `vendor` = `customendpoint`.
2. Cek `apiType` = `messages`.
3. Cek URL = `/v1/messages`.
4. Cek API key tersimpan di SecretStorage, bukan plaintext di JSON.
5. Reload VS Code setelah edit config.
6. Restart Reasonix setelah edit TOML.
7. Bedakan error provider/kuota dari error konfigurasi.
8. Jangan menaruh secret dalam screenshot, dump, commit, atau prompt.

---

## 18. Status akhir dan unresolved items

### Terverifikasi/selesai pada snapshot ini

- [x] File Figma utama dan file key teridentifikasi.
- [x] Tiga page Figma teridentifikasi.
- [x] Struktur mobile utama terpetakan.
- [x] Struktur dashboard utama terpetakan.
- [x] Design System dan komponen utama terpetakan.
- [x] Dataset sembilan kendaraan terdokumentasi.
- [x] Entry point Flow 1 mobile `16:4` terdokumentasi.
- [x] Entry point Flow 1 dashboard `19:4` terdokumentasi.
- [x] Logic booking mobile terdokumentasi.
- [x] Logic navigasi dashboard terdokumentasi.
- [x] Iterasi dropdown mobile terdokumentasi.
- [x] Diagnosis dropdown dashboard terdokumentasi.
- [x] File HTML pendukung terdokumentasi.
- [x] Prompt lanjutan aman terdokumentasi.

### Belum boleh dianggap final tanpa cek ulang

- [ ] Apakah `Screen / Bantuan` (`273:336`) benar-benar masih dipakai sebagai target Nav Help pada prototype saat ini.
- [ ] Apakah jumlah reaction terbaru masih sama dengan snapshot 55/61.
- [ ] Apakah semua destination prototype masih ada setelah restore/refactor terakhir.
- [ ] Apakah dropdown dashboard open state terakhir sudah tidak overlap dan tetap kompak di Figma canvas.
- [ ] Apakah `Customer Care` menjadi route sidebar biasa atau starting point tambahan di Figma UI saat ini.
- [ ] Apakah label CTA pada `Vehicle Status` yang mengarah ke Fleet Calendar sudah sesuai.
- [ ] Apakah nama child layer pada Rental Options perlu dirapikan; lakukan hanya jika tidak memutus koneksi.
- [ ] Apakah semua copy yang memakai data contoh sudah memiliki label visual.
- [ ] Apakah screenshot/export di workspace merepresentasikan versi terakhir atau versi iterasi lama.

---

## 19. Instruksi untuk agent berikutnya

Jika agent berikutnya diminta melanjutkan proyek ini, agent harus:

1. Tidak mengulang dari nol.
2. Tidak membuat screen/frame duplikat.
3. Tidak menghapus screen berdasarkan asumsi metadata lama.
4. Memeriksa page dan node target terlebih dahulu.
5. Membaca `DESIGN.md` sebelum perubahan visual.
6. Memakai ID Figma yang tercantum di dump sebagai petunjuk, lalu memvalidasi keberadaannya.
7. Menggunakan `Screen / Home` sebagai starting point mobile dan `Screen / Dashboard Overview` sebagai starting point dashboard kecuali Figma saat ini secara eksplisit berbeda.
8. Memperlakukan dropdown sebagai component state transition jika component set tersedia.
9. Mengambil screenshot sebelum dan sesudah perubahan layout sensitif.
10. Menjelaskan perubahan berdasarkan masalah dan evidence, bukan sekadar “sudah dibuat”.
11. Menjaga data integrity sembilan kendaraan dan copy tarif.
12. Menganggap semua angka jumlah reaction/tools sebagai snapshot historis, bukan fakta live.
13. Melaporkan dengan jujur jika tool tidak dapat membaca prototype connections.

---

## 20. Sumber evidence yang dipakai untuk dump ini

- `DESIGN.md` pada workspace.
- `P1 Desain UI UX.txt` pada workspace.
- Struktur dan isi `dashboard_kasir.html`.
- Struktur dan isi `status_booking.html`.
- Inventaris folder workspace dan folder `Icon/`.
- Metadata Figma untuk:
  - Page `Mobile App` (`4:10`)
  - Page `Dashboard` (`4:11`)
  - Page `Design System` (`0:1`)
- Design context dan screenshot `Screen / Home`.
- Screenshot `Screen / Home` dan `Screen / Bantuan`.
- Riwayat sesi Copilot lokal pada workspace yang memuat validasi prototype, flow, dropdown, backup, dan refactor.

Dokumen ini adalah snapshot konteks, bukan pengganti version history Figma. Sebelum operasi destruktif, tetap gunakan Figma version history/manual backup.

---

# Lampiran A: Prompt lanjutan yang dipakai

```text
Continue from the last completed Figma write operation. Do not restart or duplicate existing frames. Inspect what already exists, then continue the remaining work according to the prompt and report progress.
```

Makna prompt:

- `Continue from the last completed Figma write operation`: lanjutkan dari hasil mutasi Figma terakhir yang sudah selesai.
- `Do not restart`: jangan membangun ulang page/screen dari awal.
- `Do not duplicate existing frames`: jangan membuat frame kedua dengan isi sama hanya karena agent kehilangan context.
- `Inspect what already exists`: lakukan inventory/inspection sebelum menulis.
- `continue remaining work`: kerjakan hanya bagian yang belum selesai.
- `report progress`: laporkan node yang diperiksa, perubahan yang dibuat, dan validasi sesudahnya.

---

---

# Lampiran C: Update pasca Pertemuan ke-2

> Tanggal pembaruan: 1 September 2026
> Status dump: **lengkap berdasarkan bukti terbaru di workspace**.
> Tujuan: mencatat hasil pekerjaan minggu ke-2 sejak dump terakhir, tanpa menghapus sejarah sebelumnya.

---

## 0. Ringkasan eksekutif pembaruan

Minggu ke-2 mata kuliah UI UX berfokus pada Information Architecture dan Advanced User Flow. Hasil kerja minggu ini berada di workspace tugas dan tidak menyentuh prototype Figma existing. Tidak ada node, screen, component, reaction, atau prototype connection Figma yang berubah.

Output minggu ke-2:

- Folder `IA/` berisi 8 diagram `.drawio`.
- Folder `user-flow/` berisi 33 diagram `.drawio` hitam-putih, dibagi ke dalam tiga folder flow dan dua subfolder surface.
- Dua dokumen Word sebagai pendamping penjelasan.

---

## 1. Status folder workspace minggu ke-2

Folder: `D:/tugas kuliah/semester 3/uiux/minggu ketiga/cbl/`.

| Path | Peran saat ini |
|---|---|
| `CONTEXT_DUMP_semut_copilot_vscode.md` | Dump konteks yang sudah diperbarui (lampiran ini). |
| `MobilJuragan_IA_dan_User_Flow.docx` | DOCX pertama berisi ringkasan, IA, primary flow, alternate flow, error flow, dan checklist. Format memakai heading bernomor, callout, dan tabel. |
| `Penjelasan_Naratif_IA_dan_User_Flow_MobilJuragan.docx` | DOCX pendamping dengan format naratif mengikuti contoh acuan. Setiap fitur memakai kalimat pembuka untuk Primary Flow, Alternate Flow, dan Error Flow, kemudian daftar langkah bernomor. |
| `IA/` | Folder berisi diagram Information Architecture. |
| `user-flow/` | Folder berisi diagram Primary Flow, Alternate Flow, dan Error Flow. |
| `P2 Information Architecture (IA).pptx.pdf` | Materi kuliah minggu ke-2. |
| `P2 Information Architecture (IA).pptx.txt` | Versi teks dari materi kuliah. |
| `WhatsApp Image 2026-08-31 at 21.07.00.jpeg` | Referensi simbol flowchart hitam-putih dari tugas. |

Tidak ada file Figma yang ditambahkan atau diubah di workspace minggu ini.

---

## 2. Struktur folder `IA/`

Isi folder:

- `00_Master_IA_MobilJuragan.drawio` untuk peta IA Mobile App dan Dashboard Web.
- `01_IA_Beranda_Pelanggan.drawio`.
- `02_IA_Pemesanan_Mobil.drawio`.
- `03_IA_Status_Booking.drawio`.
- `04_IA_Bantuan_Pelanggan.drawio`.
- `05_IA_Operasional_Booking_Admin.drawio`.
- `06_IA_Manajemen_Armada.drawio`.
- `07_IA_Customer_Care_Admin.drawio`.

Konvensi visual:

- Global navigation memakai node dengan `fillColor=#B7F34A` (hijau).
- Local navigation memakai node dengan `fillColor=#FFFFFF` (putih).
- Contextual action memakai node dengan `fillColor=#D9D9D9` (abu-abu).
- Header diagram memakai `text` dengan judul uppercase.
- Edge global ke local memakai garis solid; edge ke contextual memakai garis dashed.

Validasi:

- 8 file `.drawio` valid sebagai XML.
- Tidak ada dangling connection.

---

## 3. Struktur folder `user-flow/`

Tiga folder utama sesuai jenis flow:

- `primary flow/` berisi `mobile app/` dan `dashboard web/`.
- `alternate flow/` berisi `mobile app/` dan `dashboard web/`.
- `error flow/` berisi `mobile app/` dan `dashboard web/`.

Jumlah file per subfolder:

- `primary flow/mobile app/` : 4 diagram (Beranda, Pemesanan, Status, Bantuan).
- `primary flow/dashboard web/` : 7 diagram (Dashboard Overview, Incoming Bookings, Booking Detail, Booking Status Update, Fleet Calendar, Vehicle Status, Customer Care).
- `alternate flow/mobile app/` : 4 diagram.
- `alternate flow/dashboard web/` : 7 diagram.
- `error flow/mobile app/` : 4 diagram.
- `error flow/dashboard web/` : 7 diagram.

Total: **33 diagram `.drawio`**.

Setiap diagram memakai simbol flowchart hitam-putih sesuai legenda referensi tugas. Geometri mengikuti referensi:

- `Start / End` memakai `shape=mxgraph.flowchart.terminator`.
- `Process 1` memakai `shape=mxgraph.flowchart.process`.
- `Process 2` memakai `rounded=1`.
- `Process 3` memakai `shape=hexagon`.
- `Conditional` memakai `shape=rhombus`.
- `Manual Operation` memakai `shape=trapezoid`.
- `Display` memakai `shape=display`.
- `Input / Output` memakai `shape=parallelogram`.
- `Document` memakai `shape=document`.
- `Multiple Documents` memakai `shape=mxgraph.flowchart.documents`.
- `Start Loop` memakai `shape=mxgraph.flowchart.loop_limit`.
- `End Loop` memakai `shape=mxgraph.flowchart.loop_limit` dengan `flipH=1`.

Pengaturan warna dijaga konsisten: semua `fillColor` selain header adalah `#FFFFFF` atau `#000000`; tidak ada warna lain. Edge memakai `strokeColor=#000000` dengan panah `endArrow=block`.

Validasi:

- 33 file `.drawio` valid sebagai XML.
- Tidak ada dangling source/target pada edge.
- Hanya fill `#FFFFFF` dan `#000000` yang dipakai untuk shape.

---

## 4. Peta IA ke User Flow

### 4.1 Mobile App

| Fitur IA | Primary Flow | Alternate Flow | Error Flow |
|---|---|---|---|
| Beranda Pelanggan | `primary flow/mobile app/01_Primary_Beranda_Pelanggan.drawio` | `alternate flow/mobile app/01_Alternate_Beranda_Pelanggan.drawio` | `error flow/mobile app/01_Error_Beranda_Pelanggan.drawio` |
| Pemesanan Mobil | `02_Primary_Pemesanan_Mobil.drawio` | `02_Alternate_Pemesanan_Mobil.drawio` | `02_Error_Pemesanan_Mobil.drawio` |
| Status Booking | `03_Primary_Status_Booking.drawio` | `03_Alternate_Status_Booking.drawio` | `03_Error_Status_Booking.drawio` |
| Bantuan Pelanggan | `04_Primary_Bantuan_Pelanggan.drawio` | `04_Alternate_Bantuan_Pelanggan.drawio` | `04_Error_Bantuan_Pelanggan.drawio` |

### 4.2 Dashboard Web

| Fitur IA | Primary Flow | Alternate Flow | Error Flow |
|---|---|---|---|
| Dashboard Overview | `primary flow/dashboard web/01_Primary_Dashboard_Overview.drawio` | `alternate flow/dashboard web/01_Alternate_Dashboard_Overview.drawio` | `error flow/dashboard web/01_Error_Dashboard_Overview.drawio` |
| Incoming Bookings | `02_Primary_Incoming_Bookings.drawio` | `02_Alternate_Incoming_Bookings.drawio` | `02_Error_Incoming_Bookings.drawio` |
| Booking Detail | `03_Primary_Booking_Detail.drawio` | `03_Alternate_Booking_Detail.drawio` | `03_Error_Booking_Detail.drawio` |
| Booking Status Update | `04_Primary_Booking_Status_Update.drawio` | `04_Alternate_Booking_Status_Update.drawio` | `04_Error_Booking_Status_Update.drawio` |
| Fleet Calendar | `05_Primary_Fleet_Calendar.drawio` | `05_Alternate_Fleet_Calendar.drawio` | `05_Error_Fleet_Calendar.drawio` |
| Vehicle Status | `06_Primary_Vehicle_Status.drawio` | `06_Alternate_Vehicle_Status.drawio` | `06_Error_Vehicle_Status.drawio` |
| Customer Care | `07_Primary_Customer_Care.drawio` | `07_Alternate_Customer_Care.drawio` | `07_Error_Customer_Care.drawio` |

---

## 5. Hasil revisi yang sudah terjadi

Riwayat singkat iterasi minggu ini (yang tercatat di session saat ini):

1. Pertama: `IA/` dan `user-flow/` dengan folder composite per area besar. Audit menemukan beberapa diagram Dashboard masih menggabungkan beberapa screen. Status: **superseded**.
2. Kedua: 33 diagram User Flow terpisah per fitur dengan subfolder `mobile app` dan `dashboard web`. Style diagram masih memakai warna sesuai legenda referensi. Status: **superseded**.
3. Ketiga: revisi style flowchart User Flow menjadi hitam-putih sesuai permintaan. Symbol geometry mengikuti referensi tetapi warna dipusatkan ke `#FFFFFF` dan `#000000`. Status: **accepted**.
4. Keempat: restrukturisasi User Flow per surface sehingga Mobile App dan Dashboard Web terpisah. Setiap fitur memiliki satu diagram per flow type. Status: **accepted** (final untuk minggu ke-2).

File sementara generator dan cache Python sudah dihapus setelah setiap iterasi.

---

## 6. Pembaruan dokumen Word

### 6.1 `MobilJuragan_IA_dan_User_Flow.docx`

Dokumen DOCX pertama berisi:

- Ringkasan proyek.
- Penjelasan IA dengan Organization, Labeling, Navigation, dan Search.
- Pemetaan IA ke screen/node prototype.
- Primary Flow, Alternate Flow, dan Error Flow untuk Mobile App dan Dashboard Web.
- Tabel alternate dan error per fitur.
- Matriks coverage fitur dan flow.
- Aturan data (9 kendaraan resmi, tarif dikonfirmasi tim, label `Data contoh`).
- Checklist pengumpulan.

### 6.2 `Penjelasan_Naratif_IA_dan_User_Flow_MobilJuragan.docx`

Dokumen DOCX kedua berisi penjelasan dengan format naratif sesuai contoh acuan. Setiap fitur Mobile App dan Dashboard Web menggunakan kalimat pembuka untuk Primary Flow, Alternate Flow, dan Error Flow, kemudian daftar langkah bernomor.

### 6.3 Dokumen penjelasan sebelumnya

Versi sebelumnya `Penjelasan_General_IA_dan_User_Flow_MobilJuragan.docx` dan `Penjelasan_IA_dan_User_Flow_MobilJuragan.docx` sudah dihapus setelah versi naratif dibuat agar tidak ada duplikasi.

### 6.4 Validasi dokumen Word

- `MobilJuragan_IA_dan_User_Flow.docx` dapat diparse oleh python-docx: 107 paragraf, 24 tabel.
- `Penjelasan_Naratif_IA_dan_User_Flow_MobilJuragan.docx` dapat diparse: 240 paragraf, 6 tabel.
- Kedua dokumen memakai `endArrow=block` pada diagram flowchart (pada embedded SVG).
- Tidak ada em dash (`—`) pada teks dokumen.

---

## 7. Status Figma setelah minggu ke-2

- File Figma utama `Rxdv5kRYC8NiQpdWJhoIGJ` tidak disentuh selama minggu ke-2.
- Semua node, screen, layer, component, dan prototype connection yang tercatat di dump sebelumnya masih dianggap berlaku sampai verifikasi ulang di Figma UI.
- Dropdown `Dropdown / Help Type` dengan state Closed/Open tetap menjadi acuan dropdown mobile.
- Dropdown `Status Select` di Booking Status Update masih memerlukan validasi ulang karena riwayat menunjukkan masalah layout.
- Prototype `Flow 1` dengan starting point `16:4` (mobile) dan `19:4` (dashboard) masih tercatat, tetapi angka reactions belum diverifikasi ulang.
- Riwayat menghapus lalu restore `Screen / Bantuan` (`273:336`) sudah berakhir dengan status `Screen / Bantuan` masih ada di metadata terakhir. Jangan memindahkan atau menghapus tanpa validasi visual.

---

## 8. Daftar file yang boleh diabaikan

- `find_status_ui.ps1` dan script sementara lainnya tidak boleh dianggap source.
- Asset eksperimen `ecom_*` bukan bagian MobilJuragan.
- HTML pendukung `dashboard_kasir.html` dan `status_booking.html` tetap referensi eksperimen, bukan source produksi.

---

## 9. Sumber evidence pembaruan

Bukti pembaruan berasal dari:

- File dan struktur folder yang diperiksa langsung pada workspace `D:/tugas kuliah/semester 3/uiux/minggu ketiga/cbl/`.
- File `CONTEXT_DUMP_semut_copilot_vscode.md` versi sebelumnya yang memuat struktur Figma dan node ID.
- Hasil validasi otomatis terhadap file `.drawio` dan `.docx`.
- Session logika percakapan yang menghasilkan lampiran ini.

Tidak ada bukti yang mengkonfirmasi perubahan Figma sejak dump sebelumnya, sehingga kondisi Figma dianggap sama sampai verifikasi ulang dilakukan.

# Lampiran B: Ringkasan paling singkat untuk handoff

MobilJuragan adalah prototype rental mobil Merauke dengan dua page Figma: Mobile App 390 × 844 dan Dashboard 1440 × 900, plus Design System. Mobile mulai dari Home `16:4`, booking path: Available Vehicles `16:48` → Vehicle Detail `16:147` → Date & Time `17:70` → Rental Options `17:129` → Booker Form `17:177` → Order Review `18:145` → Phone Verification `18:190` → Booking Status `18:243`. Dashboard mulai dari Overview `19:4`, menuju Incoming Bookings `19:59` → Booking Detail `19:112` → Booking Status Update `20:180`, serta Fleet Calendar `20:20`, Vehicle Status `20:142`, Customer Care `228:411`. Design system berada di `0:1`, memakai navy `#1E3A5F`, teal `#0E7C7B`, gold `#D4A017`, Inter, spacing 8 px, radius 4/8/12, dan maksimal dua elevation. Dropdown mobile memakai component set `Dropdown / Help Type` `401:324` dengan Closed/Open variant, bukan screen clone. Dropdown dashboard memakai component variant `CHANGE_TO`, tetapi pernah mengalami stretch/overlap/overlong; cek visual sebelum mengubah lagi. Data kendaraan hanya sembilan plat resmi dan tarif tidak boleh direka. Jangan menghapus atau menggandakan frame; baca `DESIGN.md` dan validasi Figma sebelum mutasi.

---

# Lampiran D: Update Tugas Lo-Fi Wireframe Minggu ke-3 — 07/09/26

> Status: **sudah dibangun di Figma, menunggu review dosen dan submission LMS**.

## 0. Ringkasan

Pada 07 Sep 2026, dibangun satu set halaman Figma khusus tugas Lo-Fi Wireframe untuk MobilJuragan MVP. Set ini terpisah dari page high-fidelity `Mobile App`, `Dashboard`, dan `Design System`. Target brief: 3 layar customer mobile 390 × 844 px, monokrom, dengan anotasi Laws of UX.

## 0a. Batch 2 (09/09/26, prompt v2.1)

Setelah peninjauan ulang terhadap §8.4 (user flow booking), §8.7 (user journey), dan §8.10 (pertanyaan usability), Batch 2 lanjutan ditambahkan untuk menutup step 4–6 user flow dan fase 4–6 user journey pelanggan. Page baru dibangun tanpa mengubah 4 page Batch 1.

| Page ID | Nama | Frame | Node sumber hi-fi |
|---|---|---|---|
| `721:309` | `Lo-Fi — Detail Kendaraan` | `721:312` (`Screen / Lo-Fi — Detail Kendaraan`, 390 × 844) | `Screen / Vehicle Detail` (`16:147`) |
| `721:310` | `Lo-Fi — Tanggal & Waktu` | `722:308` (`Screen / Lo-Fi — Tanggal & Waktu`, 390 × 844) | `Screen / Date & Time` (`17:70`) |
| `721:311` | `Lo-Fi — Opsi Rental` | `723:308` (`Screen / Lo-Fi — Opsi Rental`, 390 × 844) | `Screen / Rental Options` (`17:129`) |

Mulai batch 2, setiap layar baru memakai 5 callout dengan penomoran global 10–24 dan urutan Fitts → Hick → Jakob → Miller + Chunking → Proximity. Ringkasan anotasi di `Ringkasan Anotasi Lo-Fi` (`674:308`) ditambah 15 baris (10–24); baris 1–9 tidak diubah.

### 0b. Analisis alignment dengan workflow dan journey

- Setiap layar Batch 2 menutup satu step di §8.4 (Booking happy path): Detail Kendaraan = step 4, Tanggal & Waktu = step 5, Opsi Rental = step 6.
- Setiap layar menjawab pikiran/pain point fase 4–6 user journey (§8.7): "Apakah ini mobil yang benar?", "Apakah jadwal saya tersedia?", "Mana yang sesuai kebutuhan dan syarat saya?".
- Pertanyaan usability §8.10 yang terjawab oleh Batch 2: 4 (perbedaan Driver vs Self Drive) lewat dua kartu Opsi Rental; 1–3 (CTA Pesan Mobil, status ketersediaan, tarif final) tetap dijaga oleh elemen Lo-Fi Batch 1 dan 2.
- Pertanyaan usability §8.10 yang belum terjawab dan menunggu Batch 3/4: 5 (verifikasi nomor), 6 (stepper), 7 (entri bantuan tunggal), 8 (admin menemukan booking), 9 (dropdown status tidak overlap), 10 (state kosong/error).

### 0c. Koreksi lanjutan

Label `Data contoh` kedua ditambahkan di header bulan kalender `Lo-Fi — Tanggal & Waktu` (node `747:308`) agar jawaban atas pertanyaan §8.10–1 dan §8.10–3 langsung terlihat pada Fase 5 journey. Screenshot `lofi_exports/06_tanggal_waktu.png` diperbarui setelah koreksi tersebut. Blueprint `lofi_blueprint.md` bagian 6.1 dan logbook `2026-09-07_M-ux_lofi-wireframe_Hylmi.md` bagian 11.6 ikut disinkronkan.

### 0d. Pemisahan anotasi Batch 1 dan gabungan

Halaman Figma `Lo-Fi — Anotasi` sekarang menyimpan dua frame ringkasan:

| Frame | Node | Isi |
|---|---|---|
| `Ringkasan Anotasi Lo-Fi (Batch 1)` | `748:308` | 9 baris anotasi Batch 1 saja. |
| `Ringkasan Anotasi Lo-Fi (Batch 1 + Batch 2)` | `674:308` | 24 baris gabungan Batch 1 dan Batch 2. |

Frame gabungan (`674:308`) adalah frame lama yang dinamai ulang. Baris 1–9 tidak dipindahkan atau diedit. Frame Batch 1 (`748:308`) dibuat sebagai salinan visual mandiri sehingga dua kebutuhan dapat dibaca terpisah. Evidence baru disimpan sebagai `lofi_exports/04a_ringkasan_anotasi_batch1.png` dan `lofi_exports/04b_ringkasan_anotasi_batch1_batch2.png`. Page `Lo-Fi — Anotasi` hanya menerima dua frame baru; screen/frame Batch 1 lainnya tidak diubah.

## 1. Halaman Figma baru

| Page ID | Nama | Isi |
|---|---|---|
| `641:308` | `Lo-Fi — Beranda` | Frame Beranda + callout 1 sampai 3 |
| `641:309` | `Lo-Fi — Pilih Kendaraan` | Frame Pilih Kendaraan + callout 4 sampai 6 |
| `641:310` | `Lo-Fi — Tinjau Pesanan` | Frame Tinjau Pesanan + callout 7 sampai 9 |
| `641:311` | `Lo-Fi — Anotasi` | Ringkasan anotasi 9 baris |

Active page terakhir: `Lo-Fi — Beranda`.

## 2. Frame dan node utama

- `658:308` — `Screen / Lo-Fi — Beranda`, 390 × 844. App bar `MobilJuragan` / `Merauke`, image placeholder dengan diagonal X, heading, empty state `Belum ada booking aktif`, label `Data contoh`, CTA `Pesan Mobil` full-width 358 × 56 px di y=524, bottom nav 4 tab dengan `Beranda` aktif.
- `659:308` — `Screen / Lo-Fi — Pilih Kendaraan`, 390 × 844. Back, filter icon, chips `Semua / MPV / SUV / Pickup`, 4 kartu dari dataset resmi, panel `5 kendaraan lainnya`, bottom nav dengan `Pesan` aktif.
- `660:308` — `Screen / Lo-Fi — Tinjau Pesanan`, 390 × 844. Back, edit icon, 4 card `Kendaraan / Jadwal / Opsi Rental / Data Pemesan`, banner tarif, CTA `Konfirmasi Booking` full-width 358 × 56 px di y=598, link `Kembali ubah data`, bottom nav dengan `Status` aktif.
- `674:308` — `Ringkasan Anotasi Lo-Fi`, 1800 × 1080. Tabel 9 baris Laws of UX, user-goal per layar, catatan integritas data.

## 3. Laws of UX dan distribusi callout

1. Jakob's Law — bottom nav Beranda.
2. Fitts's Law — CTA Pesan Mobil.
3. Law of Proximity — image + heading layanan.
4. Hick's Law — empat filter chips.
5. Miller + Chunking — satu kartu per kendaraan.
6. Law of Proximity — nama + plat.
7. Miller + Chunking — empat section pada Tinjau Pesanan.
8. Law of Proximity — pasangan label : nilai.
9. Fitts's Law — CTA Konfirmasi Booking.

## 4. Aturan yang dipatuhi

- Monokrom `#000`, `#4D4D4D`, `#B3B3B3`, `#E5E5E5`, `#FFFFFF`.
- Inter 12/14/20.
- Frame 390 × 844, margin 16 px.
- CTA full-width di area thumb.
- Tidak ada angka harga, rating, review, testimoni, atau data customer fiktif tanpa label.
- Tarif memakai `Tarif dikonfirmasi tim MobilJuragan` dan banner konfirmasi.
- Sembilan nama + plat mengikuti dataset resmi.

## 5. Evidence

- `lofi_blueprint.md` — blueprint, tabel anotasi, integritas data, dan checklist.
- `lofi_exports/01_beranda.png`, `02_pilih_kendaraan.png`, `03_tinjau_pesanan.png`, `04_ringkasan_anotasi.png` — screenshot bukti.
- Logbook: `D:\tugas kuliah\semester 3\grand-project-uiux-mobile-webframework-ai\docs\logbook\2026-09-07_M-ux_lofi-wireframe_Hylmi.md` (status `planned`).

## 6. Catatan teknis dan status berikutnya

- Pola `$fig` awalnya gagal menempel nested children; pola yang berhasil adalah `page.appendChild(frame)` lalu `frame.appendChild(child)` per node.
- Metadata halaman kosong sampai `setCurrentPageAsync(page)` dipanggil eksplisit saat verifikasi.
- Halaman anotasi dirapikan menjadi satu root frame `674:308` setelah teks top-level sempat terpisah.
- Belum dilakukan: upload submission ke LMS, review final di Figma desktop, dan pengubahan status logbook dari `planned` menjadi `done`.
