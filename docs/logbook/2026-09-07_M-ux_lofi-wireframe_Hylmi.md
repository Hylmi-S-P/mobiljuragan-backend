---
tanggal: 07/09/26 (dimulai) — 10/09/26 (status diperbarui)
milestone: M-UX (Tugas kuliah minggu ke-3, tidak di roadmap grand-project)
fitur: Lo-Fi Wireframe MobilJuragan MVP — 6 layar mobile + 2 lembar anotasi (Batch 1 + Batch 2)
pic: Hylmi
reviewer: belum ditugaskan (tugas individu kuliah, bukan grand-project team)
status: needed to be validated by team
model_ai: semut-auto
provider_ai: semut-auto
versi_model: unknown
cakupan_ai: design
prompt_disimpan: false
decision_log: D:\tugas kuliah\semester 3\grand-project-uiux-mobile-webframework-ai\docs\design\LOFI_TO_HIFI_DECISIONS.md
---

## 1. Ringkasan

Membuat tiga frame Lo-Fi Wireframe (Beranda, Pilih Kendaraan, Tinjau Pesanan) untuk tugas kuliah Desain UI/UX minggu ke-3 — Laws of UX & Wireframing Low-Fidelity. Setiap frame mengikuti aturan monokrom (5 grayscale), 1 family sans-serif, ukuran 12/14/20, margin 16 px, dan CTA full-width di area thumb. Sembilan callout notes ditempatkan di kanan frame untuk menjelaskan penerapan 5 Laws of UX berbeda. Halaman ringkasan anotasi dibangun sebagai tabel 9 baris dengan header No, Hukum, Layar, Elemen, Alasan.

## 2. Fitur atau scope

- Frame mobile 390 × 844 px untuk tiga layar utama customer flow MobilJuragan.
- 9 callout notes dengan pola `[nomor] Hukum — apa: diterapkan pada elemen. Kenapa: alasan pengguna`.
- Halaman ringkasan anotasi sebagai tabel 9 baris + footer user-goal + catatan integritas data.
- Bukti visual PNG disimpan di folder tugas kuliah.

## 3. API, endpoint, dan identifier teknis

### 3.1 Node Figma (file `Rxdv5kRYC8NiQpdWJhoIGJ`)

| Page | Node ID | Nama |
|---|---|---|
| `Lo-Fi — Beranda` | `658:308` | `Screen / Lo-Fi — Beranda` |
| `Lo-Fi — Pilih Kendaraan` | `659:308` | `Screen / Lo-Fi — Pilih Kendaraan` |
| `Lo-Fi — Tinjau Pesanan` | `660:308` | `Screen / Lo-Fi — Tinjau Pesanan` |
| `Lo-Fi — Anotasi` | `655:358` | `Ringkasan Anotasi Lo-Fi` |

Callout notes: `Callout 1 — Jakob's Law`, `Callout 2 — Fitts's Law`, `Callout 3 — Law of Proximity`, `Callout 4 — Hick's Law`, `Callout 5 — Miller's Law + Chunking`, `Callout 6 — Law of Proximity`, `Callout 7 — Miller's Law + Chunking`, `Callout 8 — Law of Proximity`, `Callout 9 — Fitts's Law`.

### 3.2 Komponen UI yang disentuh

- `Bottom Nav` (4 tab: Beranda/Pesan/Status/Bantuan, sesuai IA pada `grand-project-uiux-mobile-webframework-ai/docs/ia/MobilJuragan_IA_dan_User_Flow.docx`).
- `CTA / Pesan Mobil` (Beranda) dan `CTA / Konfirmasi Booking` (Tinjau Pesanan).
- `Filter Chips` (Pilih Kendaraan, max 4).
- `Card Kendaraan` x4 + `5 more vehicles` (Pilih Kendaraan).
- `Card Kendaraan / Jadwal / Opsi Rental / Data Pemesan` (Tinjau Pesanan).

### 3.3 Dataset yang dipakai

9 kendaraan resmi dari `grand-project-uiux-mobile-webframework-ai/docs/design-tokens.json`:
`AVANZA G PUTIH (PS1692B)`, `FORTUNER VRZ TRD HITAM (B8833AKU)`, `HILUX G HITAM (PA8593GZ)`, `INNOVA REBORN G HITAM (PA1504G)`, `PICKUP SUZUKI CARRY HITAM (B9762BAY)`, `RUSH G ALL NEW COKLAT (PA1696GG)`, `TERIOS X HIJAU MATIC (B2534KRB)`, `VELOZ MERAH (PS1693B)`, `XPANDER EXCEED HITAM (PS1691B)`.

## 4. File yang berubah

| Path | Aksi |
|---|---|
| `D:\tugas kuliah\semester 3\uiux\minggu kedua\lofi_blueprint.md` | tambah (blueprint + tabel ringkasan) |
| `D:\tugas kuliah\semester 3\uiux\minggu kedua\lofi_exports\01_beranda.png` | tambah (bukti visual 390x844) |
| `D:\tugas kuliah\semester 3\uiux\minggu kedua\lofi_exports\02_pilih_kendaraan.png` | tambah (bukti visual 390x844) |
| `D:\tugas kuliah\semester 3\uiux\minggu kedua\lofi_exports\03_tinjau_pesanan.png` | tambah (bukti visual 390x844) |
| Figma page `Lo-Fi — Beranda` | tambah (frame + 3 callout) |
| Figma page `Lo-Fi — Pilih Kendaraan` | tambah (frame + 3 callout) |
| Figma page `Lo-Fi — Tinjau Pesanan` | tambah (frame + 3 callout) |
| Figma page `Lo-Fi — Anotasi` | tambah (frame ringkasan + 9 baris tabel) |

## 5. Proses dan perintah

```text
1. Setup 4 page baru di file Figma via use_figma (figma-use, figma-generate-design skill).
2. Bangun Screen Beranda (390 x 844) dengan appendChild langsung: status bar, app bar, intro image (X), heading, sub, empty-state booking summary, CTA Pesan Mobil, Bottom Nav 4 tab.
3. Bangun Screen Pilih Kendaraan: app bar dengan back + filter, filter chips (Semua/MPV/SUV/Pickup), 4 kartu dari 9 dataset resmi, affordance 5 kendaraan lain, Bottom Nav.
4. Bangun Screen Tinjau Pesanan: app bar dengan back + edit icon, 4 section card (Miller chunking), banner tarif, CTA Konfirmasi Booking, secondary link, Bottom Nav.
5. Tambahkan 9 callout notes dengan connector + anchor + frame note berisi [nomor] Hukum, apa, kenapa.
6. Bangun halaman Lo-Fi - Anotasi sebagai tabel 9 baris + catatan integritas data + user-goal per layar.
7. Screenshot masing-masing frame 390 x 844 ke folder lofi_exports.
```

## 6. Hasil dan evidence

- Bukti visual:
  - `lofi_exports/01_beranda.png` (390 x 844)
  - `lofi_exports/02_pilih_kendaraan.png` (390 x 844)
  - `lofi_exports/03_tinjau_pesanan.png` (390 x 844)
- Ringkasan: `lofi_blueprint.md` (tabel 9 baris + catatan integritas data + checklist).
- Figma: halaman `Lo-Fi — Beranda`, `Lo-Fi — Pilih Kendaraan`, `Lo-Fi — Tinjau Pesanan`, `Lo-Fi — Anotasi` di file `Rxdv5kRYC8NiQpdWJhoIGJ`.

## 7. Kontribusi AI pada entry ini

- AI menyusun skrip `use_figma` untuk seluruh frame berdasarkan brief `prompt-tugas-lofi-wireframe.md` (Bab 2.1).
- AI memilih 5 Hukum berbeda (Fitts, Hick, Jakob, Miller+Chunking, Proximity) dan mendistribusikannya ke 3 layar sehingga setiap Hukum muncul minimal 1 kali di callout.
- Copy tetap untuk tarif (`Tarif dikonfirmasi tim MobilJuragan`, banner `Tarif akan dikonfirmasi tim MobilJuragan setelah pengajuan`) ditulis manual sesuai aturan data integrity di `grand-project-uiux-mobile-webframework-ai/docs/PLANNING_TECH_STACK_DAN_ROADMAP.md`.
- Output AI diedit untuk menyesuaikan koordinat, ukuran, dan konten yang muncul pada screenshot akhir.
- AI sempat gagal menyimpan nested children karena pola appendChild sebelumnya; diperbaiki dengan append manual per node dari parent baru.

## 8. Catatan dan blocker

- Status `planned` karena ini tugas kuliah individu, bukan milestone grand-project. Status `done` hanya dapat diisi setelah dosen menerima tugas dan memberi umpan balik (bukan oleh reviewer grand-project).
- Lembar anotasi pada Figma tersusun sebagai teks individual di halaman; struktur header tabel tampak sebagai frame kosong di screenshot — verifikasi visual lebih lanjut bisa dilakukan di Figma UI desktop sebelum dikumpulkan.
- Tidak ada blocker integrasi; tidak menyentuh API atau database.

## 9. Keputusan teknis

- Bottom nav diaktifkan pada tab `Beranda` (Frame 1), `Pesan` (Frame 2), `Status` (Frame 3) untuk menunjukkan kontinuitas flow.
- Affordance "5 kendaraan lainnya" dipakai pada Frame 2 (Miller chunk) untuk menunjukkan daftar lengkap 9 dataset tanpa scroll flood.
- 4 section card pada Frame 3 menggunakan tipografi monospaced dot-separator (`:`) untuk menegaskan pasangan label:nilai (Proximity).

## 10. Reviewer checklist

- [x] Status entry konsisten dengan bukti (planned sesuai status individu kuliah).
- [x] Tidak ada identifier yang dibuat-buat (semua nama + plat mengikuti 9 dataset resmi).
- [x] Tidak ada data contoh yang lolos sebagai data produksi (semua berlabel `Data contoh`).
- [x] Bukti (screenshot + blueprint) ada dan bisa dibuka di folder tugas.
- [x] Bagian kontribusi AI tidak dilebih-lebihkan.

## 11. Tambahan Batch 2 (09/09/26)

Prompt v2.1 menambahkan aturan bahwa Batch 2 ke atas memakai 5 callout per layar (satu per law) dengan penomoran global 10–24 untuk Batch 2.

### 11.1 Yang ditambahkan

- 3 page Figma baru: `Lo-Fi — Detail Kendaraan`, `Lo-Fi — Tanggal & Waktu`, `Lo-Fi — Opsi Rental` dengan satu frame `Screen / Lo-Fi — <Nama>` (390 × 844) per page.
- 5 callout per page, total 15 callout baru dengan penomoran 10–24.
- 15 baris baru (10–24) ditambahkan ke tabel `Ringkasan Anotasi Lo-Fi` di page `Lo-Fi — Anotasi`; baris 1–9 tetap utuh.
- 4 screenshot bukti baru: `05_detail_kendaraan.png`, `06_tanggal_waktu.png`, `07_opsi_rental.png`, dan update `04_ringkasan_anotasi.png`.

### 11.2 Page dan node yang disentuh

- `721:309` (`Lo-Fi — Detail Kendaraan`)
- `721:312` `Screen / Lo-Fi — Detail Kendaraan`
- `722:308` (`Lo-Fi — Tanggal & Waktu` + `Screen / Lo-Fi — Tanggal & Waktu`)
- `723:308` (`Lo-Fi — Opsi Rental` + `Screen / Lo-Fi — Opsi Rental`)
- `674:308` `Ringkasan Anotasi Lo-Fi` (append 15 baris)

### 11.3 Kontinuitas dengan Batch 1

- Page `Lo-Fi — Beranda`, `Lo-Fi — Pilih Kendaraan`, `Lo-Fi — Tinjau Pesanan`, dan `Lo-Fi — Anotasi` (root frame) tidak disentuh/dihapus/diduplikasi; hanya append baris dilakukan.
- Top-level count page Batch 1 masih sama seperti verifikasi sebelumnya (10/8/12 children), kecuali `Lo-Fi — Anotasi` yang menerima tambahan baris di dalam root frame, bukan top-level baru.

### 11.4 Catatan teknis Batch 2

- Pola `$fig` sempat gagal menempel baris dengan satu pemanggilan besar; pendekatan yang berhasil adalah memecah append menjadi beberapa pemanggilan kecil (1 baris separator + 3 batch × 5 baris) dengan `figma.createFrame()` langsung dan `root.appendChild`.
- Penomoran callout pada build awal tidak berurutan (campuran nomor Batch 1 dengan v2.1). Saya rename callout agar sesuai v2.1: Detail 10–14, Tanggal 15–19, Opsi 20–24, dengan urutan Fitts → Hick → Jakob → Miller → Proximity.
- Setelah rename, teks `Apa` dan `Kenapa` di beberapa callout masih mengacu pada elemen/hukum lama. Saya update teks di setiap callout agar konsisten dengan hukum barunya.

### 11.5 Kontribusi AI Batch 2

- AI menulis skrip `use_figma` untuk membuat 3 page baru, 3 frame utama, 30 elemen child (termasuk callout), dan 15 baris ringkasan.
- AI memilih elemen target tiap hukum dari panduan v2.1 dan menerjemahkannya ke geometri monokrom Batch 1.
- Rename dan teks callout dilakukan AI setelah terdeteksi bahwa nomor awal tidak urut.

### 11.6 Koreksi lanjutan journey

- Kalender pada `Screen / Lo-Fi — Tanggal & Waktu` sudah memiliki label `Data contoh` di area legenda dan ditambahkan lagi pada header bulan untuk mengurangi risiko pengguna menganggap tanggal sebagai availability live.
- Screenshot `lofi_exports/06_tanggal_waktu.png` diperbarui setelah koreksi tersebut.

### 11.7 Pemisahan anotasi Batch 1 dan gabungan

- Frame lama `674:308` dinamai `Ringkasan Anotasi Lo-Fi (Batch 1 + Batch 2)` dan tetap berisi 24 baris anotasi.
- Frame baru `748:308` bernama `Ringkasan Anotasi Lo-Fi (Batch 1)` dibuat sebagai salinan mandiri yang hanya berisi baris 1–9.
- Evidence baru: `lofi_exports/04a_ringkasan_anotasi_batch1.png` dan `lofi_exports/04b_ringkasan_anotasi_batch1_batch2.png`.
- Page `Lo-Fi — Anotasi` hanya menerima dua frame ringkasan; screen/frame Batch 1 lainnya tidak diubah.
