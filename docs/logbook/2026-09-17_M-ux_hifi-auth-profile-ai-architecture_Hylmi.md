---
tanggal: 17/09/26
milestone: M-UX & Tech Planning (Row 3 Auth & Profil, Redesign Beranda, Arsitektur Profil & RFC AI Engine)
fitur: Hi-Fi Row 3 (Screen 12 & 13), Redesain Beranda 01c, Arsitektur Profil Pelanggan, dan RFC Rekomendasi AI
pic: Hylmi (PIC C - Backend Engineer / UI-UX Builder)
reviewer: Halimah (PIC D - QA Lead)
status: done
model_ai: Antigravity (Google DeepMind)
provider_ai: Google DeepMind
versi_model: Antigravity 2.0
cakupan_ai: design | docs | review
prompt_disimpan: false
decision_log: docs/design/LOFI_TO_HIFI_DECISIONS.md
context_ref: docs/context/CONTEXT_DUMP_figma_antigravity.md
---

## 1. Ringkasan

Menyelesaikan implementasi kanonik High-Fidelity Baris 3 pada master canvas Figma `1006:92` ($y = 2750$) yang mencakup alur autentikasi pelanggan (Layar 12 Masuk / Login) dan manajemen akun (Layar 13 Profil Pengguna), serta Journey Map Baris 3 ($y = 3650$). Melakukan redesain proporsional menyeluruh pada Layar 01c Beranda (`1080:581`) untuk mengeliminasi clutter dan memperkuat visual hierarchy. Menyusun dokumen arsitektur teknis profil pengguna pelanggan (`customerCode`, dokumen KTP/SIM lepas kunci, domisili, REST API) serta dokumen RFC proposal integrasi AI Vehicle Recommendation & Prediction Engine pada kartu saran Beranda lengkap dengan lembar musyawarah tim 4 PIC.

## 2. Fitur atau Scope

- **Redesain Kanonik Layar 01c Beranda (`1080:581`):**
  - Mengeliminasi tombol sewa ganda yang membingungkan alur kognitif.
  - Membangun Hero Showcase Card terpadu ($350 \times 248$ px) dengan foto riil Toyota Avanza G Putih (`PA 1692 B`), badge `TERPOPULER DI MERAUKE`, dan 3 opsi sewa rapi (*Lepas Kunci, Dengan Sopir, Antar Bandara*).
  - Menghapus komponen search capsule mengambang dan bayangan sintetis abu-abu.
  - Menyediakan single primary CTA dominan ($350 \times 52$ px Navy `#1E3A5F`): *Pesan Mobil Sekarang →* dengan microcopy jaminan tanpa biaya tersembunyi.
- **Layar 12 — Masuk / Login (`1071:1742`):** Input nomor WhatsApp/telepon dengan prefix `+62`, grid 6 kotak digit OTP, countdown timer kirim ulang (01:45), klausul persetujuan privasi, tombol CTA *Masuk Sekarang*, dan fail-soft bantuan CS Merauke.
- **Layar 13 — Profil Pengguna (`1071:1785`):** Kartu identitas pengguna (Avatar inisial `BS`, nama `Budi Santoso`, status `Pelanggan Terverifikasi ✓`), quick stats (1 Booking Aktif `#BK-5521` & 3 Pesanan Selesai), menu verifikasi syarat lepas kunci (KTP & SIM A), menu alamat domisili Merauke, preferensi pembayaran manual, legalitas, dan tombol *Keluar dari Akun*.
- **Journey Map & Laws of UX Baris 3 (`1071:1859`):** Kanvas $1320 \times 320$ px di $y = 3650$ membedah Hick's Law, Jakob's Law, Fitts's Law, dan Protocol Integrity Box.
- **Arsitektur Profil Pelanggan (`docs/TECH_PLANNING_CUSTOMER_PROFILE_ARCHITECTURE.md`):**
  - Format kode pelanggan ramah manusia: `CUST-MRK-YYMM-XXXX`.
  - Ekstensi model Prisma `User`, model `CustomerDocument` (KTP & SIM A lepas kunci), model `CustomerPaymentMethod`.
  - State machine verifikasi akun (`UNVERIFIED` $\rightarrow$ `PENDING_REVIEW` $\rightarrow$ `VERIFIED` / `REJECTED`).
  - Kontrak REST API `/api/v1/customer/*` dan arsitektur client Flutter Riverpod.
- **RFC Proposal Rekomendasi AI (`docs/TECH_PLANNING_AI_VEHICLE_RECOMMENDATION_ENGINE.md`):**
  - Desain transformasi kartu saran Beranda menjadi kartu prediksi cerdas.
  - Perbandingan Opsi 1 (Predictive Scoring Engine / Heuristic Lokal), Opsi 2 (Gen-AI Google Gemini Flash), dan Opsi 3 (Hybrid Tiered Architecture).
  - Lembar suara keputusan bersama 4 PIC (*Team Decision Ballot*).
- **Sinkronisasi Artefak Visual:** Ekspor seluruh screenshot Hi-Fi skala 2.0x (780 × 1688 px) ke `docs/figma-raw/` dan `docs/figma-raw/mobile/`, serta pembaruan `docs/MANIFEST.json` dan `docs/README.md`.

## 3. API, Endpoint, dan Identifier Teknis

### 3.1 Node Figma (File Key: `Rxdv5kRYC8NiQpdWJhoIGJ`)

| Komponen / Layar | Node ID | Posisi ($x, y$) | Dimensi |
|---|---|---|---|
| `01c / Hi-Fi : Beranda (Kanonik Redesign)` | `1080:581` | $x = 0, y = 0$ | $390 \times 844$ px |
| `12 / Hi-Fi : Masuk / Login` | `1071:1742` | $x = 0, y = 2750$ | $390 \times 844$ px |
| `13 / Hi-Fi : Profil Pengguna` | `1071:1785` | $x = 440, y = 2750$ | $390 \times 844$ px |
| Journey Map Row 3 (Container) | `1071:1859` | $x = 0, y = 3650$ | $1320 \times 320$ px |

### 3.2 Identifier Teknis dan Endpoint

- Format Kode Pelanggan: `CUST-MRK-<YYMM>-<SEQUENCE>` (Contoh: `CUST-MRK-2609-0001`).
- Endpoint Profil Pelanggan:
  - `GET /api/v1/customer/profile`
  - `PATCH /api/v1/customer/profile`
  - `POST /api/v1/customer/documents` (KTP & SIM A)
  - `GET /api/v1/customer/stats`
  - `POST /api/v1/auth/logout`
- Endpoint Usulan Rekomendasi AI:
  - `GET /api/v1/vehicles/recommendation`
- Enum Baru: `CustomerVerificationStatus` (`UNVERIFIED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED`), `CustomerDocumentType` (`KTP`, `SIM_A`).

## 4. File yang Berubah

| Path | Aksi | Catatan |
|---|---|---|
| `docs/TECH_PLANNING_CUSTOMER_PROFILE_ARCHITECTURE.md` | tambah | Dokumen arsitektur teknis profil pengguna, customerCode, dan verifikasi SIM/KTP |
| `docs/TECH_PLANNING_AI_VEHICLE_RECOMMENDATION_ENGINE.md` | tambah | Proposal RFC arsitektur AI prediction armada dan lembar suara musyawarah tim |
| `docs/design/LOFI_TO_HIFI_DECISIONS.md` | ubah | Dokumentasi redesign Screen 01, implementasi Row 3, status `hi-fi-applied` |
| `docs/MANIFEST.json` | ubah | Pemetaan kanonik node Figma Hi-Fi dan screenshot resolusi tinggi |
| `docs/README.md` | ubah | Pendaftaran dokumen arsitektur dan RFC ke indeks repositori |
| `docs/figma-raw/*` & `docs/figma-raw/mobile/*` | tambah/ubah | Sinkronisasi tangkapan layar 2.0x skala penuh (13 layar + 3 journey map) |
| `.gitignore` | ubah | Mengabaikan tangkapan layar sementara `figma_*.png` di root direktori |

## 5. Proses dan Perintah

1. Pengambilan metadata dan bounds node Figma:
   ```text
   figma-dev-mode-mcp-server: get_metadata, get_screenshot (Node 1071:1742, 1071:1785)
   ```
2. Audit keterkaitan kode backend dan Prisma schema:
   ```text
   services/api/src/routes/v1/auth.ts (OTP request & verify)
   services/api/prisma/schema.prisma (Model User & OtpVerification)
   ```
3. Penyusunan dokumen arsitektur teknis profil dan proposal RFC rekomendasi AI di folder `docs/`.
4. Staging dan commit git:
   ```bash
   git add docs/ .gitignore
   git commit -m "docs: add customer profile architecture, sync canonical hifi screenshots and manifest"
   git commit -m "docs: add RFC for AI vehicle recommendation engine options and team decision ballot"
   git push origin dev/hylmi
   ```

## 6. Hasil dan Evidence

- **Commit Hashes:**
  - `8e1a6e1`: Sinkronisasi screenshot kanonik, manifest, redesign Screen 01, dan arsitektur profil pelanggan.
  - `70de11e`: Penyusunan RFC rekomendasi AI dan lembar suara musyawarah tim 4 PIC.
- **Audit Anti-Slop Directive:**
  - Karakter em dash (`—`): 0 pada teks UI publik.
  - Teks terpotong/meluap (overflow): 0 ditemukan (lolos uji batas geometris).
  - Resolusi aset: Bersih pada 2.0x scale (780 × 1688 px) tanpa artefak rendering.
- **Integritas Data:** Seluruh data profil Budi Santoso, nomor HP demo, dan armada diberi label transparan `Data contoh`.

## 7. Checklist Reviewer

- [x] Halimah memverifikasi kesesuaian viewport 390 × 844 px dan eliminasi overflow pada Layar 01c, 12, dan 13.
- [x] Halimah menyetujui dokumen arsitektur profil pelanggan dan pencantuman klausul RFC pada dokumen rekomendasi AI.
- [x] Seluruh artefak tersinkronisasi dan status entry ditetapkan menjadi **`done`**.
