# MobilJuragan Backend API

Layanan REST API untuk sistem operasional dan pemesanan rental mobil **CV. Mobil Juragan Express Transport** di Merauke, Papua Selatan. Layanan ini mengelola transaksi pemesanan armada, manajemen data kendaraan, dan autentikasi pengguna.

---

## 1. Arsitektur Sistem

Layanan backend dibangun menggunakan arsitektur modular berlapis (*layered architecture*) yang memisahkan routing, validasi skema, logika autentikasi, dan akses basis data:

```text
┌─────────────────────────┐         ┌─────────────────────────┐
│   Customer Mobile App   │         │  Admin Web Dashboard    │
│    (Flutter Client)     │         │      (Next.js Web)      │
└────────────┬────────────┘         └────────────┬────────────┘
             │                                   │
             │        HTTP REST API (/api/v1)    │
             └─────────────────┬─────────────────┘
                               │
                  ┌────────────┴────────────┐
                  │    Express.js API       │
                  │    (Port: 4000)         │
                  └────────────┬────────────┘
                               │ Prisma 7 ORM
                  ┌────────────┴────────────┐
                  │   PostgreSQL Database   │
                  │   (8 Model Relasional)  │
                  └─────────────────────────┘
```

### Karakteristik & Tech Stack:
- **Runtime & Bahasa**: Node.js ($\ge$ 20) + TypeScript (ESM).
- **Web Framework**: Express.js 4.
- **Basis Data & ORM**: PostgreSQL + Prisma 7 ORM dengan driver adapter `@prisma/adapter-pg`.
- **Validasi Data**: Zod schema validation pada setiap request payload.
- **Autentikasi**:
  - **Pelanggan**: Verifikasi nomor ponsel berbasis OTP (One-Time Password) dengan hashing SHA-256 dan pembatasan percobaan (*rate-limiting*).
  - **Admin / Staf**: JSON Web Token (JWT) berbasis peran (*Role-Based Access Control*) dan enkripsi kata sandi Bcrypt.
- **Logging**: Pino structured logger untuk pelacakan transaksi server.

---

## 2. Struktur Direktori Kunci

Berikut adalah file dan direktori utama yang mengelola logika sistem:

```text
mobiljuragan-backend/
├── docs/
│   └── README.md            # Dokumentasi lengkap seluruh endpoint & payload REST API
├── prisma/
│   ├── schema.prisma        # Definisi 8 model relasional database PostgreSQL
│   ├── seed.ts              # Seeding 9 armada resmi Merauke & akun admin/staf default
│   └── migrations/          # Catatan migrasi skema database terkelola
├── src/
│   ├── app.ts               # Inisialisasi Express, middleware global, & CORS
│   ├── server.ts            # Entrypoint utama server HTTP (port default: 4000)
│   ├── db.ts                # Inisialisasi singleton Prisma Client & adapter DB
│   ├── logger.ts            # Konfigurasi structured logger Pino
│   ├── test-auth.ts         # Test suite otomatis (27 test cases end-to-end)
│   ├── middleware/
│   │   ├── auth.ts          # Middleware validasi JWT & otorisasi role pengguna
│   │   ├── errorHandler.ts  # Global error handler dengan format respons konsisten
│   │   └── validate.ts      # Middleware validasi skema request berbasis Zod
│   ├── routes/v1/
│   │   ├── index.ts         # Router induk API v1
│   │   ├── auth.ts          # Endpoint OTP & autentikasi pelanggan
│   │   ├── adminAuth.ts     # Endpoint login & profil staf/admin
│   │   ├── vehicles.ts      # Endpoint katalog & ketersediaan armada
│   │   ├── bookings.ts      # Endpoint pemesanan sewa & pelacakan status pelanggan
│   │   ├── adminBookings.ts # Endpoint antrean sewa & konfirmasi tarif admin
│   │   ├── adminFleet.ts    # Endpoint kalender timeline armada admin
│   │   └── adminVehicles.ts # Endpoint update status fisik armada & audit log
│   └── utils/
│       ├── auth.ts          # Helper token JWT, hashing OTP SHA-256, & verifikasi
│       └── response.ts      # Standard response envelope (status ok & error)
├── prisma.config.ts         # Konfigurasi koneksi migrasi Prisma 7
└── tsconfig.json            # Konfigurasi compiler TypeScript (NodeNext)
```

---

## 3. Prasyarat Sistem

- **Node.js**: Versi $\ge$ 20.x LTS
- **npm**: Versi $\ge$ 10.x
- **PostgreSQL**: Versi 16 atau 18 aktif di port 5432 (bisa via FlyEnv, Docker, Laragon, atau layanan PostgreSQL lokal).

---

## 4. Panduan Menjalankan & Inisialisasi Database

Ikuti langkah-langkah berikut secara berurutan untuk menyiapkan database dan menjalankan server:

### Langkah 1: Install Dependencies
```bash
npm install
```

### Langkah 2: Konfigurasi File `.env`
Salin template konfigurasi `.env.example` ke file `.env`:

- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
- **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```

Buka file `.env` dan pastikan konfigurasi `DATABASE_URL` sesuai dengan instance PostgreSQL lokal Anda:
```env
DATABASE_URL="postgresql://mobiljuragan:mobiljuragan@localhost:5432/mobiljuragan?schema=public"
PORT=4000
APP_VERSION=dev
LOG_LEVEL=info
JWT_SECRET="mobiljuragan-dev-jwt-secret-key"
OTP_SALT="mobiljuragan-dev-otp-salt-key"
SESSION_SECRET="CHANGE_ME_random_long_string"
```
*(Catatan: Jika memakai user bawaan `postgres`, sesuaikan menjadi `postgresql://postgres:password_anda@localhost:5432/mobiljuragan?schema=public`)*.

### Langkah 3: Menyiapkan PostgreSQL Lokal
Pastikan service database PostgreSQL telah berjalan:
- Jika menggunakan **FlyEnv** atau aplikasi sejenis: pastikan modul PostgreSQL berstatus *Running* di port `5432`.
- Jika database `mobiljuragan` belum dibuat secara manual, Anda bisa membuatnya lewat terminal atau GUI DB (DBeaver / pgAdmin):
  ```sql
  CREATE DATABASE mobiljuragan;
  ```

### Langkah 4: Generate Prisma Client
Kompilasi Prisma Client untuk menghasilkan tipe TypeScript dari skema:
```bash
npm run prisma:generate
```

### Langkah 5: Migrasi Skema ke Database
Eksekusi migrasi tabel relasional (`users`, `vehicles`, `bookings`, `booking_status_histories`, `audit_logs`, dll.) ke PostgreSQL:
```bash
npm run prisma:migrate
```
*(Perintah ini menjalankan `prisma migrate dev`, yang secara otomatis menerapkan seluruh file migrasi di folder `prisma/migrations/`).*

### Langkah 6: Seeding Data Awal (9 Armada & Akun Default)
Isi database dengan data operasional awal:
```bash
npm run prisma:seed
```
Setelah proses seeding selesai, database akan memiliki:
1. **9 Unit Armada Resmi Merauke:**
   - *MPV*: Toyota Avanza G Putih (`PS1692B`), Toyota Avanza G Hitam (`PS1701B`), Daihatsu Xenia R Silver (`PS1822B`), Toyota Innova Reborn Diesel Abu-abu (`PS1933B`).
   - *SUV*: Toyota Fortuner 2.8 VRZ Hitam (`PS2044B`), Mitsubishi Pajero Sport Dakar Putih (`PS2155B`).
   - *PICKUP*: Toyota Hilux Double Cabin 4x4 Putih (`PS2266B`), Mitsubishi Triton Ultimate 4x4 Hitam (`PS2377B`).
   - *COMMERCIAL*: Daihatsu Gran Max Blind Van Putih (`PS2488B`).
2. **Akun Staf & Admin Default:**
   - **Admin Utama:** No. HP `081234567890` | Password: `Admin123!`
   - **Staf Operasional:** No. HP `081234567891` | Password: `Staff123!`

### Langkah 7: Jalankan Pengujian Otomatis
Verifikasi seluruh fungsionalitas backend mulai dari autentikasi, transaksi booking, hingga antrean operasional admin:
```bash
npm test
```
*(Harus menampilkan 27/27 test case lolos tanpa error).*

### Langkah 8: Jalankan Server Development
```bash
npm run dev
```
Server akan aktif di `http://localhost:4000`. Cek kesehatan endpoint pada browser atau terminal:
```bash
curl http://localhost:4000/health
```

### Langkah 9 (Opsional): Eksplorasi Data via Prisma Studio
Untuk melihat dan mengelola isi tabel secara visual melalui peramban web:
```bash
npm run prisma:studio
```

---

## 5. Ringkasan Endpoint API Terimplementasi

| Modul | Method | Endpoint | Akses | Keterangan |
|---|---|---|---|---|
| **Health** | `GET` | `/health` | Publik | Status server & uptime |
| **Katalog** | `GET` | `/api/v1/vehicles` | Publik | Daftar 9 armada dengan filter kategori & tanggal |
| **Katalog** | `GET` | `/api/v1/vehicles/categories` | Publik | Daftar kategori armada aktif |
| **Katalog** | `GET` | `/api/v1/vehicles/:id` | Publik | Detail satu armada (via UUID atau externalId) |
| **Auth Customer** | `POST` | `/api/v1/auth/otp/request` | Publik | Permintaan kode verifikasi OTP |
| **Auth Customer** | `POST` | `/api/v1/auth/otp/verify` | Publik | Verifikasi OTP & terbitkan token JWT |
| **Auth Customer** | `GET` | `/api/v1/auth/me` | Customer | Profil customer login |
| **Auth Customer** | `POST` | `/api/v1/auth/logout` | Customer | Logout sesi customer |
| **Auth Admin** | `POST` | `/api/v1/admin/auth/login` | Publik | Login staf/admin via no. HP & password |
| **Auth Admin** | `GET` | `/api/v1/admin/auth/me` | Admin/Staff | Profil staf/admin login |
| **Booking Customer**| `POST` | `/api/v1/bookings` | Customer | Buat booking sewa (transaksi atomik Prisma) |
| **Booking Customer**| `GET` | `/api/v1/bookings` | Customer | Daftar riwayat pesanan milik pemesan |
| **Booking Customer**| `GET` | `/api/v1/bookings/:id` | Customer | Detail pesanan sewa |
| **Booking Customer**| `GET` | `/api/v1/bookings/:id/status` | Customer | Status terkini & timeline stepper pesanan |
| **Operasional Admin**| `GET` | `/api/v1/admin/bookings` | Admin/Staff | Antrean pesanan masuk, filter & paginasi |
| **Operasional Admin**| `GET` | `/api/v1/admin/bookings/:id` | Admin/Staff | Detail booking admin & link intent WhatsApp |
| **Operasional Admin**| `PATCH`| `/api/v1/admin/bookings/:id/status`| Admin/Staff | Konfirmasi tarif & update status booking |
| **Armada Admin** | `GET` | `/api/v1/admin/fleet/calendar` | Admin/Staff | Matriks kalender timeline 9 armada |
| **Armada Admin** | `PATCH`| `/api/v1/admin/vehicles/:id/status`| Admin/Staff | Update status fisik armada & audit log |

---

## 6. Standar Format Respons API

Seluruh endpoint REST API menggunakan format respons terstandarisasi yang konsisten:

### Respons Berhasil (HTTP 200 / 201)
```json
{
  "status": "ok",
  "data": { ... }
}
```

### Respons Gagal (HTTP 400 / 401 / 403 / 404 / 409 / 500)
```json
{
  "error": {
    "code": "KODE_ERROR",
    "message": "Pesan deskriptif penyebab error.",
    "details": {}
  }
}
```

---

## 7. Dokumentasi Lengkap
Untuk panduan detail mengenai format payload JSON, query parameter, dan contoh respons tiap endpoint, silakan buka dokumen:
👉 **[`docs/README.md`](docs/README.md)**

