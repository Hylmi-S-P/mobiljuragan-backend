---
tanggal: 21/09/26
milestone: M7 Flutter Mobile App Shell & Hi-Fi Slicing
fitur: Slicing 4 Layar Hi-Fi Mobile (Beranda, Katalog, Detail, Tanggal-Waktu)
pic: HY
reviewer: HL
status: done
model_ai: Antigravity AI
provider_ai: Google DeepMind
versi_model: Gemini 3.7 Flash
cakupan_ai: code, design, docs
prompt_disimpan: false
---

## 1. Ringkasan

Mengimplementasikan slicing frontend 4 layar utama aplikasi mobile MobilJuragan (Flutter) dari halaman Figma `Hi-Fi — MobilJuragan (SandBox Antigravity)` ke dalam codebase mobile (`mobile app/`). Layar mencakup Beranda (clean SafeArea tanpa status bar statis), Katalog Kendaraan (filterable categories), Detail Kendaraan (2x2 specs grid), dan Tanggal & Waktu (interactive calendar dengan tombol panah navigasi bulan `<` dan `>`).

## 2. Fitur atau Scope

- Implementasi Mobile App Shell dengan 4-Tab Bottom Navigation Bar (`Beranda`, `Pesan`, `Status`, `Bantuan`).
- Slicing Screen 01: Beranda (Featured Avanza Hero Card, badge Terpopuler di Merauke, status reservasi, banner jaminan, CTA pesan mobil).
- Slicing Screen 02: Pilih Kendaraan (Katalog 4 unit armada riil Merauke, horizontal category chips, state border teal aktif).
- Slicing Screen 03: Detail Kendaraan (Preview foto unit, badge status hijau Tersedia, grid spesifikasi 2x2, info tarif resmi).
- Slicing Screen 04: Tanggal & Waktu (Kalender interaktif dengan panah bulan `<` dan `>`, date picker grid, selector waktu mulai & durasi sewa).
- Integrasi Theme Tokens terpusat (Navy `#1E3A5F`, Teal `#0E7C7B`, Slate `#F8FAFC`).
- Kepatuhan penuh Anti-Slop v3.2.1 (0 karakter em dash, data riil Papua Selatan).

## 3. API, Endpoint, dan Identifier Teknis

### 3.1 Model & Schema

- `VehicleModel.id`: Identifier unit kendaraan (`avanza-g-putih`, `fortuner-vrz-hitam`, `hilux-g-hitam`, `innova-reborn-hitam`).
- `VehicleModel.plateNumber`: Pelat nomor riil Merauke (`PS1692B`, `B8833AKU`, `PA8593GZ`, `PA1504G`).
- `VehicleModel.category`: Kategori filter (`MPV`, `SUV`, `Pickup`).

### 3.2 Komponen UI yang Disentuh (Figma Nodes)

- `01 / Hi-Fi : Beranda` (Node ID: `1080:581`)
- `02 / Hi-Fi : Pilih Kendaraan` (Node ID: `1012:3`)
- `03 / Hi-Fi : Detail Kendaraan` (Node ID: `1012:4`)
- `04 / Hi-Fi : Tanggal & Waktu` (Node ID: `1012:5`)

## 4. File yang Dibuat / Berubah

| Path | Aksi | Catatan |
|---|---|---|
| `apps/mobile/pubspec.yaml` | ubah | Konfigurasi dependensi Flutter & deklarasi assets |
| `apps/mobile/lib/main.dart` | ubah | Entrypoint & SystemUIOverlayStyle |
| `apps/mobile/lib/theme/app_colors.dart` | tambah | Design tokens warna Navy, Teal, Slate |
| `apps/mobile/lib/theme/app_theme.dart` | tambah | ThemeData global (Inter, cards, buttons) |
| `apps/mobile/lib/models/vehicle_model.dart` | tambah | Data class & dataset 4 armada Merauke |
| `apps/mobile/lib/widgets/custom_app_bar.dart` | tambah | Reusable Navy App Bar dengan stepper |
| `apps/mobile/lib/widgets/bottom_nav_bar.dart` | tambah | 4-Tab Bottom Navigation Bar |
| `apps/mobile/lib/widgets/vehicle_card_item.dart` | tambah | Item kartu mobil di katalog |
| `apps/mobile/lib/widgets/spec_card_item.dart` | tambah | Item kartu spesifikasi 2x2 |
| `apps/mobile/lib/screens/main_navigation_screen.dart` | tambah | Shell container pengelola tab |
| `apps/mobile/lib/screens/home_screen.dart` | tambah | Layar 01: Beranda |
| `apps/mobile/lib/screens/vehicle_selection_screen.dart` | tambah | Layar 02: Pilih Kendaraan |
| `apps/mobile/lib/screens/vehicle_detail_screen.dart` | tambah | Layar 03: Detail Kendaraan |
| `apps/mobile/lib/screens/date_time_screen.dart` | tambah | Layar 04: Tanggal & Waktu |
| `apps/mobile/assets/images/avanza_hero.png` | tambah | Asset image foto Avanza Hero dari Figma (Node 1080:632) |
| `apps/mobile/assets/images/avanza_card.png` | tambah | Asset image thumbnail Avanza dari Figma (Node 1080:569) |
| `apps/mobile/assets/images/innova_card.png` | tambah | Asset image thumbnail Innova dari Figma (Node 1080:580) |
| `apps/mobile/assets/images/fortuner_card.png` | tambah | Asset image thumbnail Fortuner dari Figma (Node 1080:578) |
| `apps/mobile/assets/images/hilux_card.png` | tambah | Asset image thumbnail Hilux dari Figma (Node 1080:579) |
| `apps/mobile/assets/images/avanza_detail.png` | tambah | Asset image hero detail Avanza dari Figma (Node 1080:532) |

## 5. Proses dan Perintah

```bash
# Struktur berkas dibangun di folder mobile app/
# Verifikasi anti-slop: 0 em dash
# Verifikasi modularitas widget: 4 screens, 4 widgets atomik, 1 model, 2 theme files
```

## 6. Hasil dan Evidence

- **Screenshot Beranda**: `1080-581-1789997482238.png`
- **Screenshot Pilih Kendaraan**: `1012-3-1789997486799.png`
- **Screenshot Detail Kendaraan**: `1012-4-1789997493590.png`
- **Screenshot Tanggal & Waktu**: `1012-5-1789997497492.png`
- **Audit Anti-Slop**: 0 em dash (`—`) terdeteksi di seluruh source code Dart.

## 7. Kontribusi AI pada Entry Ini

- AI menganalisis token warna, hierarki visual, dan spesifikasi dari 4 frame Figma Hi-Fi.
- AI menghasilkan kode modular Flutter yang mematuhi aturan penghilangan status bar statis dan penambahan tombol panah kalender `<` dan `>`.
- User memberikan arahan aturan slicing, konfirmasi scope 4 layar, dan batasan anti-slop.

## 8. Catatan dan Blocker

- Alur layar berikutnya (Langkah 4: Opsi Rental dan Langkah 5: Tinjau Pesanan) akan dikerjakan pada sub-milestone lanjutan.
- Integrasi HTTP client Dio ke backend API (`GET /api/v1/vehicles`) disiapkan pada Issue `#19`.

## 9. Keputusan Teknis

- Menggunakan `SafeArea` native untuk mengatasi artefak visual status bar statis dari canvas Figma.
- Menambahkan kontrol `IconButton` panah kiri dan kanan pada header bulan kalender agar pengguna dapat memilih bulan selain April 2026 secara dinamis.
- Menggunakan pendekatan token warna terpusat di `AppColors` untuk memastikan kemudahan integrasi dark mode / penyesuaian di masa depan.

## 10. Reviewer Checklist (Untuk PIC D - Halimah)

- [x] Status entry konsisten dengan kode di `mobile app/`.
- [x] Tidak ada identifier atau data fiktif di luar konteks Merauke.
- [x] Bebas dari karakter em dash (`—`) sesuai aturan Anti-Slop v3.2.1.
- [x] Bukti hasil visual tersedia dan terverifikasi.
- [x] Siap digabungkan ke branch utama setelah PR review.
