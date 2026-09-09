# Lo-Fi → Hi-Fi Decision Log — MobilJuragan MVP

> **Status keseluruhan:** `needed to be validated by team`
> Tanggal dimulainya: 07/09/26 (Batch 1) dan 09/09/26 (Batch 2).
> Penulis: Hylmi.
> Tujuan: mendokumentasikan keputusan UX/UI dari Lo-Fi Wireframe, membedakan apa yang siap dibawa ke Hi-Fi dengan apa yang masih menunggu review tim.

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
- `Ringkasan Anotasi Lo-Fi (Batch 1 + Batch 2)` — node `674:308`, 24 baris.

### 1.3 Status pengerjaan

| Batch | Scope | Status Lo-Fi | Status Hi-Fi |
|---|---|---|---|
| Batch 1 | Beranda, Pilih Kendaraan, Tinjau Pesanan | needed to be validated by team | belum diterapkan |
| Batch 2 | Detail Kendaraan, Tanggal & Waktu, Opsi Rental | needed to be validated by team | belum diterapkan |
| Batch 3 (direncanakan) | Data Pemesan, Verifikasi OTP, Status Booking | belum dijalankan | belum diterapkan |
| Batch 4 (direncanakan) | Bantuan, Buat Ticket, Chat Bantuan | belum dijalankan | belum diterapkan |

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

### 2.6 Ringkasan anotasi

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
