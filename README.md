# MobilJuragan Backend API

Layanan REST API terpusat (*single source of truth*) untuk platform digital rental mobil **CV. Mobil Juragan Express Transport** di Merauke, Papua Selatan. Layanan ini mengelola seluruh logika bisnis, transaksi pemesanan armada, manajemen inventaris kendaraan, dan autentikasi pengguna.

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
├── prisma/
│   ├── schema.prisma        # Definisi 8 model relasional database PostgreSQL
│   ├── seed.ts              # Seeding 9 unit armada resmi Merauke & akun staf awal
│   └── migrations/          # Catatan migrasi skema database terkelola
├── src/
│   ├── app.ts               # Inisialisasi Express, middleware global, & CORS
│   ├── server.ts            # Entrypoint utama server HTTP (port default: 4000)
│   ├── db.ts                # Inisialisasi singleton Prisma Client & adapter DB
│   ├── logger.ts            # Konfigurasi structured logger Pino
│   ├── middleware/
│   │   ├── auth.ts          # Middleware validasi JWT & otorisasi role pengguna
│   │   ├── errorHandler.ts  # Global error handler dengan format respons konsisten
│   │   └── validate.ts      # Middleware validasi skema request berbasis Zod
│   ├── routes/v1/
│   │   ├── index.ts         # Router induk API v1
│   │   ├── auth.ts          # Endpoint OTP & autentikasi pelanggan
│   │   └── adminAuth.ts     # Endpoint login & manajemen kredensial staf
│   └── utils/
│       ├── auth.ts          # Helper token JWT, hash OTP, dan verifikasi
│       └── response.ts      # Standard response envelope (format standar JSON)
├── prisma.config.ts         # Konfigurasi koneksi migrasi Prisma 7
└── tsconfig.json            # Konfigurasi compiler TypeScript (NodeNext)
```

---

## 3. Prasyarat Sistem

- **Node.js**: Versi $\ge$ 20.x LTS
- **npm**: Versi $\ge$ 10.x
- **PostgreSQL**: Versi 16 atau 18 lokal aktif (contoh: via PostgreSQL Service atau Docker)

---

## 4. Panduan Menjalankan

### Langkah 1: Install Dependencies
```bash
npm install
```

### Langkah 2: Konfigurasi Environment Variable
Salin template konfigurasi `.env.example`:
```bash
cp .env.example .env
```
Sesuaikan string koneksi database PostgreSQL lokal pada file `.env`:
```env
DATABASE_URL="postgresql://mobiljuragan:mobiljuragan@localhost:5432/mobiljuragan?schema=public"
PORT=4000
APP_VERSION=1.0.0
LOG_LEVEL=info
SESSION_SECRET="rahasia_sesi_acak_anda"
```

### Langkah 3: Migrasi Database & Seeding Armada
Jalankan migrasi skema tabel dan lakukan pengisian data awal (*seeding* 9 unit armada resmi Merauke):
```bash
# Generate Prisma Client
npm run prisma:generate

# Jalankan migrasi tabel ke PostgreSQL
npm run prisma:migrate

# Isi 9 armada resmi dan akun staf awal
npm run prisma:seed
```

### Langkah 4: Menjalankan Server Development
```bash
npm run dev
```
Server akan aktif di `http://localhost:4000`. Cek kesehatan endpoint pada:
```bash
curl http://localhost:4000/health
```

### Langkah 5: Pengujian Otomatis
Jalankan test suite untuk memverifikasi alur autentikasi dan envelope respons:
```bash
npm test
```

---

## 5. Standar Format Respons API

Seluruh endpoint REST API menggunakan format respons terstandarisasi:

```json
{
  "success": true,
  "data": {
    "token": "...",
    "user": {
      "id": "...",
      "role": "ADMIN"
    }
  },
  "error": null,
  "meta": {
    "timestamp": "2026-09-24T15:00:00.000Z",
    "version": "1.0.0"
  }
}
```
