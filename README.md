# MobilJuragan MVP

Digital product & prototype layanan rental mobil untuk **CV. Mobil Juragan Express Transport** di Merauke, Papua Selatan.  
Arsitektur sistem menggunakan pendekatan monorepo berbasis client-server terpusat, menghubungkan aplikasi pelanggan di mobile dan dashboard staf operasional di web.

---

## 1. Arsitektur & Tech Stack

Sistem terdiri dari dua client utama dengan satu backend sebagai sumber kebenaran tunggal (*single source of truth*) untuk seluruh business logic:

| Layer | Pilihan Teknologi | Peran & Deskripsi |
|---|---|---|
| **Customer Mobile** | Flutter + Dart | Aplikasi pelanggan untuk pemesanan mobil, riwayat status sewa, dan tiket bantuan. |
| **Admin Dashboard** | Next.js 16 + TypeScript + Tailwind CSS 4 | Dashboard web admin/staf untuk monitoring armada, antrean booking, dan Customer Care. |
| **Backend API** | Express.js + TypeScript (ESM) | REST API `/api/v1` terstandarisasi untuk mengelola seluruh logika bisnis dan transaksi data. |
| **Database & ORM** | PostgreSQL 18 + Prisma 7 | Database relasional dengan `@prisma/adapter-pg` untuk integritas data sewa, jadwal armada, dan user. |
| **API Contract** | OpenAPI 3.0.3 (`docs/api/openapi.yaml`) | Kontrak integrasi lintas-platform antara backend, mobile, dan web. |
| **Authentication** | OTP Phone (Customer) & JWT + Bcrypt (Admin) | Autentikasi aman berbasis token JWT dan verifikasi OTP nomor ponsel. |

```text
       ┌─────────────────────────┐         ┌─────────────────────────┐
       │   Customer Mobile App   │         │  Admin Web Dashboard    │
       │    (Flutter / Dart)     │         │   (Next.js / TS / TW)   │
       └────────────┬────────────┘         └────────────┬────────────┘
                    │                                   │
                    │         REST API (/api/v1)        │
                    └─────────────────┬─────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │    Express.js API       │
                         │    (services/api)       │
                         └────────────┬────────────┘
                                      │  Prisma 7 Client
                         ┌────────────┴────────────┐
                         │   PostgreSQL Database   │
                         │   (8 Tabel Relasional)  │
                         └─────────────────────────┘
```

---

## 2. Struktur Monorepo

Struktur monorepo dikelola menggunakan **pnpm workspaces** dan **Turborepo**:

```text
apps/
├── mobile/                 # Flutter Customer App (mobiljuragan_mobile)
└── dashboard/              # Next.js 16 Admin Dashboard (@mobiljuragan/dashboard)
services/
└── api/                    # Express.js REST API & Prisma (@mobiljuragan/api)
packages/                   # (Dipersiapkan untuk shared packages)
docs/                       # Arsip desain, Figma extraction, IA, token, dan dokumentasi teknis
├── api/                    # Kontrak OpenAPI 3.0.3 (openapi.yaml)
├── design/                 # Aturan desain otoritatif (DESIGN.md) & log keputusan Lo-Fi
├── design-tokens.json      # Token warna, tipografi, spacing, dan elevation
├── figma-raw/              # Ekstraksi screenshot visual resmi Figma (Mobile, Dashboard, DS)
├── ia/                     # Information Architecture dan diagram User Flow (.drawio & .docx)
└── logbook/                # Catatan progres pengerjaan milestone & evidence tim
```

---

## 3. Prasyarat Sistem

Sebelum memulai inisialisasi project, pastikan environment lokal telah terpasang:

- **Node.js**: Versi $\ge$ 20 (disarankan Node.js v22 atau v26 LTS)
- **pnpm**: Versi $\ge$ 9 (disarankan v11.x)
- **PostgreSQL**: Versi 16 atau 18 lokal aktif (contoh: via FlyEnv, Docker, atau PostgreSQL Service)
- **Flutter SDK**: Versi $\ge$ 3.x (untuk pengembangan aplikasi `apps/mobile`)

---

## 4. Panduan Inisialisasi Project

Ikuti langkah-langkah berikut untuk menginisialisasi repository dari awal:

### Langkah 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/Hylmi-S-P/the-grand-budapest-hotel.git
cd the-grand-budapest-hotel

# Install seluruh dependency monorepo via pnpm
pnpm install
```

### Langkah 2: Konfigurasi Environment Variable
Salin template konfigurasi pada service API:
```bash
cp services/api/.env.example services/api/.env
```
Sesuaikan isi `services/api/.env` dengan kredensial database PostgreSQL lokal Anda:
```env
DATABASE_URL="postgresql://mobiljuragan:mobiljuragan@localhost:5432/mobiljuragan?schema=public"
PORT=4000
APP_VERSION=dev
LOG_LEVEL=info
SESSION_SECRET="ganti_dengan_secret_acak_anda"
```

### Langkah 3: Migrasi Database & Seeding Data
Jalankan migrasi skema Prisma dan lakukan seeding untuk memasukkan **9 armada resmi Merauke** beserta akun admin/staf awal:
```bash
# Generate Prisma Client
pnpm --filter @mobiljuragan/api run prisma:generate

# Jalankan migrasi tabel ke PostgreSQL
pnpm --filter @mobiljuragan/api run prisma:migrate

# Lakukan seeding armada dan akun awal
pnpm --filter @mobiljuragan/api run prisma:seed
```

### Langkah 4: Verifikasi Pengujian Otomatis
Jalankan test suite otomatis untuk memverifikasi endpoint autentikasi, OTP, dan format error:
```bash
pnpm --filter @mobiljuragan/api test
```
*Output harus menyatakan seluruh skenario pengujian auth lolos 100%.*

---

## 5. Menjalankan Aplikasi

### Menjalankan Seluruh Service (Konkuren)
Untuk menjalankan backend API dan dashboard Next.js secara bersamaan melalui Turborepo:
```bash
pnpm dev
```

### Menjalankan Per Service / Aplikasi
Jika ingin menjalankan service secara terpisah:

- **Backend API (`services/api`):**
  ```bash
  pnpm --filter @mobiljuragan/api dev
  ```
  API akan aktif di `http://localhost:4000`. Cek kesehatan server di `http://localhost:4000/health`.

- **Admin Web Dashboard (`apps/dashboard`):**
  ```bash
  pnpm --filter @mobiljuragan/dashboard dev
  ```
  Dashboard akan aktif di `http://localhost:3000`.

- **Customer Mobile App (`apps/mobile`):**
  ```bash
  cd apps/mobile
  flutter run
  ```
  Pilih target device yang diinginkan (Android Emulator, iOS Simulator, Chrome/Web).

### Perintah Build & Quality Check Lintas Monorepo
```bash
pnpm typecheck   # Typecheck TypeScript pada API & Dashboard
pnpm build       # Production build untuk API (tsc) & Next.js dashboard
pnpm lint        # Linter code quality
```

---

## 6. Status Pengembangan & Milestone

Proyek mengacu pada rencana 16 milestone di [`docs/PLANNING_TECH_STACK_DAN_ROADMAP.md`](docs/PLANNING_TECH_STACK_DAN_ROADMAP.md):

- [x] **M1: Project Baseline** — Problem framing, Information Architecture, aturan desain, dan 9 armada resmi.
- [x] **M2: Tech Stack Decision** — Penetapan stack Flutter, Next.js, Express, PostgreSQL, Prisma, dan OpenAPI.
- [x] **M3: Repository Foundation** — Struktur monorepo pnpm + Turborepo, verifikasi typecheck dan build.
- [x] **M4: Database Foundation** — Schema 8 tabel relasional, migrasi PostgreSQL, singleton client, dan seed 9 armada resmi Merauke.
- [x] **M5: API Contract & Auth** — Standar response/error envelope, Zod validation, OTP customer aman (HMAC SHA-256 + attempt limit), login admin (bcrypt + JWT), role middleware, dan dokumen `openapi.yaml`.
- [ ] **M6: Vehicle & Availability API** — Endpoint katalog kendaraan dan deteksi konflik rentang tanggal booking. *(In Progress / Next)*
- [ ] **M7: Flutter Application Shell** — Theme token, routing `go_router`, dan 4 tab navigasi utama mobile. *(In Progress / Next)*

---

## 7. Batasan Bisnis & Integritas Data

Seluruh anggota tim dan pengembang wajib mematuhi batasan produk berikut:

1. **Integritas Armada:** Hanya 9 armada resmi CV. Mobil Juragan Express Transport yang boleh digunakan pada sistem dan seed data (Avanza Putih, Fortuner VRZ Hitam, Hilux Hitam, Innova Reborn Hitam, Suzuki Carry Pickup, Rush Coklat, Terios Hijau, Veloz Merah, dan Xpander Hitam).
2. **Penetapan Tarif:** Tarif sewa tidak boleh di-hardcode sebagai nominal angka tetap pada MVP; tampilkan label *"Tarif dikonfirmasi tim MobilJuragan"*, dan kolom `quoted_amount` di database tetap bernilai `null` sampai dikonfirmasi staf.
3. **Data Demo:** Setiap data simulasi atau demonstrasi harus secara eksplisit diberi label *"Data contoh"*.
4. **Keamanan Kredensial:** Kode OTP, hash rahasia, token, dan kata sandi tidak boleh disimpan dalam plaintext maupun di-commit ke repository publik.

---

## 8. Tautan Dokumentasi Terkait

- **[Planning Tech Stack & Roadmap](docs/PLANNING_TECH_STACK_DAN_ROADMAP.md):** Alokasi 16 milestone dan jadwal pengembangan.
- **[Spesifikasi OpenAPI 3.0.3](docs/api/openapi.yaml):** Kontrak REST API `/api/v1` lengkap.
- **[Design Guidelines (DESIGN.md)](docs/design/DESIGN.md):** Panduan visual, palette warna, tipografi, dan prinsip UI.
- **[Design Tokens (JSON)](docs/design-tokens.json):** Nilai variabel desain untuk web dan mobile.
- **[Information Architecture & Flow](docs/ia/):** Diagram IA master dan rincian user flow (.drawio).
- **[Pembagian Kerja Tim](docs/TEAM_WORK_ALLOCATION.md):** Pembagian tanggung jawab 4 PIC pengembang.
- **[Arsip Logbook Pengerjaan](docs/logbook/):** Bukti verifikasi pengerjaan milestone per tanggal.
