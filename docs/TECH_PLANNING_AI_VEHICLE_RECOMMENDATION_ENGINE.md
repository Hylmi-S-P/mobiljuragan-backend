# Tech Planning & RFC: AI Vehicle Recommendation & Prediction Engine

**Project:** MobilJuragan (CV. Mobil Juragan Express Transport, Merauke)  
**Dokumen Referensi UI/UX:** Figma Screen 01 `01c / Hi-Fi : Beranda` (Hero Suggestion Card, Node ID: `1080:603` s/d `1080:632`)  
**Status Dokumen:** **RFC / Lembar Musyawarah Tim (Menunggu Keputusan Bersama 4 PIC). Belum Masuk Implementasi Runtime.**  
**Penulis / Pengusul:** Hylmi (PIC C - Backend Engineer)  
**Catatan Penting Pengusul:** Seluruh opsi arsitektur di bawah ini diajukan secara terbuka sebagai opsi pilihan bersama tim. Pengusul tidak memutuskan opsi secara sepihak, melainkan menyerahkan penetapan opsi final melalui evaluasi dan persetujuan bersama antara Harun (PIC A), Dehan (PIC B), Hylmi (PIC C), dan Halimah (PIC D).  
**Tujuan:** Mendokumentasikan desain konseptual dan arsitektur teknis integrasi kecerdasan buatan (*Artificial Intelligence*) pada bagian kartu saran (*suggestion card*) di layar Beranda. Dokumen ini merangkum **Opsi 1 (Predictive Scoring Engine)**, **Opsi 2 (Gen-AI Gemini Suggestion)**, dan **Opsi 3 (Hybrid Tiered Architecture)** sebagai menu pilihan keputusan tim.

---

## 1. Latar Belakang dan Urgensi Fitur

Pada antarmuka Beranda saat ini (Screen 01), kartu rekomendasi armada menampilkan unit statis berupa **Toyota New Avanza 1.3 G** dengan badge `"TERPOPULER DI MERAUKE"`.

Walaupun representatif untuk kebutuhan umum, pendekatan statis ini memiliki beberapa keterbatasan:
1. **Peluang Integrasi AI Capstone:**
   Repositori proyek ini berjudul `grand-project-uiux-mobile-webframework-ai`. Kehadiran fitur rekomendasi cerdas pada alur penemuan produk (*product discovery*) memberikan wujud nyata penerapan AI yang langsung berdampak pada transaksi bisnis, bukan sekadar chatbot bantuan tambahan.
2. **Heterogenitas Kebutuhan Sewa di Merauke:**
   Kebutuhan mobilitas di Kabupaten Merauke sangat tersegmentasi:
   - **Tamu Kedinasan / Pejabat Pemda:** Memprioritaskan kenyamanan, prestise, dan AC dingin untuk agenda protokoler (*Toyota Innova Reborn / Fortuner*).
   - **Operasional Proyek / Lapangan:** Membutuhkan kendaraan tangguh jalan tanah atau medan berlumpur (*Toyota Hilux 4x4 Double Cabin*).
   - **Kunjungan Rombongan / Wisatawan:** Membutuhkan kapasitas angkut 12–16 orang (*Toyota HiAce Premio/Commuter*).
   - **Aktivitas Keluarga / Efisiensi Biaya:** Membutuhkan efisiensi bahan bakar dan tarif ramah anggaran (*Toyota Avanza 1.3 G*).
3. **Pemanfaatan Data Profil Pengguna (Screen 13):**
   Setelah pelanggan masuk akun (*login*), sistem memiliki data riwayat pesanan (misal: `3 Pesanan Selesai`) dan jenis SIM yang terverifikasi. Data ini dapat menjadi sinyal prediktif untuk menyajikan armada yang paling relevan.

---

## 2. Perbandingan Dua Pendekatan Teknis

Dokumen ini mengajukan dua alternatif arsitektur AI untuk dievaluasi oleh tim pengembang:

| Parameter Evaluasi | Opsi 1: Predictive Scoring Engine (Lightweight ML / Heuristic) | Opsi 2: Gen-AI Contextual Engine (Google Gemini API) |
|---|---|---|
| **Mekanisme Kerja** | Perhitungan formula skor multivariabel di backend lokal berdasarkan data transaksi, waktu, dan profil pelanggan. | Pemanggilan model LLM (Gemini 1.5/2.0 Flash) dengan skema JSON terstruktur berisi profil pengguna dan inventaris 9 armada. |
| **Kecepatan / Latensi** | **Sangat Cepat (< 25 ms)**. Dijalankan langsung di memori server tanpa network roundtrip ke pihak ketiga. | **Moderat (350–800 ms)**. Bergantung pada latensi jaringan ke Google Cloud / Gemini API (memerlukan caching). |
| **Ketergantungan Eksternal** | **Nol (Zero External Dependency)**. Bekerja penuh secara mandiri di Express.js & PostgreSQL. | Membutuhkan API Key Gemini yang aktif dan kuota panggilan API. |
| **Sifat Luaran (*Determinism*)** | 100% Deterministik dan matematis; tidak pernah berhalusinasi atau merekomendasikan armada fiktif. | Bersifat probabilistik; memerlukan validasi schema Zod ketat agar ID kendaraan selalu valid. |
| **Gaya Bahasa Rekomendasi** | Kalimat terstruktur berbasis template yang baku dan teruji (*safe template copy*). | Kalimat alami, kontekstual, dan bervariasi (*human-like reasoning microcopy*). |
| **Biaya Operasional (*Cost*)** | Rp 0 (tanpa biaya token API). | Gratis pada tingkat *free tier*, berbayar jika melampaui kuota. |
| **Ketahanan Gangguan (*Fail-Soft*)** | Sangat tinggi; bekerja stabil saat internet di Merauke mengalami gangguan (*offline-first friendly*). | Memerlukan mekanisme fallback otomatis ke Opsi 1 jika koneksi API terputus. |

---

## 3. Rincian Teknis Opsi 1: Predictive Scoring Engine

Opsi ini menggunakan fungsi pembobotan matematis (*weighted multi-factor classification*) yang menghitung skor kelayakan $S(v)$ untuk setiap kendaraan $v$ dari 9 armada resmi:

$$S(v) = w_1 \cdot P_{\text{user}}(v) + w_2 \cdot T_{\text{context}}(v) + w_3 \cdot H_{\text{history}}(v) + w_4 \cdot A_{\text{status}}(v)$$

### 3.1 Parameter Pembobotan:
1. **$P_{\text{user}}$ (Kesesuaian Profil & Izin Rental - Bobot 35%):**
   - Jika pelanggan belum memiliki SIM A terverifikasi $\rightarrow$ Kendaraan besar/lepas kunci diberi penalti; opsi *Dengan Sopir* diprioritaskan.
   - Jika akun tercatat sebagai tamu dinas/instansi $\rightarrow$ Bobot SUV/Innova dinaikkan (+40 poin).
2. **$T_{\text{context}}$ (Konteks Waktu & Hari - Bobot 25%):**
   - Hari Kerja (Senin–Kamis) $\rightarrow$ Prioritas armada operasional dan kedinasan.
   - Akhir Pekan (Jumat–Minggu) $\rightarrow$ Prioritas armada MPV keluarga (Avanza/Innova) dan rombongan (HiAce).
3. **$H_{\text{history}}$ (Riwayat Transaksi Pelanggan - Bobot 25%):**
   - Mobil yang paling sering diselesaikan oleh pelanggan dalam 6 bulan terakhir mendapat skor kecocokan tertinggi.
4. **$A_{\text{status}}$ (Ketersediaan Fisik Armada - Bobot 15%):**
   - Kendaraan berstatus `AVAILABLE` mendapat nilai penuh. Kendaraan `RENTED` atau `MAINTENANCE` langsung dieliminasi dari daftar rekomendasi ($S = 0$).

### 3.2 Contoh Hasil Luaran Opsi 1:
```json
{
  "engine": "PREDICTIVE_SCORING",
  "vehicleId": "AVANZA-001",
  "score": 0.94,
  "badgeText": "Pilihan AI: Paling Hemat",
  "aiInsight": "94% penyewa serupa memilih Avanza untuk operasional dalam kota Merauke."
}
```

---

## 4. Rincian Teknis Opsi 2: Gen-AI Contextual Suggestion (Gemini)

Opsi ini memanfaatkan Google Gemini API dengan fitur **Structured Output (JSON Mode)**.

### 4.1 Desain Prompt Backend:
```text
Anda adalah AI Dispatcher resmi MobilJuragan di Merauke, Papua Selatan.
Tugas Anda: Pilih 1 armada terbaik dari 9 kendaraan resmi berikut berdasarkan konteks pelanggan.

[DATA INVENTARIS ARMADA MERAUKE]
- Toyota New Avanza (MPV 7 Kursi, Manual, Hemat bensin, Dalam kota)
- Toyota Kijang Innova Reborn (MPV Premium 7 Kursi, Nyaman, Kedinasan)
- Toyota Fortuner 2.8 VRZ (SUV Mewah 7 Kursi, Tangguh, Pejabat)
- Toyota Hilux Double Cabin (Pickup 4x4, Proyek medan berlumpur/tanah)
- Toyota HiAce Premio (Van 12 Kursi, Rombongan/Tamu VIP)
...

[KONTEKS PELANGGAN]
- Nama: Budi Santoso
- Status Akun: Terverifikasi (KTP & SIM A Lengkap)
- Riwayat Pesanan: 3 kali sewa Lepas Kunci
- Waktu Permintaan: Jumat Sore (Menjelang Akhir Pekan)

KEMBALIKAN OUTPUT HANYA DALAM FORMAT JSON BERIKUT:
{
  "recommendedVehicleId": "string",
  "badgeLabel": "string (maksimal 25 karakter)",
  "aiInsightReason": "string (1 kalimat informatif khas Merauke, max 100 karakter)"
}
```

### 4.2 Validasi Keamanan Schema Zod di Backend:
Sebelum dikirim ke aplikasi mobile Flutter, luaran LLM divalidasi oleh Zod:
```typescript
const geminiRecommendationSchema = z.object({
  recommendedVehicleId: z.string().refine((id) => validVehicleIds.includes(id), {
    message: "Kendaraan rekomendasi AI harus terdaftar pada 9 armada resmi.",
  }),
  badgeLabel: z.string().max(30),
  aiInsightReason: z.string().max(120),
});
```
Jika validasi gagal atau API timeout (> 1.5 detik), sistem secara otomatis mengaktifkan **Fallback Fail-Soft** ke Opsi 1.

---

## 5. Rekomendasi Arsitektur Gabungan (*Hybrid Architecture*)

Untuk menggabungkan keunggulan kecepatan Opsi 1 dan kecerdasan kontekstual Opsi 2, disarankan arsitektur bertingkat (*Tiered Fallback*):

```
                                  [ Permintaan Layar Beranda ]
                                                │
                                                ▼
                                   [ Cek Cache Rekomendasi ]
                                    (TTL: 6 Jam per User)
                                         /            \
                                  Ada Cache         Tidak Ada
                                     /                    \
                         [ Kirim Data Cache ]      [ Status Login User? ]
                                                    /                  \
                                              Sudah Login           Tamu / Anonim
                                                 /                        \
                                     [ Panggil Opsi 2 (Gemini) ]    [ Eksekusi Opsi 1 (Scoring) ]
                                          /               \
                                      Sukses             Gagal / Timeout
                                       /                     \
                              [ Simpan Cache ]        [ Fallback ke Opsi 1 ]
                                       \                     /
                                   [ Kirim Respons ke Flutter ]
```

---

## 6. Rancangan Antarmuka Pengguna (*Explainable AI Wireframe*)

Perubahan visual pada Hero Card Beranda (Screen 01, Node ID `1080:603`):

```
┌────────────────────────────────────────────────────────┐
│ [ ✨ REKOMENDASI AI ]                    [ PA 1692 B ] │  <-- Badge cerdas dinamis
│                                                        │
│ Toyota New Avanza 1.3 G                                │
│ MPV 7 Kursi • Manual • AC Double Dingin                │
│                                                        │
│                   [ Foto Mobil ]                       │
│                                                        │
│ 💡 AI Insight: "Paling banyak dipilih pelanggan serupa │  <-- Penjelasan transparan (XAI)
│    untuk mobilitas hemat di Merauke."                  │
│                                                        │
│ [ Lepas Kunci ]    [ Dengan Sopir ]    [ Antar Bandara]│
└────────────────────────────────────────────────────────┘
```

### Karakteristik Desain (Kepatuhan Anti-Slop):
1. **Tidak Ada Klaim Berlebihan:** Menghindari kata bombastis seperti *"Super Cerdas"* atau *"Teknologi Revolusioner"*. Cukup gunakan label lugas seperti `Rekomendasi AI` atau `Pilihan AI`.
2. **Explainable AI (XAI):** Pengguna selalu diberi tahu alasan logis mengapa mobil tersebut dipilih (faktor kapasitas, jenis medan, atau preferensi hemat).
3. **Kendali Penuh di Tangan Pengguna (*User Control*):** Kartu rekomendasi tidak mengunci pilihan. Tiga opsi sewa (*Lepas Kunci*, *Dengan Sopir*, *Antar Bandara*) tetap aktif dan dapat dipilih bebas oleh pengguna.

---

## 7. Kontrak REST API Usulan

Jalur endpoint yang direncanakan untuk modul rekomendasi:

### `GET /api/v1/vehicles/recommendation`
* **Autentikasi:** Opsional (Mendukung tamu anonim maupun pengguna login).
* **Query Parameters:**
  - `purpose`: (opsional) `DAILY | BUSINESS | HEAVY_DUTY | FAMILY`
  - `rentalType`: (opsional) `SELF_DRIVE | WITH_DRIVER`
* **Responses (200 OK):**
```json
{
  "status": "ok",
  "data": {
    "engineUsed": "PREDICTIVE_SCORING",
    "badge": "Rekomendasi AI: Paling Hemat",
    "aiInsight": "Direkomendasikan untuk sewa lepas kunci rute dalam kota Merauke.",
    "confidenceScore": 0.94,
    "vehicle": {
      "id": "AVANZA-001",
      "externalId": "toyota-new-avanza-1.3-g",
      "name": "Toyota New Avanza 1.3 G",
      "licensePlate": "PA 1692 B",
      "category": "MPV",
      "seatingCapacity": 7,
      "transmission": "MANUAL",
      "imageUrl": "https://mobiljuragan.com/fleet/avanza.png",
      "defaultRentalOption": "LEPAS_KUNCI"
    },
    "alternativeVehicles": [
      {
        "id": "INNOVA-001",
        "name": "Toyota Innova Reborn 2.4 G",
        "reason": "Opsi lebih nyaman untuk rombongan keluarga"
      }
    ]
  }
}
```

---

## 8. Aspek Keamanan & Privasi Data Pengguna

Jika Opsi 2 (Gemini API) digunakan, aturan perlindungan privasi diterapkan secara ketat:
1. **Pencegahan Kebocoran PII (*Zero PII Leakage*):**
   - Nama lengkap asli, nomor telepon, NIK KTP, nomor SIM, serta alamat domisili presisi **TIDAK PERNAH** dikirim ke API Gemini.
   - Sinyal yang dikirim ke LLM hanya berupa atribut agregat anonim (contoh: `userCategory: "FAMILY"`, `tripCount: 3`, `bookingDay: "WEEKEND"`).
2. **Kepatuhan Audit:**
   - Rekaman panggilan AI disimpan di tabel `audit_logs` hanya berupa ringkasan keputusan model dan latency eksekusi.

---

## 9. Peninjauan Awal Tiap PIC

Dokumen ini berstatus **bahan musyawarah terbuka**. Masing-masing PIC memiliki fokus telaah teknis:

- [ ] **PIC A (Harun - Mobile):** Meninjau kelayakan tata letak microcopy *AI Insight* pada viewport 390×844 px agar tidak memicu overflow di Flutter.
- [ ] **PIC B (Dehan - Web Admin):** Meninjau apakah preferensi rekomendasi AI perlu diatur secara manual oleh staf admin dari Dashboard Next.js.
- [ ] **PIC C (Hylmi - Backend):** Melakukan benchmark latensi antara fungsi kalkulasi lokal versus integrasi SDK Gemini di `services/api`.
- [ ] **PIC D (Halimah - QA):** Menyetujui kriteria uji pengujian kasus batas (*edge cases*), seperti kegagalan internet atau ketiadaan armada yang tersedia.

---

## 10. Lembar Suara & Matriks Keputusan Musyawarah Tim (*Team Ballot*)

Karena keputusan arsitektur ini menyangkut beban kerja lintas platform (Mobile, Backend, Dashboard, dan QA), penetapan opsi tidak diputuskan sepihak oleh backend engineer, melainkan diserahkan sepenuhnya ke musyawarah tim 4 PIC:

| Pilihan Keputusan | Deskripsi Singkat | Konsekuensi Implementasi | Status Suara / Pilihan |
|---|---|---|:---:|
| **Pilihan A: Opsi 1 (Predictive Scoring Engine)** | Model scoring matematis lokal berbasis formula di Express.js & Postgres. | Latensi sangat kencang (< 25 ms), tanpa kuota API, 100% offline-ready di Merauke, copywriting template baku. | `[ ] Usulan Dipertimbangkan` |
| **Pilihan B: Opsi 2 (Google Gemini Gen-AI)** | Model LLM Gemini Flash dengan structured output JSON. | Bahasa sangat alami & kontekstual, latensi 350–800 ms, membutuhkan API key & koneksi eksternal. | `[ ] Usulan Dipertimbangkan` |
| **Pilihan C: Opsi 3 (Hybrid Tiered Architecture)** | Opsi 1 untuk tamu anonim/offline fallback + Opsi 2 untuk user login ter-cache. | Menggabungkan keandalan lokal dan kecerdasan generatif, membutuhkan alur fallback fail-soft di backend. | `[ ] Usulan Dipertimbangkan` |
| **Pilihan D: Status Quo (Tetap Statis)** | Mempertahankan kartu Beranda statis Toyota Avanza tanpa modul AI. | Nol beban kerja baru, namun tidak memanfaatkan komponen AI capstone di alur penemuan armada. | `[ ] Usulan Dipertimbangkan` |

### Rekapitulasi Suara PIC (Akan Diisi Saat Rapat Tim):
* **Harun (PIC A - Mobile):** `[ Menunggu Review ]`
* **Dehan (PIC B - Web Admin):** `[ Menunggu Review ]`
* **Hylmi (PIC C - Backend):** `[ Menunggu Review ]`
* **Halimah (PIC D - QA Lead):** `[ Menunggu Review ]`

**Tanggal Rapat Penetapan:** *(Menunggu agenda sinkronisasi tim)*  
**Keputusan Final yang Disepakati:** *(Akan dicatat setelah seluruh PIC menandatangani keputusan bersama)*
