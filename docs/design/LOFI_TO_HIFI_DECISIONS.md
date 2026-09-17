# Lo-Fi → Hi-Fi Decision Log — MobilJuragan MVP

> **Status keseluruhan:** `hi-fi-applied` (Seluruh 13 Layar Hi-Fi dan 3 Journey Map diimplementasikan & disetujui pada Page `1006:92`)
> Tanggal pembaruan: 17/09/26 (Finalisasi Screen 01 Beranda, Row 3 Auth/Profile, dan sinkronisasi docs/figma-raw).
> Penulis: Hylmi.
> Tujuan: mendokumentasikan keputusan UX/UI dari Lo-Fi Wireframe hingga implementasi kanonik High-Fidelity di Figma dan artefak screenshot dokumentasi.

---

## 0. Definisi status

| Status | Arti |
|---|---|
| `needed to be validated by team` | Lo-Fi sudah jadi, tetapi keputusan UX belum final sampai tim melakukan usability review dan persetujuan bersama. |
| `reviewed-approved` | Tim telah memutuskan keputusan UX ini benar dan siap dibawa ke Hi-Fi. |
| `reviewed-rejected` | Tim menolak keputusan ini; perlu iterasi Lo-Fi ulang. |
| `hi-fi-applied` | Keputusan sudah dimasukkan ke Hi-Fi (screen Hi-Fi yang diperbarui). |

Status default untuk setiap keputusan di bawah ini adalah `needed to be validated by team`.

---

## 1. Ringkasan eksekusi

### 1.1 Batch 1 (07/09/26)

3 wireframe customer-facing di frame 390 × 844 monokrom:

- Beranda (`Lo-Fi — Beranda`, node `658:308`).
- Pilih Kendaraan (`Lo-Fi — Pilih Kendaraan`, node `659:308`).
- Tinjau Pesanan (`Lo-Fi — Tinjau Pesanan`, node `660:308`).

Ringkasan anotasi (`Lo-Fi — Anotasi`, node `655:358`) berisi 9 baris tabel dengan penomoran 1–9.

### 1.2 Batch 2 (09/09/26, prompt v2.1)

3 wireframe tambahan dengan 5 callout per layar, penomoran global 10–24:

- Detail Kendaraan (`Lo-Fi — Detail Kendaraan`, node `721:312`).
- Tanggal & Waktu (`Lo-Fi — Tanggal & Waktu`, node `722:308`).
- Opsi Rental (`Lo-Fi — Opsi Rental`, node `723:308`).

Ringkasan anotasi diperluas dengan 15 baris tambahan (10–24). Halaman anotasi sekarang menyimpan dua frame terpisah:

- `Ringkasan Anotasi Lo-Fi (Batch 1)` — node `748:308`, 9 baris.
### 1.3 Batch 3a (16/09/26)

2 wireframe customer-facing di frame 390 × 844 monokrom dengan masing-masing 5 callout Laws of UX pada page mandiri terpisah:

- Status Pesanan (`Lo-Fi — Status Pesanan`, node `1041:570`).
- Riwayat Pesanan (`Lo-Fi — Riwayat Pesanan`, node `1041:653`).

### 1.4 Status pengerjaan
 
| Batch / Row | Scope | Status Lo-Fi | Status Hi-Fi |
|---|---|---|---|
| Batch 1 | Beranda (1080:581), Pilih Kendaraan, Tinjau Pesanan | reviewed-approved | hi-fi-applied (`1006:92` baris 1: node `1080:581`, `1012:3`, `1012:7`) |
| Batch 2 | Detail Kendaraan, Tanggal & Waktu, Opsi Rental | reviewed-approved | hi-fi-applied (`1006:92` baris 1: node `1012:4`, `1012:5`, `1012:6`) |
| Batch 3 | Status Pesanan, Riwayat Pesanan | reviewed-approved | hi-fi-applied (`1006:92` baris 2: node `1045:968`, `1045:1028`) |
| Batch 4 | Pusat Bantuan, Buat Ticket, Chat Bantuan (AI Handoff) | reviewed-approved | hi-fi-applied (`1006:92` baris 2: node `1045:1076`, `1045:1129`, `1045:1167`) |
| Row 3 (17/09/26) | Masuk / Login, Profil Pengguna (SIM/KTP) | reviewed-approved | hi-fi-applied (`1006:92` baris 3: node `1071:1742`, `1071:1785`) |

---

## 2. Keputusan UX yang dipakai

Status: `needed to be validated by team` untuk semua keputusan di bawah ini.

### 2.1 Struktur frame mobile

| Keputusan | Layar | Rationale |
|---|---|---|
| Frame 390 × 844 px, margin 16 px | semua | Konsisten dengan canvas mobile Hi-Fi pada `MANIFEST.json`. |
| Monokrom 5 grayscale (`#000`, `#4D4D4D`, `#B3B3B3`, `#E5E5E5`, `#FFF`) | semua | Aturan tugas Lo-Fi dari prompt; BUKAN token production. Token production tetap navy/teal/gold pada `design-tokens.json`. |
| 1 family sans-serif (Inter) ukuran 12/14/20 | semua | Konsisten dengan token `design-tokens.json`. |
| Bottom nav 4 tab (Beranda/Pesan/Status/Bantuan) | Detail Kendaraan, Tanggal & Waktu, Opsi Rental | Tab `Pesan` aktif di tiga layar ini sesuai posisi user pada fase booking. |
| Tab aktif `Beranda` | Beranda | Entry point. |
| Tab aktif `Status` | Tinjau Pesanan | Layar yang memperkenalkan status booking dan stepper. |
| CTA full-width 358 × 56 px di area thumb | semua | Mengikuti aturan `DESIGN.md` §8 dan `design-tokens.json` `radius.lg = 12 px` untuk CTA. |

### 2.2 Callout per layar

Setiap layar Hi-Fi yang sudah memiliki Lo-Fi akan menerima 5 callout sesuai urutan v2.1 (Fitts → Hick → Jakob → Miller → Proximity). Catatan:

- Penomoran callout global hanya dipakai untuk dokumentasi dan tidak muncul di interface.
- Tiap callout menunjuk elemen nyata (bukan penjelasan generik).
- Tiap callout menyebutkan fase user journey atau pain point yang relevan (§8.7 di `CONTEXT_DUMP_semut_copilot_vscode_latest.md`).

### 2.3 Detail Kendaraan (Fase 4 journey "Apakah ini mobil yang benar?")

- Fitts: tombol `Pilih Tanggal` full-width.
- Hick: satu CTA utama + tombol back; tanpa link sekunder.
- Jakob: foto besar di atas, nama dan info di tengah, CTA di bawah.
- Miller: 3 kartu spesifikasi ringkas (Kapasitas/Transmisi/Tahun) dengan label jelas.
- Proximity: nama `AVANZA G PUTIH` dan `Plat PS1692B` di kolom kiri yang sama.

### 2.4 Tanggal & Waktu (Fase 5 journey "Apakah jadwal saya tersedia?")

- Fitts: tombol `Lanjutkan` full-width.
- Hick: daftar slot waktu ringkas (tidak semua jam).
- Jakob: kalender dengan header bulan, weekday, dan navigasi.
- Miller: grid 7 kolom per minggu, slot waktu dikelompokkan per hari.
- Proximity: label dan nilai `Waktu mulai`/`Durasi rental` di atas nilai masing-masing.
- Label `Data contoh` muncul di header dan di dekat legenda `tersedia` agar pelanggan tidak salah paham sebagai live availability.

### 2.5 Opsi Rental (Fase 6 journey "Mana yang sesuai kebutuhan dan syarat saya?")

- Fitts: tombol `Lanjutkan` full-width.
- Hick: hanya 2 opsi (`Driver`/`Self Drive`).
- Jakob: kartu pilihan dengan indikator radio familiar.
- Miller: judul + 2 baris keterangan singkat per opsi.
- Proximity: judul dan deskripsi dalam satu kartu; jarak antar kartu lebih besar dari jarak isi di dalam kartu.

### 2.6 Status Pesanan (Fase 9 journey "Bagaimana status pesanan saya?")

- Hick: Pembatasan aksi layar hanya 1 CTA utama tanpa tautan sekunder yang membingungkan.
- Miller: Pemecahan informasi menjadi kartu Ringkasan Booking dan kartu Stepper Progres.
- Jakob: Pola linimasa tahapan status vertikal (4 fase) dan bottom nav 4 tab yang familiar.
- Proximity: Kedekatan status chip 'Menunggu Konfirmasi' tepat di bawah judul status booking.
- Fitts: Tombol Hubungi Bantuan full-width 358 × 56 px pada ergonomic thumb zone di bagian bawah layar.

### 2.7 Riwayat Pesanan (Daftar booking aktif dan lampau)

- Hick: Filter segmented control 2 tab (`Aktif` vs `Selesai`) menyederhanakan pemilahan data.
- Miller: Pemisahan kartu Pesanan Berjalan dengan kartu riwayat selesai dalam chunk visual mandiri.
- Proximity: Pengelompokan status badge, referensi order, nama armada, dan plat dalam satu bingkai kartu transaksi.
- Jakob: Layout kartu riwayat transaksi dan panel representasi empty state yang lazim pada aplikasi mobile.
- Fitts: Tombol Pesan Mobil Baru full-width 358 × 56 px di area thumb zone.

### 2.8 Pusat Bantuan (Layanan FAQ, pelaporan kendala, & tiket support)

- Hick: Input pencarian prediktif di bagian atas memangkas waktu keputusan pencarian tanpa harus memilah puluhan artikel manual.
- Miller: Chunking informasi kendala ke dalam 3 rumpun kategori utama (Booking, Pembayaran, Armada) untuk menjaga batas beban kognitif.
- Jakob: Pola accordion FAQ standar industri aplikasi transportasi dan tiket aktif dengan status proses yang umum dipahami.
- Proximity: Kedekatan badge 'Dalam Proses', nomor ID tiket (#TCK-1042), judul kendala, dan balasan CS dalam satu kartu kesatuan.
- Fitts: Tombol aksi '+ Buat Ticket Bantuan Baru' full-width 358 × 50 px di area thumb zone untuk kemudahan akses cepat saat pengguna membutuhkan pertolongan.

### 2.9 Chat Bantuan (Ticket Chat & penanganan komunikasi kendala armada via AI Handoff)

- Jakob: Pola antarmuka percakapan pesan instan standar (konteks tiket di atas, navigasi kembali, dan identitas penanganan jelas) memudahkan pengguna langsung berinteraksi tanpa belajar ulang.
- Proximity: Balon pesan, nama pengirim, status centang, dan waktu dikelompokkan secara rapat dalam satu kluster visual; spasi vertikal antarpesan membedakan giliran bicara secara intuitif.
- Miller: Chunking transisi AI Chatbot ke Admin Manusia dipisahkan ke dalam segmen visual jelas (respon bot awal, divider transisi sistem, dan balasan staf operasional yang mengambil alih tiket) sesuai arsitektur handoff.
- Hick: Komposer balasan difokuskan pada satu aksi utama (bidang input teks dan satu tombol kirim cepat) tanpa tombol samping yang membingungkan.
- Fitts: Area input komposer selebar layar dan tombol kirim 56 × 44 px ditempatkan di zona jangkauan ibu jari (thumb zone) bagian bawah.

### 2.10 Buat Ticket Bantuan (Formulir pengajuan kendala sebelum masuk ke chat)

- Jakob: Konvensi formulir pengaduan helpdesk standar (Judul, Kategori Dropdown/Chips, Nomor Booking Terkait, dan Detail Masalah) sehingga pengguna langsung paham alur pengisian.
- Hick: Penyederhanaan opsi jenis bantuan menjadi 3 kategori terstandarisasi (`Pertanyaan`, `Keluhan`, `Lainnya`) memangkas keraguan pengambilan keputusan.
- Proximity: Kedekatan rapat label di atas setiap bidang isian dan helper text tepat di bawahnya; jeda antar-field diberi jarak 20 px untuk menegaskan batas antardata.
- Miller: Chunking formulir menjadi 4 field esensial plus notice box alur AI Assistant untuk menjaga beban kognitif di bawah 7 item saat pengguna menghadapi kendala di lapangan.
- Fitts: Tombol submit 'Kirim Ticket & Buka Chat →' selebar 358 × 52 px diletakkan di thumb zone bawah dengan kontras penuh.

### 2.11 Ringkasan anotasi

- Frame `Ringkasan Anotasi Lo-Fi (Batch 1 + Batch 2)` (`674:308`) dipakai untuk dokumentasi utama.
- Frame `Ringkasan Anotasi Lo-Fi (Batch 1)` (`748:308`) dipakai untuk review Batch 1 saja.
- Tabel heading tidak diedit.
- Baris 1–9 lama tidak dipindahkan; baris 10–24 disisipkan tanpa menggantikan baris apapun.

---

## 3. Keputusan UX yang masih menunggu review

Berikut keputusan yang perlu dikonfirmasi tim sebelum dianggap final:

1. **Distribusi Hukum per layar**: apakah urutan Fitts → Hick → Jakob → Miller → Proximity sudah cukup merepresentasikan prioritas tiap fase journey? Pertanyaan usability §8.10 yang belum terjawab akan ditutup oleh Batch 3 dan Batch 4.
2. **Empty/loading/error state untuk Batch 1 dan Batch 2**: belum ada state eksplisit, hanya label `Data contoh`. Status eksplisit `Belum ada mobil tersedia untuk tanggal ini. Coba tanggal lain.` baru ada di prompt sebagai rujukan, belum digambar di wireframe.
3. **Aktif tab bottom nav pada layar booking**: tab `Pesan` aktif di Detail Kendaraan, Tanggal & Waktu, Opsi Rental mengikuti kontinuitas flow. Apakah konsisten dengan ekspektasi tim? Atau perlu diuji dengan usability test.
4. **Kalender dengan label `Data contoh` di header dan legenda**: pendekatan defensif. Apakah label cukup terlihat, atau perlu label tambahan di grid tanggal?
5. **Banner tarif copy `Tarif akan dikonfirmasi tim MobilJuragan setelah pengajuan.`** pada Tinjau Pesanan mengikuti aturan `DESIGN.md` §10. Apakah copy ini cukup untuk menjawab risiko fase 8 journey?

---

## 4. Hal yang secara eksplisit TIDAK dibawa ke Hi-Fi

Daftar keputusan visual Lo-Fi yang hanya berlaku untuk tugas kuliah, bukan production:

| Item | Alasan |
|---|---|
| Palette monokrom 5 grayscale | Aturan tugas Lo-Fi dari prompt. Production menggunakan navy/teal/gold. |
| Font Inter 12/14/20 | Dipakai di Lo-Fi untuk konsistensi. Production menggunakan Inter dengan scale yang lebih lengkap (12/14/16/20/24/32). |
| Image placeholder dengan diagonal X | Aturan Lo-Fi untuk menunjukkan placeholder, bukan foto final. |
| Baris `5 kendaraan lainnya` (panel affordance) di Pilih Kendaraan | Hanya untuk Lo-Fi guna menunjukkan daftar lengkap 9 dataset tanpa scroll. Hi-Fi dapat memakai pagination atau filter nyata. |
| Tab aktif `Pesan`/`Status` di booking flow | Lo-Fi mengikuti kontinuitas; Hi-Fi mengikuti keputusan navigasi tim setelah usability test. |

---

## 5. Hal yang perlu dibawa ke Hi-Fi setelah validasi

Setelah status berubah menjadi `reviewed-approved`, keputusan-keputusan di bagian §2 dapat diterjemahkan ke Hi-Fi sebagai berikut:

| Keputusan Lo-Fi | Implementasi Hi-Fi yang diharapkan |
|---|---|
| CTA full-width 358 × 56 px di area thumb | Tetap pada Hi-Fi dengan warna token production (navy `#1E3A5F`). |
| 3 kartu spesifikasi di Detail Kendaraan | Menjadi `Vehicle Specs` dengan icon dan label kategori. |
| Grid kalender 7 kolom dengan header bulan/weekday/navigasi | Tetap pada Hi-Fi dengan token production (label 12 px slate, header 14 px). |
| 2 kartu opsi Driver/Self Drive | Menjadi `Rental Options` dengan status `selected`/`default`. |
| Bottom nav 4 tab Beranda/Pesan/Status/Bantuan | Tetap; aktifkan sesuai posisi user. |

---

## 6. Yang akan diperbarui setelah status `reviewed-approved`

Dokumen yang akan mengikuti Lo-Fi saat status diubah tim:

1. `docs/ia/MobilJuragan_IA_dan_User_Flow.docx` — tambahkan lampiran "Lo-Fi validated UX".
2. `docs/ia/Penjelasan_Naratif_IA_dan_User_Flow_MobilJuragan.docx` — narasikan Lo-Fi untuk tiap fase.
3. `docs/MANIFEST.json` — tambahkan namespace `lofi_batch_1`, `lofi_batch_2` setelah struktur stabil.
4. `docs/design/DESIGN.md` — tambahkan section "Catatan keputusan UX dari Lo-Fi" jika ada perubahan desain yang perlu masuk ke rulebook.
5. `docs/design-tokens.json` — tetap tidak diubah sampai Hi-Fi benar-benar diperbarui.
6. Figma Hi-Fi: implementasi ulang screen-screen yang ditandai `reviewed-approved`.

---

## 7. Yang TIDAK boleh dilakukan saat status `needed to be validated by team`

- Jangan klaim `done` di logbook sampai reviewer menandatangani.
- Jangan menimpa screenshot Hi-Fi pada `docs/figma-raw/`.
- Jangan mengubah `design-tokens.json` berdasarkan grayscale Lo-Fi.
- Jangan menghapus atau memindahkan wireframe Lo-Fi sebelum status berubah.
- Jangan menamai ulang page Figma Lo-Fi (prefix `Lo-Fi — ` wajib dipertahankan).

---

## 8. Riwayat perubahan decision log

| Tanggal | Perubahan | Penulis |
|---|---|---|
| 10/09/26 | Pembuatan awal dokumen. Status semua keputusan Lo-Fi = `needed to be validated by team`. | Hylmi |
| 16/09/26 | Implementasi Hi-Fi Batch 3 (Status Pesanan, Riwayat) & Batch 4 (Pusat Bantuan, Buat Ticket, Chat AI Handoff) ke canvas utama `1006:92` baris 2. Status diubah menjadi `hi-fi-applied`. | Hylmi |
| 17/09/26 | Redesign Screen 01 (Beranda, `1080:581`) disetujui (Masterpiece executive layout: hero card proporsional, eliminasi tombol ganda, visual hierarchy bersih). Implementasi Row 3 (Screen 12 Login & Screen 13 Profile SIM/KTP) serta ekspor penuh 2x screenshot ke `docs/figma-raw/` dan `docs/figma-raw/mobile/`. | Hylmi |

---

## 9. Implementasi Hi-Fi Batch 3 & Batch 4 (Page `1006:92`)

Pada tanggal 16/09/26, seluruh 5 alur layar pasca-pemesanan dan penanganan bantuan pelanggan resmi diimplementasikan ke dalam format High-Fidelity pada Figma page `Hi-Fi — MobilJuragan (SandBox Antigravity)` (node ID `1006:92`) pada baris kedua (y: 1350) lengkap dengan Section Header (y: 1260) dan Journey Map baris kedua (y: 2240).

### 9.1 Inventaris Node Hi-Fi Baris 2

| No | Nama Screen Hi-Fi | Node ID | Posisi (x, y) | Dimensi | Karakteristik Visual Utama |
|---|---|---|---|---|---|
| 07 | `07 / Hi-Fi : Status Pesanan` | `1045:968` | x: 0, y: 1350 | 390 × 844 px | Stepper 4 tahap `#0e7c7b`/`#1d4ed8`, armada Avanza Putih `PS1692B`, badge `Menunggu Konfirmasi` `#fef3c7`, bottom nav tab Status aktif. |
| 08 | `08 / Hi-Fi : Riwayat Pesanan` | `1045:1028` | x: 440, y: 1350 | 390 × 844 px | Segmented control `Aktif (1)` vs `Selesai (0)`, empty state card dengan icon riwayat selesai, banner booking baru. |
| 09 | `09 / Hi-Fi : Pusat Bantuan` | `1045:1076` | x: 880, y: 1350 | 390 × 844 px | Search box, 3 chip kategori (`Booking` aktif `#0e7c7b`), FAQ accordion, card tiket aktif `#TCK-1042` (`Dalam Proses`), bottom nav tab Bantuan aktif. |
| 10 | `10 / Hi-Fi : Buat Ticket` | `1045:1129` | x: 1320, y: 1350 | 390 × 844 px | Form input terstruktur: judul, chip `Keluhan` aktif, referensi `#BK-5521`, textarea detail, AI disclosure box `#e6f4f1`, CTA submit 342 × 52 px `#1e3a5f`. |
| 11 | `11 / Hi-Fi : Chat Bantuan - AI Handoff` | `1045:1167` | x: 1760, y: 1350 | 390 × 844 px | Sticky header ticket, stream chat transparan: bubble customer (`#e6f4f1`) → AI Bot reply (`#ffffff`) → System Event Divider (`#0e7c7b`) → Staf CS Manusia (`#0e7c7b` border) → customer akui, input composer fixed. |
| JM | `Journey Map & Laws of UX (Row 2)` | `1045:1208` | x: 0, y: 2240 | 2160 × 320 px | 5 kartu fase hukum UX (Feedback Loop, Jakob/Miller, Hick/Search, Expectation Setting, Human Fallback & Fail-soft) + Box Data Integrity. |

### 9.2 Arsitektur AI Chatbot to Human Handoff (Screen 11)

Berdasarkan `docs/TECH_PLANNING_AI_CHATBOT_HANDOFF_EDGE_CASES.md`:
1. **Transparansi Peran**: Pengguna selalu diberi tahu siapa yang berbicara (label robot `🤖 AI Assistant MobilJuragan` vs avatar staf `CS MobilJuragan (Staf Merauke)`).
2. **System Event Divider**: Transisi kepemilikan percakapan ditandai garis penanda eksplisit (`── AI mengalihkan ke Admin (Alasan: Penjemputan Lapangan) • 08:46 WIT ──`) sehingga pengguna tidak terjebak kebingungan apakah masih berbicara dengan bot.
3. **Fail-Soft & SLA**: Tiket `#TCK-1042` tertaut langsung ke data booking `#BK-5521` untuk menjamin kesinambungan konteks tanpa meminta pelanggan mengulang keluhan.

---

## 10. Redesign Kanonik Screen 01 Beranda (`1080:581`)

Pada tanggal 17/09/26, layar Beranda direkonstruksi total menjadi tata letak proporsional yang elegan dan profesional sesuai arahan user review:

### 10.1 Perubahan Desain Utama
1. **Single Primary CTA**: Menghilangkan tombol mini "Sewa" ganda di kartu reservasi yang membingungkan alur kognitif. Layar kini hanya memiliki satu CTA primer di bagian bawah (`Pesan Mobil Sekarang →`, 350 × 52 px) dengan microcopy jaminan ("Tanpa biaya tersembunyi • Konfirmasi instan via WhatsApp").
2. **Kartu Hero Armada Terpadu (350 × 248 px, r:16)**:
   - Header kartu: Badge `TERPOPULER DI MERAUKE` (Teal `#0E7C7B`) dan Plat nomor `PA 1692 B` (Navy pill `#1E3A5F`).
   - Judul armada: `Toyota New Avanza 1.3 G` dengan spesifikasi ringkas (7 Kursi • Manual • 2023).
   - Render foto armada beresolusi tajam ($260 \times 105$ px, radius 10 px) dari referensi resmi.
   - 3 Opsi pill sewa (`Lepas Kunci` aktif teal, `Dengan Sopir`, `Antar Bandara`) yang intuitif dan terbebas dari distorsi visual.
3. **Penyederhanaan Komponen**:
   - Menghilangkan kapsul search melayang yang membebani ruang vertikal.
   - Menghilangkan bayangan oval sintetis abu-abu di bawah roda mobil.
   - Kartu Status Reservasi ($350 \times 80$ px) dibuat rapi dengan status jujur ("Belum ada rental berjalan") dan icon avatar MJ.
   - Kartu Jaminan Layanan ($350 \times 64$ px) dengan tanda centang `✓` dan info pengantaran gratis ke Bandara Mopah Merauke.
4. **Audit Anti-Slop**: 0 em dashes (`—`), 0 teks terpotong/overflow, kontras WCAG AA/AAA terpenuhi, tata letak seimbang dan proporsional.

---

## 11. Implementasi Hi-Fi Row 3: Auth, Identitas, & Profil Pelanggan

Row 3 ditempatkan pada ordinat $y = 2750$ px pada halaman `1006:92` dengan Section Header ($y = 2660$) dan Journey Map Row 3 ($y = 3650$).

### 11.1 Inventaris Node Hi-Fi Baris 3

| No | Nama Screen Hi-Fi | Node ID | Posisi (x, y) | Dimensi | Karakteristik Visual Utama |
|---|---|---|---|---|---|
| 12 | `12 / Hi-Fi : Masuk / Login` | `1071:1742` | x: 0, y: 2750 | 390 × 844 px | Input nomor HP Indonesia (`+62`), tombol kirim OTP WhatsApp, ilustrasi keamanan data KYC, reassurance microcopy. |
| 13 | `13 / Hi-Fi : Profil Pengguna` | `1071:1785` | x: 440, y: 2750 | 390 × 844 px | Kode pelanggan unik `customerCode`, status badge verifikasi SIM A & KTP (`Terverifikasi`), menu riwayat transaksi, dan kontak darurat. |
| JM | `Journey Map & Laws of UX (Row 3)` | `1071:1859` | x: 0, y: 3650 | 1320 × 320 px | 3 fase hukum UX (Hick's Law pada OTP, Jakob's Law pada profil & verifikasi identitas, Fitts's Law pada CTA aksi profil). |


